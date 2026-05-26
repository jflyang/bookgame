import type { Character, LlmConfig, LlmConfigView, StoryPackage } from "@story-game/shared";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export async function updateCharacter(character: Character) {
  const response = await fetch(`${API_BASE}/api/admin/characters/${character.id}`, {
    method: "PUT",
    headers: jsonHeaders(),
    body: JSON.stringify(character)
  });
  return parseResponse<{ character: Character; characters: Character[] }>(response);
}

export async function listStoryPackages() {
  const response = await fetch(`${API_BASE}/api/admin/story-packages`);
  return parseResponse<{ storyPackages: StoryPackage[] }>(response);
}

export async function createStoryPackage(title: string, sourcePackageId?: string) {
  const response = await fetch(`${API_BASE}/api/admin/story-packages`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ title, sourcePackageId })
  });
  return parseResponse<{ storyPackage: StoryPackage; storyPackages: StoryPackage[] }>(response);
}

export async function updateStoryPackage(storyPackage: StoryPackage) {
  const response = await fetch(`${API_BASE}/api/admin/story-packages/${storyPackage.id}`, {
    method: "PUT",
    headers: jsonHeaders(),
    body: JSON.stringify(storyPackage)
  });
  return parseResponse<{ storyPackage: StoryPackage; storyPackages: StoryPackage[] }>(response);
}

export async function deleteStoryPackage(id: string) {
  const response = await fetch(`${API_BASE}/api/admin/story-packages/${id}`, { method: "DELETE" });
  return parseResponse<{ storyPackages: StoryPackage[] }>(response);
}

export async function getLlmConfig() {
  const response = await fetch(`${API_BASE}/api/admin/llm-config`);
  return parseResponse<{ llmConfig: LlmConfigView }>(response);
}

export async function updateLlmConfig(config: LlmConfig) {
  const response = await fetch(`${API_BASE}/api/admin/llm-config`, {
    method: "PUT",
    headers: jsonHeaders(),
    body: JSON.stringify(config)
  });
  return parseResponse<{ llmConfig: LlmConfigView }>(response);
}

export function downloadStoryPackage(id: string) {
  const url = `${API_BASE}/api/admin/story-packages/${id}/export`;
  const link = document.createElement("a");
  link.href = url;
  link.download = `${id}.story-package.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function importStoryPackageZip(file: File, title?: string) {
  const form = new FormData();
  form.append("file", file);
  const query = title ? `?title=${encodeURIComponent(title)}` : "";
  const response = await fetch(`${API_BASE}/api/admin/story-packages/import${query}`, {
    method: "POST",
    body: form,
  });
  return parseResponse<{ storyPackage: import("@story-game/shared").StoryPackage; storyPackages: import("@story-game/shared").StoryPackage[] }>(response);
}

export async function uploadThumbnail(id: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE}/api/admin/story-packages/${id}/thumbnail`, {
    method: "POST",
    body: form,
  });
  return parseResponse<{ thumbnail: string }>(response);
}

export async function deleteThumbnail(id: string) {
  const response = await fetch(`${API_BASE}/api/admin/story-packages/${id}/thumbnail`, {
    method: "DELETE",
  });
  return parseResponse<{ ok: boolean }>(response);
}

function jsonHeaders() {
  return { "Content-Type": "application/json" };
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}
