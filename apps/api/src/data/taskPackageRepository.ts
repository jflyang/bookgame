import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { basename, extname, join, relative } from "node:path";
import type { StoryPackage, StoryPluginManifest } from "@story-game/shared";
import { storyPackageSchema, storyPluginManifestSchema } from "@story-game/shared";
import { assertSafeId, ensureDir, resolveInside } from "./pathGuards.js";
import { buildPluginIndex, type PluginAssetIndex } from "./pluginPackageIndex.js";
import { createModuleLogger } from "../utils/logger.js";

const logger = createModuleLogger("taskPackageRepo");

export interface TaskPackageRepositoryOptions {
  legacyDir?: string;
}

export class TaskPackageRepository {
  private pluginIndexCache: Map<string, PluginAssetIndex | null> = new Map();

  constructor(
    private readonly rootDir: string,
    private readonly options: TaskPackageRepositoryOptions = {}
  ) {
    ensureDir(rootDir);
    this.migrateLegacyPackages();
    this.scanPluginPackages();
  }

  list(): StoryPackage[] {
    return this.packageDirs().flatMap((dir) => {
      const id = basename(dir);
      try {
        const pkgFile = resolveInside(dir, "package.json");
        if (!existsSync(pkgFile)) {
          logger.warn({ id }, "V2 package detected (story.json) — no longer supported, skipping");
          return [];
        }
        const pkgRaw = JSON.parse(readFileSync(pkgFile, "utf-8"));
        if (pkgRaw.schemaVersion !== "3") {
          logger.warn({ id, version: pkgRaw.schemaVersion }, "unsupported schema version, skipping");
          return [];
        }
        const pkg = buildStoryPackageFromV3(dir, id, pkgRaw);
        const manifest = this.tryReadPluginManifest(id);
        if (manifest) {
          (pkg as any).pluginManifest = manifest;
        }
        return [pkg];
      } catch (err) {
        logger.warn({ err, id }, "failed to load story package, skipping");
        return [];
      }
    });
  }


