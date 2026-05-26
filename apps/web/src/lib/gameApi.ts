import type { Character, GameState, KnowledgeDocument, Message, SendMessageRequest, Skill } from "@story-game/shared";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export interface SessionPayload {
  sessionId: string;
  gameState: GameState;
  characters: Character[];
  skills: Skill[];
  knowledgeDocuments: KnowledgeDocument[];
}

export async function createSession(storyPackageId?: string): Promise<SessionPayload> {
  const response = await fetch(`${API_BASE}/api/game/sessions`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(storyPackageId ? { storyPackageId } : {})
  });
  return parseResponse(response);
}

export async function sendMessage(sessionId: string, input: SendMessageRequest) {
  const response = await fetch(`${API_BASE}/api/game/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input)
  });
  return parseResponse<{ message: Message; gameState: GameState; debug: Record<string, unknown> }>(response);
}

export interface StreamTokenEvent {
  type: "token";
  token: string;
  speakerId: string;
}

export interface StreamMetaEvent {
  type: "meta";
  speakerId: string;
  speakerName: string;
}

export interface StreamDoneEvent {
  type: "done";
  message: Message;
  gameState: GameState;
  debug: Record<string, unknown>;
}

export type StreamEvent = StreamMetaEvent | StreamTokenEvent | StreamDoneEvent;

export async function sendMessageStream(
  sessionId: string,
  input: SendMessageRequest,
  onToken: (event: StreamTokenEvent) => void,
  onMeta: (event: StreamMetaEvent) => void,
  onDone: (event: StreamDoneEvent) => void
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/game/sessions/${sessionId}/messages/stream`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(await response.text());

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Stream response missing body");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload) continue;

        try {
          const event = JSON.parse(payload) as StreamEvent;
          if (event.type === "token") onToken(event);
          else if (event.type === "meta") onMeta(event);
          else if (event.type === "done") {
            onDone(event);
            return;
          }
        } catch { /* skip unparseable */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function jsonHeaders() {
  return { "Content-Type": "application/json" };
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}
