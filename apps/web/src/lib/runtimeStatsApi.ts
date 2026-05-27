import type { RuntimeTurnRecord, RuntimeStatsAggregate } from "@story-game/shared";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export async function fetchRuntimeRecords(limit?: number, sessionId?: string) {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (sessionId) params.set("sessionId", sessionId);
  const qs = params.toString();
  const res = await fetch(`${API_BASE}/api/admin/runtime-stats${qs ? "?" + qs : ""}`);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { records: RuntimeTurnRecord[] };
}

export async function fetchRuntimeAggregates(sessionId?: string) {
  const params = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
  const res = await fetch(`${API_BASE}/api/admin/runtime-stats/aggregates${params}`);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { aggregates: RuntimeStatsAggregate };
}

export interface SessionSummary {
  sessionId: string;
  startedAt: string;
  turnCount: number;
  speakers: string;
}

export async function fetchSessionSummaries() {
  const res = await fetch(`${API_BASE}/api/admin/runtime-stats/sessions`);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { sessions: SessionSummary[] };
}

export async function clearRuntimeStats() {
  const res = await fetch(`${API_BASE}/api/admin/runtime-stats`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}
