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
        const entryFile = resolveInside(dir, "story.json");
        const pkg = storyPackageSchema.parse(JSON.parse(readFileSync(entryFile, "utf-8")));
        pkg.id = id;
        // Prefer split scenario.json (may have newer fields like directive)
        const scenarioFile = resolveInside(dir, "scenario.json");
        if (existsSync(scenarioFile)) {
          try {
            const scenarioRaw = JSON.parse(readFileSync(scenarioFile, "utf-8"));
            if (scenarioRaw.id && scenarioRaw.stages) {
              pkg.scenario = scenarioRaw;
            }
          } catch { /* ignore, use embedded */ }
        }
        // Prefer split characters.json — authoritative source for character data (includes voiceId etc.)
        const charactersFile = resolveInside(dir, "characters.json");
        if (existsSync(charactersFile)) {
          try {
            const charsRaw = JSON.parse(readFileSync(charactersFile, "utf-8"));
            if (Array.isArray(charsRaw) && charsRaw.length > 0) {
              pkg.characters = charsRaw;
            }
          } catch { /* ignore, use embedded */ }
        }
        // Merge split ui/config.json
        const uiConfigFile = resolveInside(dir, "ui/config.json");
        if (existsSync(uiConfigFile)) {
          try {
            const uiRaw = JSON.parse(readFileSync(uiConfigFile, "utf-8"));
            if (uiRaw && Object.keys(uiRaw).length > 0) {
              pkg.uiConfig = { ...pkg.uiConfig, ...uiRaw } as any;
            }
          } catch { /* ignore, use embedded */ }
        }
        // Fix thumbnail URL to match directory-based id
        if (pkg.thumbnail && pkg.thumbnail.startsWith("/api/admin/media/")) {
          pkg.thumbnail = `/api/admin/media/${id}`;
        }
        // Attach plugin manifest if v2
        const manifest = this.tryReadPluginManifest(id);
        if (manifest) {
          return [{ ...pkg, pluginManifest: manifest }];
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
    // Always write story.json as the canonical entry file (v2 format).
    // toManifest() below will throw if no v2 manifest exists — v1 has been retired.
    const entryFile = "story.json";
    writeFileSync(resolveInside(this.packageDir(parsed.id), entryFile), JSON.stringify(parsed, null, 2), "utf-8");
    // Remove stale task-package.json if it exists (legacy v1 entry file)
    const legacyEntry = resolveInside(this.packageDir(parsed.id), "task-package.json");
    if (existsSync(legacyEntry)) {
      try { unlinkSync(legacyEntry); } catch { /* non-critical */ }
    }
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
    return resolveInside(this.packageDir(id), "story.json");
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
      .filter((dir) => existsSync(resolveInside(dir, "story.json")));
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
      schemaVersion: "2",
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
    writeFileSync(resolveInside(packageDir, "scenario.json"), JSON.stringify(pkg.scenario, null, 2), "utf-8");
    writeFileSync(resolveInside(packageDir, "characters.json"), JSON.stringify(pkg.characters, null, 2), "utf-8");
    writeFileSync(resolveInside(packageDir, "skills.json"), JSON.stringify(pkg.skills, null, 2), "utf-8");

    const knowledgeDir = ensureDir(resolveInside(packageDir, "knowledge"));
    writeFileSync(resolveInside(knowledgeDir, "documents.json"), JSON.stringify(pkg.knowledgeDocuments, null, 2), "utf-8");

    const promptsDir = ensureDir(resolveInside(packageDir, "prompts"));
    writeFileSync(resolveInside(promptsDir, "story-setting.md"), pkg.storySettingPrompt ?? "", "utf-8");
    writeFileSync(resolveInside(promptsDir, "rules.json"), JSON.stringify(pkg.promptRules, null, 2), "utf-8");

    const uiDir = ensureDir(resolveInside(packageDir, "ui"));
    writeFileSync(resolveInside(uiDir, "config.json"), JSON.stringify(pkg.uiConfig ?? {}, null, 2), "utf-8");

    if (pkg.modules) {
      writeFileSync(resolveInside(packageDir, "modules.json"), JSON.stringify(pkg.modules, null, 2), "utf-8");
    }
    // Note: flow.json is NOT written here — it may contain ReactFlow node positions
    // that are managed by the story editor. Only the editor should write flow.json.
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

function walkFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolveInside(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(path);
    return [path];
  });
}
