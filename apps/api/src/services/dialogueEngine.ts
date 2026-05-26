import { nanoid } from "nanoid";
import type {
  CharacterId,
  Character,
  CreateSessionRequest,
  Message,
  Scenario,
  SendMessageRequest,
  StoryPackage
} from "@story-game/shared";
import { characterIds } from "@story-game/shared";
import type { LlmProvider } from "../resources/llm/llmProvider.js";
import { createModuleLogger } from "../utils/logger.js";
import type { AuditLogService } from "./auditLogService.js";
import { CharacterService } from "./characterService.js";
import { GameStateService } from "./gameStateService.js";
import { MemoryService } from "./memoryService.js";
import { PromptService } from "./promptService.js";
import { RuleChecker } from "./ruleChecker.js";
import { ScenarioService } from "./scenarioService.js";
import { SkillService } from "./skillService.js";
import { StoryPackageService } from "./storyPackageService.js";
import { KnowledgeBaseService } from "./knowledgeBaseService.js";

const logger = createModuleLogger("dialogueEngine");

const continueTexts = new Set(["继续", "接着", "然后呢", "continue", "go on"]);

export class DialogueEngine {
  private readonly sessionStoryPackageIds = new Map<string, string>();

  constructor(
    private readonly characters: CharacterService,
    private readonly skills: SkillService,
    private readonly scenarios: ScenarioService,
    private readonly memory: MemoryService,
    private readonly states: GameStateService,
    private readonly prompts: PromptService,
    private readonly rules: RuleChecker,
    private readonly llm: LlmProvider,
    private readonly storyPackages: StoryPackageService,
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly auditLog: AuditLogService
  ) {}

  createSession(input: CreateSessionRequest) {
    if (input.storyPackageId) {
      this.activateStoryPackage(input.storyPackageId);
      const storyPackage = this.storyPackages.get(input.storyPackageId);
      input.scenarioId = storyPackage.scenario.id;
      input.characterIds = storyPackage.characters.map((character) => character.id);
    }
    const gameState = this.states.createSession(input);
    if (input.storyPackageId) {
      this.sessionStoryPackageIds.set(gameState.sessionId, input.storyPackageId);
    }
    logger.info({ sessionId: gameState.sessionId, storyPackageId: input.storyPackageId }, "session created");
    this.auditLog.append({
      type: "session_created",
      sessionId: gameState.sessionId,
      summary: `Session created with story package ${input.storyPackageId ?? "default"}`
    });
    return { sessionId: gameState.sessionId, gameState, characters: this.characters.list(), skills: this.skills.list(), knowledgeDocuments: this.knowledgeBase.list() };
  }

  getSessionState(sessionId: string) {
    return { gameState: this.states.get(sessionId), characters: this.characters.list(), skills: this.skills.list(), knowledgeDocuments: this.knowledgeBase.list() };
  }

  getMessages(sessionId: string) {
    this.states.get(sessionId);
    return this.memory.list(sessionId);
  }

  getCharacters() {
    return { characters: this.characters.list(), skills: this.skills.list(), knowledgeDocuments: this.knowledgeBase.list() };
  }

  updateCharacter(characterId: CharacterId, character: Character) {
    return { character: this.characters.update(characterId, character), characters: this.characters.list() };
  }

  updateScenario(sessionId: string, scenario: Scenario) {
    return { gameState: this.states.updateScenario(sessionId, scenario) };
  }

  listStoryPackages() {
    return { storyPackages: this.storyPackages.list() };
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
    const userMessage = this.createMessage(sessionId, "user", null, input.text, [], {});
    this.memory.append(userMessage);

    const speakerId = this.selectSpeaker(sessionId, input);
    const state = this.states.get(sessionId);
    logger.info({ sessionId, speakerId, round: state.round }, "message processing");
    const storyPackageId = this.sessionStoryPackageIds.get(sessionId);
    const storyPackage = storyPackageId ? this.storyPackages.get(storyPackageId) : undefined;
    const prompt = this.prompts.buildPrompt(speakerId, state, this.memory.recent(sessionId), input.text, storyPackage);
    const rawOutput = await this.llm.complete({ speakerId, prompt });
    const output = this.rules.validateOutput(speakerId, rawOutput);
    const suggestedSkill = output.action.skillId ? this.skills.get(output.action.skillId) : undefined;
    const skill = suggestedSkill && suggestedSkill.ownerId === speakerId ? suggestedSkill : undefined;
    logger.debug({ sessionId, speakerId }, “llm response received”);
    this.auditLog.append({
      type: “llm_response”,
      sessionId,
      speakerId,
      summary: `LLM response from ${speakerId}${skill ? ` using ${skill.name}` : “”}`,
      details: { usedSkill: skill?.id ?? null, delta }
    });
    const { state: gameState, delta } = this.states.applyAssistantTurn(sessionId, speakerId, output, skill);
    if (gameState.status === “completed”) {
      logger.info({ sessionId }, “session completed”);
      this.auditLog.append({ type: “session_completed”, sessionId, summary: “Session completed” });
    }
    const content = `${output.narration}\n\n${this.characters.get(speakerId).name}：”${output.dialogue}”`;
    const message = this.createMessage(sessionId, “assistant”, speakerId, content, skill ? [skill.id] : [], delta);
    this.memory.append(message);

    return {
      message,
      gameState,
      debug: {
        selectedSpeakerId: speakerId,
        usedSkill: skill?.id ?? null,
        promptLayers: ["system", "groupRules", "persona", "skills", "scenario", "state", "history"],
        validation: "passed"
      }
    };
  }

