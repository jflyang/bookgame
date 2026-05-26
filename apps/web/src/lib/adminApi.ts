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

function jsonHeaders() {
  return { "Content-Type": "application/json" };
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}
