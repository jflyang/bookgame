import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StoryPackage } from "@story-game/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORK_DIR = join(__dirname, "../../../workdir");
const EDITOR_MEDIA = join(__dirname, "../../../workdir/media");

export interface PackageState {
  dir: string;
  storyPackage: StoryPackage;
  hasManifest: boolean;
  manifest: Record<string, unknown> | null;
  hasCharacters: boolean;
  hasSkills: boolean;
  hasKnowledge: boolean;
  hasPromptRules: boolean;
  hasStorySetting: boolean;
  flowNodes?: unknown[];
  flowEdges?: unknown[];
  mediaFiles: string[];
}

let currentPackage: PackageState | null = null;

export function getPackageState(): PackageState | null {
  return currentPackage;
}

/** Open a story package directory. */
export function openDirectory(packageDir: string): PackageState {
  if (!existsSync(packageDir)) throw new Error(`目录不存在: ${packageDir}`);

  let storyPath = join(packageDir, "story.json");
  if (!existsSync(storyPath)) {
    storyPath = join(packageDir, "task-package.json");
  }
  if (!existsSync(storyPath)) throw new Error(`目录中未找到 story.json 或 task-package.json`);

  const raw = readFileSync(storyPath, "utf-8");
  const storyPackage = JSON.parse(raw) as StoryPackage;

  // Prefer split scenario.json over the embedded one in story.json (split file may be newer)
  const scenarioPath = join(packageDir, "scenario.json");
  if (existsSync(scenarioPath)) {
    try {
      const scenarioRaw = JSON.parse(readFileSync(scenarioPath, "utf-8"));
      if (scenarioRaw.id && scenarioRaw.stages) {
        storyPackage.scenario = scenarioRaw;
      }
    } catch { /* ignore parse errors, use embedded */ }
  }

  // Merge split ui/config.json — authoritative source for UI config (fixes split-brain)
  const uiConfigPath = join(packageDir, "ui", "config.json");
  if (existsSync(uiConfigPath)) {
    try {
      const uiRaw = JSON.parse(readFileSync(uiConfigPath, "utf-8"));
      if (uiRaw && Object.keys(uiRaw).length > 0) {
        storyPackage.uiConfig = { ...storyPackage.uiConfig, ...uiRaw };
      }
    } catch { /* ignore, use embedded */ }
  }

  const hasManifest = existsSync(join(packageDir, "manifest.json"));
  const manifest = hasManifest ? JSON.parse(readFileSync(join(packageDir, "manifest.json"), "utf-8")) : null;
  const hasCharacters = existsSync(join(packageDir, "characters.json"));
  const hasSkills = existsSync(join(packageDir, "skills.json"));
  const hasKnowledge = existsSync(join(packageDir, "knowledge", "documents.json"));
  const hasPromptRules = existsSync(join(packageDir, "prompts", "rules.json"));
  const hasStorySetting = existsSync(join(packageDir, "prompts", "story-setting.md"));

  // Load v2 flow/modules split files
  // flow.json may contain ReactFlow format (nodes+edges) or FlowDefinition format
  let flowNodes: unknown[] | undefined;
  let flowEdges: unknown[] | undefined;
  if (existsSync(join(packageDir, "flow.json"))) {
    const flowRaw = JSON.parse(readFileSync(join(packageDir, "flow.json"), "utf-8"));
    if (flowRaw.nodes && Array.isArray(flowRaw.nodes)) {
      // ReactFlow format — preserve exact node positions and edges
      flowNodes = flowRaw.nodes;
      flowEdges = flowRaw.edges || [];
    }
    // Also extract runtime FlowDefinition from merged file (can have both nodes + linearPhases)
    if (!storyPackage.flow && flowRaw.linearPhases) {
      storyPackage.flow = {
        id: flowRaw.id,
        title: flowRaw.title,
        description: flowRaw.description,
        linearPhases: flowRaw.linearPhases,
        servingLoop: flowRaw.servingLoop,
        finaleSequence: flowRaw.finaleSequence,
        dailySystem: flowRaw.dailySystem,
      };
    } else if (!storyPackage.flow) {
      // FlowDefinition format — only use if story.json doesn't already have flow
      storyPackage.flow = flowRaw;
    }
  }
  if (existsSync(join(packageDir, "modules.json"))) {
    if (!storyPackage.modules) {
      storyPackage.modules = JSON.parse(readFileSync(join(packageDir, "modules.json"), "utf-8"));
    }
  }

  const mediaFiles: string[] = [];
  const assetsDir = join(packageDir, "assets", "performances");
  if (existsSync(assetsDir)) {
    scanDir(assetsDir, mediaFiles);
  }

  currentPackage = {
    dir: packageDir,
    storyPackage,
    hasManifest,
    manifest,
    hasCharacters,
    hasSkills,
    hasKnowledge,
    hasPromptRules,
    hasStorySetting,
    flowNodes,
    flowEdges,
    mediaFiles,
  };

  return currentPackage;
}

