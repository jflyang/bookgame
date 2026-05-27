import type {
  CharacterId,
  Character,
  CreateSessionRequest,
  GameState,
  Message,
  Scenario,
  SendMessageRequest,
  StoryPackage
} from "@story-game/shared";
import { createModuleLogger } from "../utils/logger.js";
import type { AuditLogService } from "./auditLogService.js";
import { CharacterService } from "./characterService.js";
import { GameStateService } from "./gameStateService.js";
import { MemoryService } from "./memoryService.js";
import { ScenarioService } from "./scenarioService.js";
import { StoryPackageService } from "./storyPackageService.js";
import { KnowledgeBaseService } from "./knowledgeBaseService.js";
import { StoryPackageActivator } from "./storyPackageActivator.js";
import { TurnProcessor } from "./turnProcessor.js";
import type { SessionCollector } from "../modules/sessions/sessionCollector.js";

const logger = createModuleLogger("dialogueEngine");

export class DialogueEngine {
  constructor(
    private readonly characters: CharacterService,
    private readonly scenarios: ScenarioService,
    private readonly memory: MemoryService,
    private readonly states: GameStateService,
    private readonly storyPackages: StoryPackageService,
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly auditLog: AuditLogService,
    private readonly storyPackageActivator: StoryPackageActivator,
    private readonly turnProcessor: TurnProcessor,
    private readonly sessionStoryPackageIds = new Map<string, string>(),
    private readonly sessionCollector?: SessionCollector
  ) {}

  createSession(input: CreateSessionRequest) {
    let storyPackage: StoryPackage | undefined;
    if (input.storyPackageId) {
      storyPackage = this.storyPackageActivator.activate(input.storyPackageId);
      input.scenarioId = storyPackage!.scenario.id;
      input.characterIds = storyPackage!.characters.map((character) => character.id);
    }
    const gameState = this.states.createSession(input);
    if (input.storyPackageId) {
      this.sessionStoryPackageIds.set(gameState.sessionId, input.storyPackageId);
    }
    logger.info({
      sessionId: gameState.sessionId,
      storyPackageId: input.storyPackageId,
      characters: gameState.characters.map(c => `${c.characterId}(HP:${c.hp}/MP:${c.mp})`),
      scenario: gameState.scenario.title,
      stage: gameState.scenario.currentStage,
    }, "session created");
    this.auditLog.append({
      type: "session_created",
      sessionId: gameState.sessionId,
      summary: `Session created with story package ${input.storyPackageId ?? "default"}`
    });
    if (this.sessionCollector && storyPackage) {
      try {
        this.sessionCollector.create(gameState.sessionId, storyPackage, gameState);
      } catch (err) { logger.warn({ err }, "failed to persist session"); }
    }
    return { sessionId: gameState.sessionId, gameState, characters: this.characters.list(), skills: [] as any[], knowledgeDocuments: this.knowledgeBase.list() };
  }

  getSessionState(sessionId: string) {
    return { gameState: this.states.get(sessionId), characters: this.characters.list(), skills: [] as any[], knowledgeDocuments: this.knowledgeBase.list() };
  }

  getMessages(sessionId: string) {
    this.states.get(sessionId);
    return this.memory.list(sessionId);
  }

  restoreSession(storyPackageId: string, gameState: GameState, messages: Message[]) {
    this.storyPackageActivator.activate(storyPackageId);
    this.sessionStoryPackageIds.set(gameState.sessionId, storyPackageId);
    // Restore game state
    this.states.restore(gameState);
    // Restore messages
    this.memory.restore(gameState.sessionId, messages);
    logger.info({ sessionId: gameState.sessionId, storyPackageId }, "session restored");
    if (this.sessionCollector) {
      try {
        const storyPackage = this.storyPackages.get(storyPackageId);
        this.sessionCollector.restore(gameState.sessionId, storyPackageId, storyPackage.title, gameState, messages.length);
      } catch (err) { logger.warn({ err }, "failed to persist restored session"); }
    }
    return { sessionId: gameState.sessionId, gameState, messages, characters: this.characters.list(), skills: [] as any[], knowledgeDocuments: this.knowledgeBase.list() };
  }

  getCharacters() {
    return { characters: this.characters.list(), skills: [] as any[], knowledgeDocuments: this.knowledgeBase.list() };
  }

  updateCharacter(characterId: CharacterId, character: Character) {
    const result = { character: this.characters.update(characterId, character), characters: this.characters.list() };
    // Persist back to the owning story package
    for (const pkg of this.storyPackages.list()) {
      const idx = pkg.characters.findIndex((c) => c.id === characterId);
      if (idx !== -1) {
        pkg.characters[idx] = character;
        pkg.updatedAt = new Date().toISOString();
        this.storyPackages.upsert(pkg);
        break;
      }
    }
    return result;
  }

  updateScenario(sessionId: string, scenario: Scenario) {
    return { gameState: this.states.updateScenario(sessionId, scenario) };
  }

  listStoryPackages(includeHidden?: boolean) {
    return { storyPackages: this.storyPackages.list({ includeHidden }) };
  }

  createStoryPackage(title: string, sourcePackageId?: string) {
    return {
      storyPackage: this.storyPackages.create(title, sourcePackageId),
      storyPackages: this.storyPackages.list()
    };
  }

  updateStoryPackage(storyPackage: StoryPackage) {
    return {
      storyPackage: this.storyPackages.upsert(storyPackage),
      storyPackages: this.storyPackages.list()
    };
  }

  deleteStoryPackage(id: string) {
    return {
      removed: this.storyPackages.delete(id),
      storyPackages: this.storyPackages.list()
    };
  }

  async sendMessage(sessionId: string, input: SendMessageRequest) {
    const result = await this.turnProcessor.sendMessage(sessionId, input);
    if (this.sessionCollector) {
      try {
        const messages = this.memory.list(sessionId);
        this.sessionCollector.markActive(sessionId, result.gameState, messages.length);
      } catch (err) { logger.warn({ err }, "failed to update session after turn"); }
    }
    return result;
  }

  async *sendMessageStream(sessionId: string, input: SendMessageRequest) {
    yield* this.turnProcessor.sendMessageStream(sessionId, input);
    if (this.sessionCollector) {
      try {
        const gameState = this.states.get(sessionId);
        const messages = this.memory.list(sessionId);
        this.sessionCollector.markActive(sessionId, gameState, messages.length);
      } catch (err) { logger.warn({ err }, "failed to update session after stream"); }
    }
  }
}
