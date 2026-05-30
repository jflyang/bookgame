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

/** Open a V3 story package directory. */
export function openDirectory(packageDir: string): PackageState {
  if (!existsSync(packageDir)) throw new Error(`目录不存在: ${packageDir}`);

  // V3: read package.json
  const pkgPath = join(packageDir, "package.json");
  if (!existsSync(pkgPath)) {
    if (existsSync(join(packageDir, "story.json"))) {
      throw new Error(`此故事包为 V2 格式，已不再支持。请使用迁移脚本升级到 V3。`);
    }
    throw new Error(`目录中未找到 package.json（需要 V3 格式的故事包）`);
  }

  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  if (pkg.schemaVersion !== "3") throw new Error(`不支持的故事包版本: ${pkg.schemaVersion || "未知"}`);

  const storyPackage: any = {
    id: pkg.id, title: pkg.title, description: pkg.description || "",
    createdAt: pkg.createdAt || new Date().toISOString(),
    updatedAt: pkg.updatedAt || new Date().toISOString(),
    storySettingPrompt: "", scenario: null as any, characters: [], skills: [],
    actions: [], reactions: [], knowledgeDocuments: [], promptRules: [],
    modules: [], flow: undefined,
    debugConfig: { showPromptLayers: false, showRawOutput: false, showValidation: false },
    uiConfig: {},
  };

  // scenario.json
  const sPath = join(packageDir, "scenario.json");
  if (existsSync(sPath)) storyPackage.scenario = JSON.parse(readFileSync(sPath, "utf-8"));

  // characters.json
  const charsPath = join(packageDir, "characters.json");
  if (existsSync(charsPath)) storyPackage.characters = JSON.parse(readFileSync(charsPath, "utf-8"));

  // flow.json
  let flowNodes: unknown[] | undefined;
  let flowEdges: unknown[] | undefined;
  const flowPath = join(packageDir, "flow.json");
  if (existsSync(flowPath)) {
    const flowRaw = JSON.parse(readFileSync(flowPath, "utf-8"));
    if (flowRaw.nodes && Array.isArray(flowRaw.nodes)) { flowNodes = flowRaw.nodes; flowEdges = flowRaw.edges || []; }
    if (flowRaw.linearPhases) storyPackage.flow = {
      id: flowRaw.id || "flow_default", title: flowRaw.title || "", description: flowRaw.description || "",
      linearPhases: flowRaw.linearPhases, servingLoop: flowRaw.servingLoop,
      finaleSequence: flowRaw.finaleSequence, dailySystem: flowRaw.dailySystem,
    };
    if (flowRaw.modules) storyPackage.modules = flowRaw.modules;
  }

  // actions.json, reactions.json, knowledge.json, rules.json
  for (const [file, key] of [["actions.json","actions"],["reactions.json","reactions"],["knowledge.json","knowledgeDocuments"],["rules.json","promptRules"]] as const) {
    const fp = join(packageDir, file);
    if (existsSync(fp)) storyPackage[key] = JSON.parse(readFileSync(fp, "utf-8"));
  }

  // setting.md, ui-config.json
  const sp = join(packageDir, "setting.md");
  if (existsSync(sp)) storyPackage.storySettingPrompt = readFileSync(sp, "utf-8");
  const uiPath = join(packageDir, "ui-config.json");
  if (existsSync(uiPath)) storyPackage.uiConfig = JSON.parse(readFileSync(uiPath, "utf-8"));

  const hasManifest = existsSync(join(packageDir, "manifest.json"));
  const manifest = hasManifest ? JSON.parse(readFileSync(join(packageDir, "manifest.json"), "utf-8")) : null;

  const mediaFiles: string[] = [];
  const mediaDir = join(packageDir, "media");
  if (existsSync(mediaDir)) {
    scanDir(mediaDir, mediaFiles);
  }

  currentPackage = {
    dir: packageDir, storyPackage: storyPackage as StoryPackage,
    hasManifest, manifest,
    hasCharacters: existsSync(charsPath),
    hasSkills: false,
    hasKnowledge: existsSync(join(packageDir, "knowledge.json")),
    hasPromptRules: existsSync(join(packageDir, "rules.json")),
    hasStorySetting: existsSync(sp),
    flowNodes, flowEdges, mediaFiles,
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

/** Save the full story package back to disk (V3 format). */
export function saveStoryPackage(storyPackage: StoryPackage): void {
  if (!currentPackage) throw new Error("未打开任何故事包");

  const dir = currentPackage.dir;
  const pkg = storyPackage as any;

  // package.json
  writeFileSync(join(dir, "package.json"), JSON.stringify({
    schemaVersion: "3", id: pkg.id, title: pkg.title, description: pkg.description || "",
    createdAt: pkg.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
  }, null, 2), "utf-8");

  // scenario.json, characters.json, actions.json, reactions.json, knowledge.json, rules.json
  if (pkg.scenario) writeFileSync(join(dir, "scenario.json"), JSON.stringify(pkg.scenario, null, 2), "utf-8");
  if (pkg.characters) writeFileSync(join(dir, "characters.json"), JSON.stringify(pkg.characters, null, 2), "utf-8");
  if (pkg.actions) writeFileSync(join(dir, "actions.json"), JSON.stringify(pkg.actions, null, 2), "utf-8");
  if (pkg.reactions) writeFileSync(join(dir, "reactions.json"), JSON.stringify(pkg.reactions, null, 2), "utf-8");
  if (pkg.knowledgeDocuments) writeFileSync(join(dir, "knowledge.json"), JSON.stringify(pkg.knowledgeDocuments, null, 2), "utf-8");
  if (pkg.promptRules) writeFileSync(join(dir, "rules.json"), JSON.stringify(pkg.promptRules, null, 2), "utf-8");

  // ui-config.json
  if (pkg.uiConfig) writeFileSync(join(dir, "ui-config.json"), JSON.stringify(pkg.uiConfig, null, 2), "utf-8");

  currentPackage.storyPackage = storyPackage;
}

function scanDir(dir: string, files: string[], prefix = "") {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) scanDir(join(dir, entry.name), files, relPath);
    else files.push(relPath);
  }
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

