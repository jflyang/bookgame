import { describe, it, expect, beforeEach, vi } from "vitest";
import { GameApplicationService } from "../gameApplicationService.js";
import type { DialogueEngine } from "../../services/dialogueEngine.js";
import type { SessionSaveService } from "../../services/sessionSaveService.js";
import type { CreateSessionRequest, SendMessageRequest, GameState, Message, Scenario } from "@story-game/shared";

function createMockDialogueEngine() {
  return {
    createSession: vi.fn(),
    getSessionState: vi.fn(),
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
    sendMessageStream: vi.fn(),
    updateScenario: vi.fn(),
    restoreSession: vi.fn(),
  } as any;
}

function createMockSessionSaveService() {
  return {
    get: vi.fn(),
    getBySlot: vi.fn(),
  } as any;
}

describe("GameApplicationService", () => {
  let service: GameApplicationService;
  let mockDE: ReturnType<typeof createMockDialogueEngine>;
  let mockSS: ReturnType<typeof createMockSessionSaveService>;

  beforeEach(() => {
    mockDE = createMockDialogueEngine();
    mockSS = createMockSessionSaveService();
    service = new GameApplicationService(mockDE, mockSS);
  });

  it("createSession delegates to dialogueEngine", () => {
    const input: CreateSessionRequest = { scenarioId: "sc1", characterIds: ["qiaofeng"] };
    const result = { sessionId: "s1", gameState: {} as any, characters: [], skills: [], knowledgeDocuments: [] };
    mockDE.createSession.mockReturnValue(result);
    expect(service.createSession(input)).toBe(result);
    expect(mockDE.createSession).toHaveBeenCalledWith(input);
  });

  it("getSessionState delegates to dialogueEngine", () => {
    const result = { gameState: {} as any, characters: [], skills: [], knowledgeDocuments: [] };
    mockDE.getSessionState.mockReturnValue(result);
    expect(service.getSessionState("s1")).toBe(result);
    expect(mockDE.getSessionState).toHaveBeenCalledWith("s1");
  });

  it("getMessages delegates to dialogueEngine and wraps result", () => {
    const messages: Message[] = [{ id: "m1", sessionId: "s1", role: "assistant", speakerId: "qiaofeng", content: "Hi", usedSkills: [], stateDelta: {}, createdAt: "2026-01-01" }];
    mockDE.getMessages.mockReturnValue(messages);
    const result = service.getMessages("s1");
    expect(result).toEqual({ messages });
    expect(mockDE.getMessages).toHaveBeenCalledWith("s1");
  });

  it("sendMessage delegates to dialogueEngine", async () => {
    const input: SendMessageRequest = { text: "Hello" };
    const result = { reply: "Hi back" };
    mockDE.sendMessage.mockResolvedValue(result);
    await expect(service.sendMessage("s1", input)).resolves.toBe(result);
    expect(mockDE.sendMessage).toHaveBeenCalledWith("s1", input);
  });

  it("sendMessageStream delegates to dialogueEngine", () => {
    const input: SendMessageRequest = { text: "Hello" };
    mockDE.sendMessageStream.mockReturnValue((async function* () { yield "chunk1"; })());
    const result = service.sendMessageStream("s1", input);
    expect(result).toBeDefined();
    expect(mockDE.sendMessageStream).toHaveBeenCalledWith("s1", input);
  });

  it("updateScenario delegates to dialogueEngine", () => {
    const scenario: Scenario = { id: "sc1", title: "Updated", premise: "P", currentStage: "middle", stages: ["start", "middle"], stageDetails: [], currentGoal: "G", rules: [], initialStates: [] };
    const result = { gameState: {} as any };
    mockDE.updateScenario.mockReturnValue(result);
    expect(service.updateScenario("s1", scenario)).toBe(result);
    expect(mockDE.updateScenario).toHaveBeenCalledWith("s1", scenario);
  });

  it("restoreSession gets save and restores via dialogueEngine", () => {
    const gameState = { sessionId: "s1", round: 5 } as unknown as GameState;
    const messages: Message[] = [];
    const save = { sessionId: "s1", label: "Save", gameState, messages, createdAt: "", updatedAt: "" };
    const restoreResult = { sessionId: "s1", gameState, messages, characters: [], skills: [], knowledgeDocuments: [] };

    mockSS.get.mockReturnValue(save);
    mockDE.restoreSession.mockReturnValue(restoreResult);

    const result = service.restoreSession("pkg_001", "save_1");
    expect(result).toBe(restoreResult);
    expect(mockSS.get).toHaveBeenCalledWith("pkg_001", "save_1");
    expect(mockDE.restoreSession).toHaveBeenCalledWith("pkg_001", gameState, messages);
  });
});