/** Extract a ZIP file and open it. */
export async function openZip(zipPath: string): Promise<PackageState> {
  if (!existsSync(zipPath)) throw new Error(`文件不存在: ${zipPath}`);

  // Dynamic import to avoid issues if archiver/unzipper aren't installed yet
  const unzipper = await import("unzipper");
  const fs = await import("node:fs");

  const zipName = basename(zipPath, extname(zipPath));
  const extractDir = join(WORK_DIR, zipName);
  if (existsSync(extractDir)) {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
  mkdirSync(extractDir, { recursive: true });

  const directory = await unzipper.Open.file(zipPath);
  await directory.extract({ path: extractDir });

  // Check for nested directory (ZIP might contain a single root folder)
  let finalDir = extractDir;
  const entries = readdirSync(extractDir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());
  if (dirs.length === 1 && !existsSync(join(extractDir, "story.json"))) {
    finalDir = join(extractDir, dirs[0].name);
  }

  return openDirectory(finalDir);
}

/** Save the full story package back to disk. */
export function saveStoryPackage(storyPackage: StoryPackage): void {
  if (!currentPackage) throw new Error("未打开任何故事包");

  const dir = currentPackage.dir;
  const sorted = sortStoryPackageKeys(storyPackage);
  writeFileSync(join(dir, "story.json"), JSON.stringify(sorted, null, 2), "utf-8");

  // Sync to split files
  if (currentPackage.hasCharacters) {
    writeFileSync(join(dir, "characters.json"), JSON.stringify(sorted.characters, null, 2), "utf-8");
  }
  if (currentPackage.hasSkills) {
    writeFileSync(join(dir, "skills.json"), JSON.stringify(sorted.skills, null, 2), "utf-8");
  }
  if (currentPackage.hasKnowledge) {
    writeFileSync(join(dir, "knowledge", "documents.json"), JSON.stringify(sorted.knowledgeDocuments, null, 2), "utf-8");
  }
  if (currentPackage.hasPromptRules) {
    writeFileSync(join(dir, "prompts", "rules.json"), JSON.stringify(sorted.promptRules, null, 2), "utf-8");
  }

  // v2: sync modules.json only (flow.json is saved separately with ReactFlow format)
  if (sorted.modules) {
    writeFileSync(join(dir, "modules.json"), JSON.stringify(sorted.modules, null, 2), "utf-8");
  }

  // Sync ui/config.json — authoritative split file for UI config
  if (sorted.uiConfig && Object.keys(sorted.uiConfig).length > 0) {
    const uiDir = join(dir, "ui");
    if (!existsSync(uiDir)) mkdirSync(uiDir, { recursive: true });
    writeFileSync(join(uiDir, "config.json"), JSON.stringify(sorted.uiConfig, null, 2), "utf-8");
  }

  currentPackage.storyPackage = sorted;
}

/** Save only flow.json and modules.json. */
export function saveFlowAndModules(flow: unknown, modules: unknown): void {
  if (!currentPackage) throw new Error("未打开任何故事包");
  const dir = currentPackage.dir;
  if (flow) {
    writeFileSync(join(dir, "flow.json"), JSON.stringify(flow, null, 2), "utf-8");
  }
  if (modules) {
    writeFileSync(join(dir, "modules.json"), JSON.stringify(modules, null, 2), "utf-8");
  }
}

/** Save manifest.json. */
export function saveManifest(manifest: Record<string, unknown>): void {
  if (!currentPackage) throw new Error("未打开任何故事包");
  writeFileSync(join(currentPackage.dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");
  currentPackage.manifest = manifest;
}

/** Export the current package as ZIP. */
export async function exportZip(): Promise<{ buffer: Buffer; filename: string }> {
  if (!currentPackage) throw new Error("未打开任何故事包");

  const archiver = await import("archiver");
  const archive = archiver.default("zip", { zlib: { level: 9 } });
  const chunks: Buffer[] = [];

  archive.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
  });

  archive.directory(currentPackage.dir, false);
  await archive.finalize();

  const filename = `${currentPackage.storyPackage.id || "story"}.task-package.zip`;
  return { buffer: await done, filename };
}

/** Upload the current package to the game server. */
export async function uploadToServer(serverUrl: string): Promise<{ ok: boolean; message: string }> {
  if (!currentPackage) throw new Error("未打开任何故事包");

  const { buffer, filename } = await exportZip();

  const FormData = (await import("form-data")).default;
  const fetch = (await import("node-fetch")).default;
  const form = new FormData();
  form.append("file", buffer, { filename });

  const response = await fetch(`${serverUrl.replace(/\/$/, "")}/api/admin/story-packages/import`, {
    method: "POST",
    body: form,
    headers: form.getHeaders(),
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, message: `${response.status}: ${text}` };
  }

  return { ok: true, message: "上传成功" };
}

/** Get a media file path. */
export function getMediaPath(relativePath: string): string | null {
  if (!currentPackage) return null;
  const fullPath = join(currentPackage.dir, relativePath);
  return existsSync(fullPath) ? fullPath : null;
}

/** Save a story setting markdown file. */
export function saveStorySetting(content: string): void {
  if (!currentPackage) throw new Error("未打开任何故事包");
  const promptsDir = join(currentPackage.dir, "prompts");
  if (!existsSync(promptsDir)) mkdirSync(promptsDir, { recursive: true });
  writeFileSync(join(promptsDir, "story-setting.md"), content, "utf-8");
  currentPackage.hasStorySetting = true;
}

function sortStoryPackageKeys(pkg: StoryPackage): StoryPackage {
  // Stable key ordering for clean diffs
  const { id, title, description, storySettingPrompt, scenario, characters, skills, knowledgeDocuments, promptRules, modules, flow, debugConfig, pluginManifest, uiConfig, createdAt, updatedAt, ...rest } = pkg as any;
  const sorted: any = { id, title, description, storySettingPrompt, scenario, characters, skills, knowledgeDocuments, promptRules, modules, flow, debugConfig, pluginManifest, uiConfig, createdAt, updatedAt, ...rest };
  Object.keys(sorted).forEach((k) => sorted[k] === undefined && delete sorted[k]);
  return sorted as StoryPackage;
}

function scanDir(dir: string, files: string[], prefix = "") {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      scanDir(join(dir, entry.name), files, relPath);
    } else {
      files.push(relPath);
    }
  }
}
