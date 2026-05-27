import { nanoid } from "nanoid";
import type { CharacterId, Message, SendMessageRequest, StoryPackage } from "@story-game/shared";
import type { LlmCompletionResult, LlmProvider } from "../resources/llm/llmProvider.js";
import { createModuleLogger } from "../utils/logger.js";
import type { AuditLogService } from "./auditLogService.js";
import type { CharacterService } from "./characterService.js";
import type { GameStateService } from "./gameStateService.js";
import type { MemoryService } from "./memoryService.js";
import type { PromptService } from "./promptService.js";
import type { RuleChecker } from "./ruleChecker.js";
import type { SkillService } from "./skillService.js";
import type { SpeakerSelector } from "./speakerSelector.js";
import type { RuntimeStatsCollector } from "../modules/runtime-stats/runtimeStatsCollector.js";

const logger = createModuleLogger("turnProcessor");

export class TurnProcessor {
  constructor(
    private readonly characters: CharacterService,
    private readonly skills: SkillService,
    private readonly memory: MemoryService,
    private readonly states: GameStateService,
    private readonly prompts: PromptService,
    private readonly rules: RuleChecker,
    private readonly llm: LlmProvider,
    private readonly auditLog: AuditLogService,
    private readonly speakerSelector: SpeakerSelector,
    private readonly stats: RuntimeStatsCollector,
    private readonly getStoryPackageForSession: (sessionId: string) => StoryPackage | undefined
  ) {}

  async sendMessage(sessionId: string, input: SendMessageRequest) {
    const { speakerId, state, storyPackage } = this.prepareTurn(sessionId, input);
    const round = state.round;
    const stageBefore = state.scenario.currentStage;
    const speakerName = this.characters.get(speakerId).name;
    const prompt = this.prompts.buildPrompt(speakerId, state, this.memory.recent(sessionId), input.text, storyPackage);
    logger.debug({ sessionId, promptLength: prompt.length }, "prompt built");

    const startTime = Date.now();
    const llmResult = await this.llm.complete({ speakerId, prompt });
    const latency = Date.now() - startTime;

    try {
      const result = this.applyOutput(sessionId, speakerId, llmResult.output);
      this.stats.recordCompleteTurn({
        sessionId,
        round,
        speakerId,
        speakerName,
        prompt,
        rawLlmResponse: llmResult.raw,
        parsedOutput: llmResult.output,
        validationResult: "passed",
        validationErrors: [],
        stateDelta: result.message.stateDelta,
        stageBefore,
        stageAfter: result.gameState.scenario.currentStage,
        latencyMs: latency,
        tokenUsage: llmResult.usage ?? null,
        timestamp: new Date().toISOString(),
      });
      return result;
    } catch (err) {
      const validationErrors =
        err && typeof err === "object" && "issues" in err
          ? (err as { issues: unknown[] }).issues
          : [String(err)];
      this.stats.recordCompleteTurn({
        sessionId,
        round,
        speakerId,
        speakerName,
        prompt,
        rawLlmResponse: llmResult.raw,
        parsedOutput: null,
        validationResult: "failed",
        validationErrors,
        stateDelta: null,
        stageBefore,
        stageAfter: stageBefore,
        latencyMs: latency,
        tokenUsage: llmResult.usage ?? null,
        timestamp: new Date().toISOString(),
      });
      throw err;
    }
  }

