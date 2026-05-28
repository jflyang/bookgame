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

export interface TaskPackageManifest {
  id: string;
  type: "task-package";
  schemaVersion: "1";
  title: string;
  description: string;
  entry: "task-package.json";
  createdAt: string;
  updatedAt: string;
}

export interface TaskPackageRepositoryOptions {
  legacyDir?: string;
}

export class TaskPackageRepository {
  private pluginIndexCache: Map<string, PluginAssetIndex | null> = new Map();
  private listCache: StoryPackage[] | null = null;

  constructor(
    private readonly rootDir: string,
    private readonly options: TaskPackageRepositoryOptions = {}
  ) {
    ensureDir(rootDir);
    this.migrateLegacyPackages();
    this.scanPluginPackages();
  }

  list(): StoryPackage[] {
    if (this.listCache) return this.listCache;
    this.listCache = this.packageDirs().map((dir) => {
      const id = basename(dir);
      // Try v2 entry first, fall back to v1
      const v2Entry = resolveInside(dir, "story.json");
      const entryFile = existsSync(v2Entry) ? v2Entry : resolveInside(dir, "task-package.json");
      const pkg = storyPackageSchema.parse(JSON.parse(readFileSync(entryFile, "utf-8")));
      // Override id with directory name — the directory IS the primary key
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
      // Fix thumbnail URL to match directory-based id
      if (pkg.thumbnail && pkg.thumbnail.startsWith("/api/admin/media/")) {
        pkg.thumbnail = `/api/admin/media/${id}`;
      }
      // Attach plugin manifest if v2
      const manifest = this.tryReadPluginManifest(id);
      if (manifest) {
        return { ...pkg, pluginManifest: manifest };
      }
      return pkg;
    });
    return this.listCache;
  }

  /** Invalidate the list cache. Call after save/remove operations. */
  invalidateCache() {
    this.listCache = null;
  }

  save(pkg: StoryPackage) {
    const parsed = storyPackageSchema.parse(pkg);
    ensureDir(this.packageDir(parsed.id));
    const entryFile = parsed.pluginManifest ? "story.json" : "task-package.json";
    writeFileSync(resolveInside(this.packageDir(parsed.id), entryFile), JSON.stringify(parsed, null, 2), "utf-8");
    writeFileSync(this.manifestFile(parsed.id), JSON.stringify(this.toManifest(parsed), null, 2), "utf-8");
    this.writeSplitFiles(parsed);
    // Rebuild plugin index
    this.pluginIndexCache.delete(parsed.id);
    this.getPluginIndex(parsed.id);
    this.invalidateCache();
    return parsed;
  }

  remove(id: string) {
    const dir = this.packageDir(id);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    this.pluginIndexCache.delete(id);
    this.invalidateCache();
  }

  taskFile(id: string) {
    return resolveInside(this.packageDir(id), "task-package.json");
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
      .filter((dir) => {
        // Must have at least one recognizable entry file
        return existsSync(resolveInside(dir, "task-package.json")) ||
               existsSync(resolveInside(dir, "story.json"));
      });
  }

  private packageFiles() {
    return readdirSync(this.rootDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && safeDirectoryName(entry.name))
      .map((entry) => resolveInside(this.rootDir, entry.name, "task-package.json"))
      .filter((path) => existsSync(path));
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

  private toManifest(pkg: StoryPackage): TaskPackageManifest | StoryPluginManifest {
    if (pkg.pluginManifest) {
      return {
        ...pkg.pluginManifest,
        id: pkg.id,
        title: pkg.title,
        description: pkg.description,
        createdAt: pkg.createdAt,
        updatedAt: pkg.updatedAt,
      };
    }
    return {
      id: pkg.id,
      type: "task-package",
      schemaVersion: "1",
      title: pkg.title,
      description: pkg.description,
      entry: "task-package.json",
      createdAt: pkg.createdAt,
      updatedAt: pkg.updatedAt
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
    if (pkg.flow) {
      writeFileSync(resolveInside(packageDir, "flow.json"), JSON.stringify(pkg.flow, null, 2), "utf-8");
    }
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
