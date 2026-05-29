import type { TtsConfigView, TtsSynthesizeResult, VoiceProfile } from "@story-game/shared";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

function jsonHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

/** Synthesize speech for a character's text */
export async function synthesize(
  text: string,
  characterId: string,
  emotion?: string,
  format?: "mp3" | "ogg" | "wav"
): Promise<TtsSynthesizeResult> {
  const response = await fetch(`${API_BASE}/api/tts/synthesize`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ text, characterId, emotion, format }),
  });
  return parseResponse<TtsSynthesizeResult>(response);
}

/** Get a streaming audio URL for a character's text */
export function getStreamUrl(text: string, characterId: string, emotion?: string): string {
  // For streaming, the frontend can POST and receive chunked audio
  // This helper returns the endpoint; actual streaming is done via fetch
  return `${API_BASE}/api/tts/stream`;
}

/** Stream synthesized audio as a ReadableStream */
export async function streamSynthesize(
  text: string,
  characterId: string,
  emotion?: string,
  format?: "mp3" | "ogg" | "wav"
): Promise<ReadableStream<Uint8Array> | null> {
  const response = await fetch(`${API_BASE}/api/tts/stream`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ text, characterId, emotion, format }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || `Stream request failed: ${response.status}`);
  }
  return response.body;
}

/** Get TTS configuration */
export async function getTtsConfig(): Promise<TtsConfigView> {
  const response = await fetch(`${API_BASE}/api/tts/config`);
  return parseResponse<TtsConfigView>(response);
}

/** Update TTS configuration */
export async function updateTtsConfig(config: Partial<TtsConfigView>): Promise<TtsConfigView> {
  const response = await fetch(`${API_BASE}/api/tts/config`, {
    method: "PUT",
    headers: jsonHeaders(),
    body: JSON.stringify(config),
  });
  return parseResponse<TtsConfigView>(response);
}

/** List available voices */
export async function listVoices(): Promise<{
  voices: Array<{ id: string; name: string; language: string; instruct?: string; characterId?: string }>;
  source: string;
}> {
  const response = await fetch(`${API_BASE}/api/tts/voices`);
  return parseResponse(response);
}

/** Register a voice profile for a character */
export async function registerVoice(profile: Omit<VoiceProfile, "referenceAudio"> & { referenceAudio?: string }): Promise<{ ok: boolean; profile: VoiceProfile }> {
  const response = await fetch(`${API_BASE}/api/tts/voices/register`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(profile),
  });
  return parseResponse(response);
}

/** Check TTS service health */
export async function checkHealth(): Promise<{ status: string; provider: string; serviceUrl?: string }> {
  const response = await fetch(`${API_BASE}/api/tts/health`);
  return parseResponse(response);
}

/** Get TTS service process status */
export async function getServiceStatus(): Promise<{
  status: "stopped" | "starting" | "running" | "error";
  pid: number | null;
  startedAt: string | null;
  lastError: string | null;
  serviceDir: string;
  serviceDirExists: boolean;
}> {
  const response = await fetch(`${API_BASE}/api/tts/service/status`);
  return parseResponse(response);
}

/** Start the TTS service process */
export async function startService(options?: { port?: number; pythonPath?: string }): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(`${API_BASE}/api/tts/service/start`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(options || {}),
  });
  return parseResponse(response);
}

/** Stop the TTS service process */
export async function stopService(): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(`${API_BASE}/api/tts/service/stop`, {
    method: "POST",
    headers: jsonHeaders(),
  });
  return parseResponse(response);
}

/** Get TTS service logs */
export async function getServiceLogs(lines?: number): Promise<{ logs: string[] }> {
  const qs = lines ? `?lines=${lines}` : "";
  const response = await fetch(`${API_BASE}/api/tts/service/logs${qs}`);
  return parseResponse(response);
}

/** Build the full audio URL from a relative path */
export function resolveAudioUrl(audioUrl: string): string {
  if (audioUrl.startsWith("http")) return audioUrl;
  return `${API_BASE}${audioUrl}`;
}
