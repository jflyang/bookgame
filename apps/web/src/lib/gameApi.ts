import type { Character, GameState, KnowledgeDocument, Message, SendMessageRequest, Skill } from "@story-game/shared";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export interface SessionPayload {
  sessionId: string;
  gameState: GameState;
  characters: Character[];
  skills: Skill[];
  knowledgeDocuments: KnowledgeDocument[];
  messages: Message[];
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

export interface StreamErrorEvent {
  type: "error";
  message: string;
}

export type StreamEvent = StreamMetaEvent | StreamTokenEvent | StreamDoneEvent | StreamErrorEvent;

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

        let event: StreamEvent;
        try {
          event = JSON.parse(payload) as StreamEvent;
        } catch {
          continue; // skip unparseable JSON lines
        }
        if (event.type === "token") onToken(event);
        else if (event.type === "meta") onMeta(event);
        else if (event.type === "error") throw new Error(event.message);
        else if (event.type === "done") {
          onDone(event);
          return;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export interface ChoiceResult {
  state: GameState;
  previousStage: string;
  chosenBranch: { targetStage: string; choiceText?: string; description?: string };
}

export async function applyChoice(sessionId: string, branchIndex: number): Promise<ChoiceResult> {
  const response = await fetch(`${API_BASE}/api/game/sessions/${sessionId}/choose`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ branchIndex })
  });
  return parseResponse<ChoiceResult>(response);
}

function jsonHeaders() {
  return { "Content-Type": "application/json" };
}

export interface SaveMeta {
  sessionId: string;
  label: string;
  round: number;
  status: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaveSlot {
  slot: number;
  save: SaveMeta | null;
}

export async function listSaves(storyPackageId: string): Promise<SaveSlot[]> {
  const response = await fetch(`${API_BASE}/api/admin/story-packages/${storyPackageId}/saves`);
  const data = await parseResponse<{ slots: SaveSlot[] }>(response);
  return data.slots;
}

export async function saveSession(storyPackageId: string, sessionId: string, label: string, slot: number) {
  const response = await fetch(`${API_BASE}/api/admin/story-packages/${storyPackageId}/saves`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, label, slot })
  });
  return parseResponse<{ save: { sessionId: string; label: string }; slot: number }>(response);
}

export async function loadSession(storyPackageId: string, saveId: string): Promise<SessionPayload> {
  const response = await fetch(`${API_BASE}/api/game/sessions/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storyPackageId, saveId })
  });
  return parseResponse<SessionPayload>(response);
}

export async function loadSessionBySlot(storyPackageId: string, slot: number): Promise<SessionPayload> {
  const response = await fetch(`${API_BASE}/api/game/sessions/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storyPackageId, slot })
  });
  return parseResponse<SessionPayload>(response);
}

export async function deleteSave(storyPackageId: string, saveId: string, slot?: number) {
  const query = slot !== undefined ? `?slot=${slot}` : "";
  const response = await fetch(`${API_BASE}/api/admin/story-packages/${storyPackageId}/saves/${saveId}${query}`, {
    method: "DELETE"
  });
  return parseResponse<{ ok: boolean }>(response);
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
