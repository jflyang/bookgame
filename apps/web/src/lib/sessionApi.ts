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

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    try {
      const parsed = JSON.parse(body);
      if (parsed?.error) throw new Error(parsed.error);
    } catch (e) {
      if (e instanceof Error && e.message !== body) throw e;
    }
    throw new Error(body || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchSessions(storyPackageId?: string, status?: string, limit?: number) {
  const params = new URLSearchParams();
  if (storyPackageId) params.set("storyPackageId", storyPackageId);
  if (status) params.set("status", status);
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  const response = await fetch(`${API_BASE}/api/admin/sessions${qs ? `?${qs}` : ""}`);
  return parseResponse<{ sessions: SessionSummary[] }>(response);
}

export async function fetchSessionDetail(id: string) {
  const response = await fetch(`${API_BASE}/api/admin/sessions/${id}`);
  return parseResponse<SessionDetail>(response);
}

export async function clearSessions() {
  const response = await fetch(`${API_BASE}/api/admin/sessions`, { method: "DELETE" });
  return parseResponse<{ ok: boolean }>(response);
}
