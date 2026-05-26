import type { CreateSessionRequest, Scenario, SendMessageRequest } from "@story-game/shared";
import type { DialogueEngine } from "../services/dialogueEngine.js";
import type { SessionSaveService } from "../services/sessionSaveService.js";

export class GameApplicationService {
  constructor(
    private readonly dialogueEngine: DialogueEngine,
    private readonly sessionSaves: SessionSaveService
  ) {}

  createSession(input: CreateSessionRequest) {
    return this.dialogueEngine.createSession(input);
  }

  getSessionState(sessionId: string) {
    return this.dialogueEngine.getSessionState(sessionId);
  }

  getMessages(sessionId: string) {
    return { messages: this.dialogueEngine.getMessages(sessionId) };
  }

  sendMessage(sessionId: string, input: SendMessageRequest) {
    return this.dialogueEngine.sendMessage(sessionId, input);
  }

  updateScenario(sessionId: string, scenario: Scenario) {
    return this.dialogueEngine.updateScenario(sessionId, scenario);
  }

  sendMessageStream(sessionId: string, input: SendMessageRequest) {
    return this.dialogueEngine.sendMessageStream(sessionId, input);
  }

  restoreSession(storyPackageId: string, saveId: string) {
    const save = this.sessionSaves.get(storyPackageId, saveId);
    return this.dialogueEngine.restoreSession(storyPackageId, save.gameState, save.messages);
  }
}