  private selectSpeaker(sessionId: string, input: SendMessageRequest): CharacterId {
    if (input.targetCharacterId) return input.targetCharacterId;
    const mention = characterIds.find((id) => input.text.includes(`@${this.characters.get(id).name}`));
    if (mention) return mention;
    if (continueTexts.has(input.text.trim().toLowerCase())) {
      return this.randomSpeakerExcept(this.states.get(sessionId).lastSpeakerId);
    }
    return "qiaofeng";
  }

  private randomSpeakerExcept(lastSpeakerId: CharacterId | null): CharacterId {
    const candidates = characterIds.filter((id) => id !== lastSpeakerId);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private activateStoryPackage(storyPackageId: string) {
    const storyPackage = this.storyPackages.get(storyPackageId);
    this.characters.replaceAll(structuredClone(storyPackage.characters));
    this.skills.replaceAll(structuredClone(storyPackage.skills));
    this.knowledgeBase.replaceAll(structuredClone(storyPackage.knowledgeDocuments));
    this.scenarios.replaceAll([structuredClone(storyPackage.scenario)]);
  }

  async *sendMessageStream(sessionId: string, input: SendMessageRequest) {
    const userMessage = this.createMessage(sessionId, "user", null, input.text, [], {});
    this.memory.append(userMessage);

    const speakerId = this.selectSpeaker(sessionId, input);
    const state = this.states.get(sessionId);
    const storyPackageId = this.sessionStoryPackageIds.get(sessionId);
    const storyPackage = storyPackageId ? this.storyPackages.get(storyPackageId) : undefined;
    const prompt = this.prompts.buildPrompt(speakerId, state, this.memory.recent(sessionId), input.text, storyPackage);

    logger.info({ sessionId, speakerId, round: state.round }, "stream message processing");
    yield { type: "meta" as const, speakerId, speakerName: this.characters.get(speakerId).name };

    let rawBuffer = "";
    for await (const token of this.llm.stream({ speakerId, prompt })) {
      rawBuffer += token;
      yield { type: "token" as const, token, speakerId };
    }
    logger.debug({ sessionId, speakerId }, "stream response received");

    let rawOutput: unknown;
    try {
      rawOutput = JSON.parse(rawBuffer);
    } catch {
      rawOutput = { speakerId, narration: rawBuffer, dialogue: "", action: { type: "command" as const, targetIds: [] } };
    }

    const output = this.rules.validateOutput(speakerId, rawOutput);
    const suggestedSkill = output.action.skillId ? this.skills.get(output.action.skillId) : undefined;
    const skill = suggestedSkill && suggestedSkill.ownerId === speakerId ? suggestedSkill : undefined;
    const { state: gameState, delta } = this.states.applyAssistantTurn(sessionId, speakerId, output, skill);
    this.auditLog.append({
      type: "llm_response",
      sessionId,
      speakerId,
      summary: `LLM response from ${speakerId}${skill ? ` using ${skill.name}` : ""}`,
      details: { usedSkill: skill?.id ?? null, delta }
    });
    if (gameState.status === "completed") {
      logger.info({ sessionId }, "session completed");
      this.auditLog.append({ type: "session_completed", sessionId, summary: "Session completed" });
    }
    const content = `${output.narration}\n\n${this.characters.get(speakerId).name}："${output.dialogue}"`;
    const message = this.createMessage(sessionId, "assistant", speakerId, content, skill ? [skill.id] : [], delta);
    this.memory.append(message);

    yield {
      type: "done" as const,
      message,
      gameState,
      debug: {
        selectedSpeakerId: speakerId,
        usedSkill: skill?.id ?? null,
        promptLayers: ["system", "groupRules", "persona", "skills", "scenario", "state", "history"],
        validation: "passed"
      }
    };
  }

  private createMessage(
    sessionId: string,
    role: Message["role"],
    speakerId: CharacterId | null,
    content: string,
    usedSkills: string[],
    stateDelta: Message["stateDelta"]
  ): Message {
    return {
      id: `msg_${nanoid(10)}`,
      sessionId,
      role,
      speakerId,
      content,
      usedSkills,
      stateDelta,
      createdAt: new Date().toISOString()
    };
  }
}
