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

  restoreSession(storyPackageId: string, saveId?: string, slot?: number) {
    let save: ReturnType<typeof this.sessionSaves.getBySlot>;
    if (slot !== undefined) {
      save = this.sessionSaves.getBySlot(storyPackageId, slot);
    } else if (saveId) {
      save = this.sessionSaves.get(storyPackageId, saveId);
    } else {
      throw new Error("Either saveId or slot must be provided");
    }
    return this.dialogueEngine.restoreSession(storyPackageId, save.gameState, save.messages);
  }
}