  save(pkg: StoryPackage) {
    // Preserve voiceId on characters (may be stripped by schema parse if cache is stale)
    const voiceIdMap = new Map<string, string>();
    for (const c of (pkg as any).characters ?? []) {
      if (c.voiceId) voiceIdMap.set(c.id, c.voiceId);
    }

    const parsed = storyPackageSchema.parse(pkg);

    // Re-apply voiceId after parse
    if (voiceIdMap.size > 0) {
      for (const c of parsed.characters) {
        const vid = voiceIdMap.get(c.id);
        if (vid) (c as any).voiceId = vid;
      }
    }

    ensureDir(this.packageDir(parsed.id));
    // V3: write package.json as the entry file
    const pkgDir = this.packageDir(parsed.id);
    const packageJson = {
      schemaVersion: "3",
      id: parsed.id,
      title: parsed.title,
      description: parsed.description || "",
      createdAt: parsed.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeFileSync(resolveInside(pkgDir, "package.json"), JSON.stringify(packageJson, null, 2), "utf-8");
    writeFileSync(this.manifestFile(parsed.id), JSON.stringify(this.toManifest(parsed), null, 2), "utf-8");
    this.writeSplitFiles(parsed);
    // Rebuild plugin index
    this.pluginIndexCache.delete(parsed.id);
    this.getPluginIndex(parsed.id);
    return parsed;
  }

  remove(id: string) {
    const dir = this.packageDir(id);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    this.pluginIndexCache.delete(id);
  }

  taskFile(id: string) {
    return resolveInside(this.packageDir(id), "package.json");
  }

  manifestFile(id: string) {
    return resolveInside(this.packageDir(id), "manifest.json");
  }

  mediaDir(id: string) {
    return ensureDir(resolveInside(this.packageDir(id), "media"));
  }

  packageDir(id: string) {
    return resolveInside(this.rootDir, assertSafeId(id), "");
  }

  contentFiles(id: string) {
    const dir = this.packageDir(id);
    if (!existsSync(dir)) return [];
    return walkFiles(dir)
      .filter((file) => {
        const rel = relative(dir, file).replaceAll("\\", "/");
        if (rel.startsWith("saves/") || rel.startsWith("saves")) return false;
        return true;
      })
      .map((file) => ({ absolutePath: file, zipPath: relative(dir, file).replaceAll("\\", "/") }));
  }

  getPluginIndex(packageId: string): PluginAssetIndex | null {
    if (!this.pluginIndexCache.has(packageId)) {
      const manifest = this.tryReadPluginManifest(packageId);
      if (!manifest) {
        this.pluginIndexCache.set(packageId, null);
        return null;
      }
      const dir = this.packageDir(packageId);
      this.pluginIndexCache.set(packageId, buildPluginIndex(dir, manifest));
    }
    return this.pluginIndexCache.get(packageId)!;
  }

  tryReadPluginManifest(packageId: string): StoryPluginManifest | null {
    const mf = resolveInside(this.packageDir(packageId), "manifest.json");
    if (!existsSync(mf)) return null;
    try {
      const raw = JSON.parse(readFileSync(mf, "utf-8"));
      if (raw.schemaVersion !== "2") return null;
      return storyPluginManifestSchema.parse(raw);
    } catch (err) {
      logger.warn({ err, packageId, manifestPath: mf }, "failed to parse plugin manifest");
      return null;
    }
  }

  private scanPluginPackages() {
    const entries = readdirSync(this.rootDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && safeDirectoryName(e.name));
    for (const entry of entries) {
      this.getPluginIndex(entry.name); // populates cache
    }
  }

  private packageDirs() {
    return readdirSync(this.rootDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && safeDirectoryName(entry.name))
      .map((entry) => resolveInside(this.rootDir, entry.name, ""))
      .filter((dir) => existsSync(resolveInside(dir, "package.json")));
  }

  private migrateLegacyPackages() {
    const legacyDir = this.options.legacyDir;
    if (!legacyDir || !existsSync(legacyDir)) return;
    const legacyFiles = readdirSync(legacyDir).filter((file) => file.endsWith(".story-package.json"));
    for (const file of legacyFiles) {
      const raw = readFileSync(join(legacyDir, file), "utf-8");
      const pkg = storyPackageSchema.parse(JSON.parse(raw));
      assertSafeId(pkg.id);
      if (existsSync(this.taskFile(pkg.id))) continue;
      this.save(pkg);
      this.copyLegacyMedia(legacyDir, pkg.id);
    }
  }

  private copyLegacyMedia(legacyDir: string, id: string) {
    const mediaDir = join(legacyDir, "media");
    if (!existsSync(mediaDir)) return;
    const legacyMedia = readdirSync(mediaDir).find((file) => file.startsWith(`${id}.`));
    if (!legacyMedia) return;
    copyFileSync(join(mediaDir, legacyMedia), resolveInside(this.mediaDir(id), `thumbnail${normalizeMediaExtension(legacyMedia)}`));
  }

  private toManifest(pkg: StoryPackage): StoryPluginManifest | Record<string, unknown> {
    // Use the in-memory pluginManifest (from frontend save) as primary source
    // Only fall back to disk if pkg doesn't have one
    const source = pkg.pluginManifest ?? this.tryReadPluginManifest(pkg.id);

    if (source) {
      return {
        ...source,
        id: pkg.id,
        title: pkg.title,
        description: pkg.description,
        updatedAt: pkg.updatedAt,
      };
    }

    // Fallback: create a minimal v2 manifest
    return {
      id: pkg.id,
      type: "story-plugin",
      schemaVersion: "3",
      title: pkg.title,
      description: pkg.description,
      version: "1.0.0",
      author: "",
      capabilities: {},
      audio: {},
      images: {},
      fonts: {},
      performances: {},
      entry: "story.json",
      createdAt: pkg.createdAt,
      updatedAt: pkg.updatedAt,
    };
  }

  private writeSplitFiles(pkg: StoryPackage) {
    const packageDir = this.packageDir(pkg.id);
    const storyPkg = pkg as any;

    writeFileSync(resolveInside(packageDir, "scenario.json"), JSON.stringify(pkg.scenario, null, 2), "utf-8");
    writeFileSync(resolveInside(packageDir, "characters.json"), JSON.stringify(pkg.characters, null, 2), "utf-8");
    writeFileSync(resolveInside(packageDir, "setting.md"), pkg.storySettingPrompt ?? "", "utf-8");
    writeFileSync(resolveInside(packageDir, "rules.json"), JSON.stringify(pkg.promptRules, null, 2), "utf-8");
    writeFileSync(resolveInside(packageDir, "knowledge.json"), JSON.stringify(pkg.knowledgeDocuments, null, 2), "utf-8");

    if (storyPkg.actions) {
      writeFileSync(resolveInside(packageDir, "actions.json"), JSON.stringify(storyPkg.actions, null, 2), "utf-8");
    }
    if (storyPkg.reactions) {
      writeFileSync(resolveInside(packageDir, "reactions.json"), JSON.stringify(storyPkg.reactions, null, 2), "utf-8");
    }
    // Flow/modules are managed by the story editor, not rewritten here
  }
}

export function removeThumbnailFiles(mediaDir: string) {
  const files = readdirSync(mediaDir).filter((file) => file.startsWith("thumbnail."));
  for (const file of files) unlinkSync(resolveInside(mediaDir, file));
}

export function normalizeMediaExtension(filename: string) {
  const ext = extname(basename(filename)).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) return ext;
  return ".png";
}

