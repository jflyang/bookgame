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
import type { SpeakerSelector } from "./speakerSelector.js";
import type { SkillIndex } from "./skillIndex.js";
import type { RuntimeStatsCollector } from "../modules/runtime-stats/runtimeStatsCollector.js";

const logger = createModuleLogger("turnProcessor");

/** Incrementally extracts narration + dialogue text from a streaming JSON buffer.
 *  Falls back to raw pass-through when the buffer doesn't look like JSON. */
class StreamContentExtractor {
  private emitted = 0;
  private buf = "";
  private detectedJson = false;

  feed(chunk: string): string {
    this.buf += chunk;
    // Detect JSON early
    if (!this.detectedJson && /\{"speakerId"\s*:/.test(this.buf)) {
      this.detectedJson = true;
    }
    if (!this.detectedJson) return chunk; // pass-through until JSON confirmed

    const full = extractNarrationDialogue(this.buf);
    if (full.length <= this.emitted) return "";
    const delta = full.slice(this.emitted);
    this.emitted = full.length;
    return delta;
  }
}

function extractNarrationDialogue(raw: string): string {
  // Simple JSON string extraction: find "narration":"..." and "dialogue":"..."
  const out: string[] = [];
  for (const key of ["narration", "dialogue"]) {
    const re = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"?`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      out.push(unescapeJsonString(m[1]));
    }
  }
  return out.join("\n\n");
}

function unescapeJsonString(s: string): string {
  return s.replace(/\\(.)/g, (_match, char) => {
    if (char === "n") return "\n";
    if (char === "t") return "\t";
    if (char === "r") return "\r";
    return char; // \" \\ \/ etc
  });
}

export class TurnProcessor {
  constructor(
    private readonly characters: CharacterService,
    private readonly memory: MemoryService,
    private readonly states: GameStateService,
    private readonly prompts: PromptService,
    private readonly rules: RuleChecker,
    private readonly llm: LlmProvider,
    private readonly auditLog: AuditLogService,
    private readonly speakerSelector: SpeakerSelector,
    private readonly stats: RuntimeStatsCollector,
    private readonly skills: SkillIndex,
    private readonly getStoryPackageForSession: (sessionId: string) => StoryPackage | undefined
  ) {}

