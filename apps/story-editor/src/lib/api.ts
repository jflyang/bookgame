import type { StoryPackage } from "@story-game/shared";

const BASE = "/api/editor";

export interface EditorState {
  loaded: boolean;
  id: string;
  title: string;
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

export async function getState(): Promise<EditorState> {
  const r = await fetch(`${BASE}/state`);
  if (!r.ok) throw new Error("获取状态失败");
  return r.json();
}

export async function openPackage(path: string): Promise<EditorState> {
  const r = await fetch(`${BASE}/open`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!r.ok) {
    const err = await r.json();
    throw new Error(err.error || "打开失败");
  }
  return r.json();
}

export async function saveStoryPackage(pkg: StoryPackage): Promise<void> {
  const r = await fetch(`${BASE}/story`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pkg),
  });
  if (!r.ok) {
    const err = await r.json();
    throw new Error(err.error || "保存失败");
  }
}

export async function saveFlowAndModules(flow: unknown, modules: unknown): Promise<void> {
  const r = await fetch(`${BASE}/flow`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ flow, modules }),
  });
  if (!r.ok) {
    const err = await r.json();
    throw new Error(err.error || "保存流程失败");
  }
}

export async function saveFlowNodesEdges(nodes: unknown[], edges: unknown[], modules: unknown): Promise<void> {
  const r = await fetch(`${BASE}/flow`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodes, edges, modules }),
  });
  if (!r.ok) {
    const err = await r.json();
    throw new Error(err.error || "保存流程失败");
  }
}

export async function saveManifest(manifest: Record<string, unknown>): Promise<void> {
  const r = await fetch(`${BASE}/manifest`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(manifest),
  });
  if (!r.ok) throw new Error("保存 manifest 失败");
}

export async function saveStorySetting(content: string): Promise<void> {
  const r = await fetch(`${BASE}/story-setting`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!r.ok) throw new Error("保存故事设定失败");
}

export async function exportZip(): Promise<void> {
  const r = await fetch(`${BASE}/export`, { method: "POST" });
  if (!r.ok) throw new Error("导出失败");
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const disp = r.headers.get("Content-Disposition") || "";
  const match = disp.match(/filename="?(.+?)"?$/);
  a.download = match ? match[1] : "story-package.zip";
  a.click();
  URL.revokeObjectURL(url);
}

export async function uploadToServer(serverUrl: string): Promise<{ ok: boolean; message: string }> {
  const r = await fetch(`${BASE}/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serverUrl }),
  });
  return r.json();
}

export async function aiSuggest(context: string, instruction: string, currentData: unknown, dataType: string): Promise<{ suggestion: string; parsed?: unknown }> {
  const r = await fetch(`${BASE}/ai/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context, instruction, currentData, dataType }),
  });
  if (!r.ok) {
    const err = await r.json();
    throw new Error(err.error || "AI 请求失败");
  }
  return r.json();
}

export async function setAiConfig(apiKey: string, baseUrl?: string, model?: string): Promise<void> {
  await fetch(`${BASE}/ai/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, baseUrl, model }),
  });
}

export interface StoryPackageInfo {
  id: string;
  title: string;
  description: string;
  path: string;
  updatedAt: string;
}

export async function fetchPackages(): Promise<StoryPackageInfo[]> {
  const r = await fetch(`${BASE}/packages`);
  if (!r.ok) return [];
  const data = await r.json();
  return data.packages || [];
}

export function mediaUrl(relativePath: string): string {
  return `${BASE}/media?path=${encodeURIComponent(relativePath)}`;
}