  async *sendMessageStream(sessionId: string, input: SendMessageRequest) {
    const { speakerId, state, storyPackage } = this.prepareTurn(sessionId, input);
    const round = state.round;
    const stageBefore = state.scenario.currentStage;
    const speakerName = this.characters.get(speakerId).name;
    const prompt = this.prompts.buildPrompt(speakerId, state, this.memory.recent(sessionId), input.text, storyPackage);

    logger.info({ sessionId, speakerId, round: state.round }, "stream message processing");
    yield { type: "meta" as const, speakerId, speakerName };

    const streamStart = Date.now();
    let rawBuffer = "";
    for await (const token of this.llm.stream({ speakerId, prompt })) {
      rawBuffer += token;
      yield { type: "token" as const, token, speakerId };
    }
    const latency = Date.now() - streamStart;
    logger.debug({ sessionId, speakerId }, "stream response received");

    let parsedOutput: unknown;
    let rawOutput: unknown;
    try {
      rawOutput = JSON.parse(rawBuffer);
    } catch {
      rawOutput = { speakerId, narration: rawBuffer, dialogue: "", action: { type: "command" as const, targetIds: [] } };
    }

    try {
      const result = this.applyOutput(sessionId, speakerId, rawOutput);
      this.stats.recordCompleteTurn({
        sessionId,
        round,
        speakerId,
        speakerName,
        prompt,
        rawLlmResponse: rawBuffer,
        parsedOutput: rawOutput,
        validationResult: "passed",
        validationErrors: [],
        stateDelta: result.message.stateDelta,
        stageBefore,
        stageAfter: result.gameState.scenario.currentStage,
        latencyMs: latency,
        tokenUsage: null,
        timestamp: new Date().toISOString(),
      });
      yield { type: "done" as const, ...result };
    } catch (err) {
      const validationErrors =
        err && typeof err === "object" && "issues" in err
          ? (err as { issues: unknown[] }).issues
          : [String(err)];
      this.stats.recordCompleteTurn({
        sessionId,
        round,
        speakerId,
        speakerName,
        prompt,
        rawLlmResponse: rawBuffer,
        parsedOutput: null,
        validationResult: "failed",
        validationErrors,
        stateDelta: null,
        stageBefore,
        stageAfter: stageBefore,
        latencyMs: latency,
        tokenUsage: null,
        timestamp: new Date().toISOString(),
      });
      throw err;
    }
  }

  private prepareTurn(sessionId: string, input: SendMessageRequest) {
    const userMessage = this.createMessage(sessionId, "user", null, input.text, [], {});
    this.memory.append(userMessage);

    const storyPackage = this.getStoryPackageForSession(sessionId);
    const speakerId = this.speakerSelector.select(sessionId, input, storyPackage?.scenario.defaultSpeakerId);
    const speaker = this.characters.get(speakerId);
    const state = this.states.get(sessionId);

    logger.info({
      sessionId,
      speakerId,
      speakerName: speaker.name,
      round: state.round,
      stage: state.scenario.currentStage,
      characters: state.characters.map((c) => `${c.characterId}(HP:${c.hp}/MP:${c.mp})`),
      userInput: input.text,
      historyCount: this.memory.list(sessionId).length
    }, "turn start");

    return { speakerId, state, storyPackage };
  }

  private applyOutput(sessionId: string, speakerId: CharacterId, rawOutput: unknown) {
    const speaker = this.characters.get(speakerId);
    const output = this.rules.validateOutput(speakerId, rawOutput);
    const suggestedSkill = output.action.skillId ? this.skills.get(output.action.skillId) : undefined;
    const skill = suggestedSkill && suggestedSkill.ownerId === speakerId ? suggestedSkill : undefined;

    logger.info({
      sessionId,
      speakerId,
      speakerName: speaker.name,
      skillUsed: skill?.name ?? "none",
      actionType: output.action.type,
      narrationPreview: output.narration.slice(0, 80),
      dialoguePreview: output.dialogue.slice(0, 80),
      stageSuggestion: output.stageSuggestion
    }, "llm response");

    const { state: gameState, delta } = this.states.applyAssistantTurn(sessionId, speakerId, output, skill);
    logger.info({
      sessionId,
      round: gameState.round,
      status: gameState.status,
      delta,
      charactersAfter: gameState.characters.map((c) => `${c.characterId}(HP:${c.hp}/MP:${c.mp}${c.isDefeated ? "/DEFEATED" : ""})`)
    }, "state updated");

    this.auditLog.append({
      type: "llm_response",
      sessionId,
      speakerId,
      summary: `${speaker.name}${skill ? ` 使用${skill.name}` : ""} → ${output.narration.slice(0, 50)}`,
      details: { usedSkill: skill?.id ?? null, delta, narration: output.narration, dialogue: output.dialogue }
    });
    if (gameState.status === "completed") {
      logger.info({ sessionId }, "session completed");
      this.auditLog.append({ type: "session_completed", sessionId, summary: "Session completed" });
    }

    const statusLine = this.formatStatusLine(gameState);
    const content = `${output.narration}\n\n${speaker.name}：“${output.dialogue}”\n\n${statusLine}`;
    const message = this.createMessage(sessionId, "assistant", speakerId, content, skill ? [skill.id] : [], delta);
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

  private formatStatusLine(gameState: { characters: Array<{ characterId: CharacterId; hp: number; mp: number }> }) {
    const roster = this.characters.list();
    const parts = gameState.characters.map((state) => {
      const name = roster.find((character) => character.id === state.characterId)?.name ?? state.characterId;
      return `${name} 气血:${state.hp} 内力:${state.mp}`;
    });
    return `[状态] ${parts.join(" | ")}`;
  }
}
