import type { CharacterState, GameState, Message } from "@story-game/shared";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export interface SessionSummary {
  id: string;
  storyPackageId: string;
  storyPackageTitle: string;
  round: number;
  status: "idle" | "active" | "completed";
  currentStage: string;
  characterStates: CharacterStateSnapshot[];
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterStateSnapshot {
  name: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
}

export interface SessionDetail {
  session: SessionSummary;
  gameState: GameState | null;
  messages: Message[] | null;
}

export async function fetchSessions(storyPackageId?: string, status?: string) {
  const params = new URLSearchParams();
  if (storyPackageId) params.set("storyPackageId", storyPackageId);
  if (status) params.set("status", status);
  const qs = params.toString();
  const response = await fetch(`${API_BASE}/api/admin/sessions${qs ? `?${qs}` : ""}`);
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<{ sessions: SessionSummary[] }>;
}

export async function fetchSessionDetail(id: string) {
  const response = await fetch(`${API_BASE}/api/admin/sessions/${id}`);
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<SessionDetail>;
}

export async function clearSessions() {
  const response = await fetch(`${API_BASE}/api/admin/sessions`, { method: "DELETE" });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<{ ok: boolean }>;
}