  async sendMessage(sessionId: string, input: SendMessageRequest) {
    const { speakerId, state, storyPackage } = this.prepareTurn(sessionId, input);
    const round = state.round;
    const stageBefore = state.scenario.currentStage;
    const speakerName = this.characters.get(speakerId).name;
    const prompt = this.prompts.buildPrompt(speakerId, state, this.memory.recent(sessionId), input.text, storyPackage);
    logger.debug({ sessionId, promptLength: prompt.length }, "prompt built");

    return this.states.withLock(sessionId, async () => {
      const startTime = Date.now();
      let llmResult: Awaited<ReturnType<typeof this.llm.complete>> | undefined;
      let latency = 0;

      try {
        llmResult = await this.llm.complete({ speakerId, prompt });
        latency = Date.now() - startTime;
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
          rawLlmResponse: llmResult?.raw ?? "",
          parsedOutput: null,
          validationResult: "failed",
          validationErrors,
          stateDelta: null,
          stageBefore,
          stageAfter: stageBefore,
          latencyMs: latency,
          tokenUsage: llmResult?.usage ?? null,
          timestamp: new Date().toISOString(),
        });
        throw err;
      }
    });
  }

  async *sendMessageStream(sessionId: string, input: SendMessageRequest) {
    const { speakerId, state, storyPackage } = this.prepareTurn(sessionId, input);
    const round = state.round;
    const stageBefore = state.scenario.currentStage;
    const speakerName = this.characters.get(speakerId).name;
    const prompt = this.prompts.buildPrompt(speakerId, state, this.memory.recent(sessionId), input.text, storyPackage);

    logger.info({ sessionId, speakerId, round: state.round }, "stream message processing");
    yield { type: "meta" as const, speakerId, speakerName };

    // Acquire lock to prevent concurrent state mutations
    const streamResult = await this.states.withLock(sessionId, async () => {
      const streamStart = Date.now();
      let rawBuffer = "";
      const extractor = new StreamContentExtractor();
      const tokens: Array<{ type: "token"; token: string; speakerId: string }> = [];
      try {
        for await (const token of this.llm.stream({ speakerId, prompt })) {
          rawBuffer += token;
          const displayText = extractor.feed(token);
          if (displayText) {
            tokens.push({ type: "token", token: displayText, speakerId });
          }
        }
      } catch (streamErr) {
        const latency = Date.now() - streamStart;
        this.stats.recordCompleteTurn({
          sessionId, round, speakerId, speakerName, prompt,
          rawLlmResponse: rawBuffer, parsedOutput: null,
          validationResult: "failed",
          validationErrors: [String(streamErr)],
          stateDelta: null, stageBefore, stageAfter: stageBefore,
          latencyMs: latency, tokenUsage: null,
          timestamp: new Date().toISOString(),
        });
        throw streamErr;
      }
      const latency = Date.now() - streamStart;
      logger.debug({ sessionId, speakerId }, "stream response received");

      let rawOutput: unknown;
      try {
        rawOutput = JSON.parse(rawBuffer);
      } catch (parseErr) {
        logger.warn({ parseErr, rawBufferPreview: rawBuffer.slice(0, 200) }, "LLM returned non-JSON output, using fallback");
        rawOutput = { speakerId, narration: rawBuffer, dialogue: rawBuffer.slice(0, 50), action: { type: "observe" as const, targetIds: [] } };
      }

      try {
        const result = this.applyOutput(sessionId, speakerId, rawOutput);
        this.stats.recordCompleteTurn({
          sessionId, round, speakerId, speakerName, prompt,
          rawLlmResponse: rawBuffer, parsedOutput: rawOutput,
          validationResult: "passed", validationErrors: [],
          stateDelta: result.message.stateDelta, stageBefore,
          stageAfter: result.gameState.scenario.currentStage,
          latencyMs: latency, tokenUsage: null,
          timestamp: new Date().toISOString(),
        });
        return { tokens, done: { type: "done" as const, ...result } };
      } catch (err) {
        const validationErrors =
          err && typeof err === "object" && "issues" in err
            ? (err as { issues: unknown[] }).issues
            : [String(err)];
        this.stats.recordCompleteTurn({
          sessionId, round, speakerId, speakerName, prompt,
          rawLlmResponse: rawBuffer, parsedOutput: null,
          validationResult: "failed", validationErrors,
          stateDelta: null, stageBefore, stageAfter: stageBefore,
          latencyMs: latency, tokenUsage: null,
          timestamp: new Date().toISOString(),
        });
        throw err;
      }
    });

    // Yield tokens and final result outside the lock
    for (const token of streamResult.tokens) {
      yield token;
    }
    yield streamResult.done;
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
    const rosterIds = this.characters.list().map((c) => c.id);
    const output = this.rules.validateOutput(speakerId, rawOutput, rosterIds);
    const effectiveSpeakerId = output.speakerId;
    const speaker = this.characters.get(effectiveSpeakerId);
    const usedSkill = this.resolveSkillDamage(effectiveSpeakerId, output);

    logger.info({
      sessionId,
      speakerId: effectiveSpeakerId,
      speakerName: speaker.name,
      selectedSpeakerId: speakerId !== effectiveSpeakerId ? speakerId : undefined,
      actionType: output.action.type,
      skillId: usedSkill?.id ?? null,
      deltaSuggestion: output.stateDeltaSuggestion,
      narrationPreview: output.narration.slice(0, 80),
      dialoguePreview: output.dialogue.slice(0, 80),
      stageSuggestion: output.stageSuggestion
    }, "llm response");

    const { state: gameState, delta } = this.states.applyAssistantTurn(sessionId, effectiveSpeakerId, output);
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
      speakerId: effectiveSpeakerId,
      summary: `${speaker.name} → ${output.narration.slice(0, 50)}`,
      details: { delta, narration: output.narration, dialogue: output.dialogue }
    });
    if (gameState.status === "completed") {
      logger.info({ sessionId }, "session completed");
      this.auditLog.append({ type: "session_completed", sessionId, summary: "Session completed" });
    }

    const combatLine = this.formatCombatLine(speaker, usedSkill, output);
    const content = `${output.narration}\n\n${speaker.name}："${output.dialogue}"${combatLine}`;
    const usedSkillIds = usedSkill ? [usedSkill.id] : [];
    const message = this.createMessage(sessionId, "assistant", effectiveSpeakerId, content, usedSkillIds, delta);
    this.memory.append(message);

    return {
      message,
      gameState,
      debug: {
        selectedSpeakerId: speakerId,
        effectiveSpeakerId,
        speakerOverridden: speakerId !== effectiveSpeakerId,
        usedSkill: usedSkill?.name ?? null,
        promptLayers: ["system", "groupRules", "persona", "scenario", "state", "history"],
        validation: "passed"
      }
    };
  }

  private resolveSkillDamage(speakerId: CharacterId, output: { action: { type: string; skillId?: string | null; targetIds: string[] }; stateDeltaSuggestion: Record<string, number> }) {
    if (output.action.type !== "skill" || !output.action.skillId) return undefined;
    const skill = this.skills.get(output.action.skillId);
    if (!skill) {
      logger.warn({ speakerId, unknownSkillId: output.action.skillId, availableIds: this.skills.list().map(s => s.id) }, "LLM used unknown skillId — no damage applied");
      return undefined;
    }

    const dmg = skill.damage
      ? Math.floor(Math.random() * (skill.damage.max - skill.damage.min + 1)) + skill.damage.min
      : 0;
    const mpCost = skill.cost.mp;

    if (mpCost > 0 && mpCost < 999) {
      output.stateDeltaSuggestion[`${speakerId}_mp`] = -mpCost;
    }

    // Remove any self-HP the LLM incorrectly set on the speaker
    const selfHpKey = `${speakerId}_hp`;
    if (output.stateDeltaSuggestion[selfHpKey] !== undefined && !output.action.targetIds.includes(speakerId)) {
      delete output.stateDeltaSuggestion[selfHpKey];
    }

    // If the LLM forgot to specify targets for a damage skill, use character's attackable targets
    let targetIds = output.action.targetIds;
    if (targetIds.length === 0 && skill.damage && dmg > 0) {
      const allChars = this.characters.list();
      const speakerChar = allChars.find((c) => c.id === speakerId);
      const attackableIds = speakerChar?.attackableTargetIds ?? [];
      const enemy = allChars.find((c) => attackableIds.includes(c.id) && c.id !== speakerId)
        ?? allChars.find((c) => c.id !== speakerId);
      if (enemy) {
        targetIds = [enemy.id];
        logger.warn({ speakerId, skillId: skill.id, fallbackTarget: enemy.id, source: "attackableTargetIds" }, "LLM omitted targetIds, falling back to character's attackable target");
      }
    }

    for (const targetId of targetIds) {
      if (skill.damage) {
        output.stateDeltaSuggestion[`${targetId}_hp`] = -dmg;
      }
    }

    return skill;
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

  private formatCombatLine(
    speaker: { name: string },
    skill: { name: string; cost: { mp: number }; damage?: { min: number; max: number } } | undefined,
    output: { action: { type: string; targetIds: string[] }; stateDeltaSuggestion: Record<string, number> }
  ): string {
    const roster = this.characters.list();
    const parts: string[] = [];

    if (skill) {
      parts.push(`⚔ ${speaker.name} 施展【${skill.name}】`);

      // Show target and HP damage
      for (const targetId of output.action.targetIds) {
        const targetName = roster.find((c) => c.id === targetId)?.name ?? targetId;
        const hpDelta = output.stateDeltaSuggestion[`${targetId}_hp`];
        if (hpDelta !== undefined && hpDelta < 0) {
          parts.push(`→ ${targetName} 气血${hpDelta}`);
        }
      }

      // Show MP cost
      const speakerId = roster.find((c) => c.name === speaker.name)?.id;
      if (speakerId) {
        const mpDelta = output.stateDeltaSuggestion[`${speakerId}_mp`];
        if (mpDelta !== undefined && mpDelta < 0) {
          parts.push(`｜ ${speaker.name} 内力${mpDelta}`);
        }
      }
    }

    return parts.length > 0 ? `\n\n${parts.join(" ")}` : "";
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