function safeDirectoryName(name: string) {
  try {
    assertSafeId(name);
    return true;
  } catch (err) {
    logger.debug({ err, name }, "skipping directory with invalid name");
    return false;
  }
}

function buildStoryPackageFromV3(
  dir: string,
  id: string,
  pkgRaw: { id?: string; title?: string; description?: string; createdAt?: string; updatedAt?: string }
): StoryPackage {
  const pkg: any = {
    id: pkgRaw.id || id,
    title: pkgRaw.title || "",
    description: pkgRaw.description || "",
    createdAt: pkgRaw.createdAt || new Date().toISOString(),
    updatedAt: pkgRaw.updatedAt || new Date().toISOString(),
    storySettingPrompt: "",
    scenario: null,
    characters: [],
    skills: [],
    actions: [],
    reactions: [],
    knowledgeDocuments: [],
    promptRules: [],
    modules: [],
    flow: undefined,
    debugConfig: { showPromptLayers: false, showRawOutput: false, showValidation: false },
    uiConfig: {},
  };

  // scenario.json
  const scenarioPath = resolveInside(dir, "scenario.json");
  if (existsSync(scenarioPath)) {
    try { pkg.scenario = JSON.parse(readFileSync(scenarioPath, "utf-8")); } catch {}
  }

  // characters.json
  const charsPath = resolveInside(dir, "characters.json");
  if (existsSync(charsPath)) {
    try { pkg.characters = JSON.parse(readFileSync(charsPath, "utf-8")); } catch {}
  }

  // flow.json (ReactFlow + FlowDefinition + modules)
  const flowPath = resolveInside(dir, "flow.json");
  if (existsSync(flowPath)) {
    try {
      const flowRaw = JSON.parse(readFileSync(flowPath, "utf-8"));
      if (flowRaw.linearPhases) {
        pkg.flow = {
          id: flowRaw.id || "flow_default",
          title: flowRaw.title || "",
          description: flowRaw.description || "",
          linearPhases: flowRaw.linearPhases,
          servingLoop: flowRaw.servingLoop,
          finaleSequence: flowRaw.finaleSequence,
          dailySystem: flowRaw.dailySystem,
        };
      }
      if (flowRaw.modules) pkg.modules = flowRaw.modules;
    } catch {}
  }

  // actions.json
  const actionsPath = resolveInside(dir, "actions.json");
  if (existsSync(actionsPath)) {
    try { pkg.actions = JSON.parse(readFileSync(actionsPath, "utf-8")); } catch {}
  }

  // reactions.json
  const reactionsPath = resolveInside(dir, "reactions.json");
  if (existsSync(reactionsPath)) {
    try { pkg.reactions = JSON.parse(readFileSync(reactionsPath, "utf-8")); } catch {}
  }

  // knowledge.json
  const knowledgePath = resolveInside(dir, "knowledge.json");
  if (existsSync(knowledgePath)) {
    try { pkg.knowledgeDocuments = JSON.parse(readFileSync(knowledgePath, "utf-8")); } catch {}
  }

  // rules.json
  const rulesPath = resolveInside(dir, "rules.json");
  if (existsSync(rulesPath)) {
    try { pkg.promptRules = JSON.parse(readFileSync(rulesPath, "utf-8")); } catch {}
  }

  // setting.md
  const settingPath = resolveInside(dir, "setting.md");
  if (existsSync(settingPath)) {
    try { pkg.storySettingPrompt = readFileSync(settingPath, "utf-8"); } catch {}
  }

  return storyPackageSchema.parse(pkg);
}

function walkFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolveInside(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(path);
    return [path];
  });
}
