import { nanoid } from "nanoid";
import type {
  CharacterId,
  CharacterState,
  CreateSessionRequest,
  GameState,
  LlmStoryOutput,
  Scenario,
  Skill,
  StateDelta
} from "@story-game/shared";
import { ScenarioService } from "./scenarioService.js";
import { createModuleLogger } from "../utils/logger.js";

const logger = createModuleLogger("gameState");

export class GameStateService {
  private readonly states = new Map<string, GameState>();
  private readonly locks = new Map<string, Promise<void>>();
  private readonly maxSessions: number;

  constructor(
    private readonly scenarios: ScenarioService,
    maxSessions = 1000
  ) {
    this.maxSessions = maxSessions;
  }

  createSession(input: CreateSessionRequest) {
    if (this.states.size >= this.maxSessions) {
      const oldest = [...this.states.entries()].sort(
        ([, a], [, b]) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      )[0];
      if (oldest) this.cleanupSession(oldest[0]);
    }

    const sessionId = `session_${nanoid(10)}`;
    const now = new Date().toISOString();
    const state: GameState = {
      sessionId,
      scenarioId: input.scenarioId,
      round: 0,
      lastSpeakerId: null,
      status: "active",
      scenario: this.scenarios.get(input.scenarioId),
      characters: [],
      createdAt: now,
      updatedAt: now
    };
    state.characters = input.characterIds.map((characterId) => this.initialCharacterState(characterId, state.scenario.initialStates));
    this.states.set(sessionId, state);
    logger.info({ sessionId }, "game state initialized");
    return state;
  }

  get(sessionId: string) {
    const state = this.states.get(sessionId);
    if (!state) throw new Error(`Session not found: ${sessionId}`);
    return state;
  }

  updateScenario(sessionId: string, scenario: Scenario) {
    const state = this.get(sessionId);
    state.scenario = scenario;
    state.updatedAt = new Date().toISOString();
    return state;
  }

  restore(gameState: GameState) {
    this.cleanupSession(gameState.sessionId);
    this.states.set(gameState.sessionId, structuredClone(gameState));
  }

  cleanupSession(sessionId: string) {
    this.states.delete(sessionId);
    this.locks.delete(sessionId);
  }

  async withLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(sessionId) ?? Promise.resolve();
    const next = prev.catch((err) => { logger.warn({ err, sessionId }, "previous lock operation failed, continuing"); }).then(() => fn());
    this.locks.set(sessionId, next.then(() => {}, () => {}) as Promise<void>);
    return next;
  }

  applyAssistantTurn(sessionId: string, speakerId: CharacterId, output: LlmStoryOutput) {
    const state = this.get(sessionId);
    const delta: StateDelta = {};
    this.applyStateDeltaSuggestion(state.characters, output.stateDeltaSuggestion, delta, state.scenario.initialStates);
    if (output.stageSuggestion && state.scenario.stages.includes(output.stageSuggestion)) {
      state.scenario.currentStage = output.stageSuggestion;
    }
    state.round += 1;
    state.lastSpeakerId = speakerId;
    state.updatedAt = new Date().toISOString();
    state.status = state.characters.some((item) => item.isDefeated)
      ? "completed"
      : "active";
    logger.debug({ sessionId, speakerId, round: state.round, delta }, "turn applied");
    return { state, delta };
  }

  private initialCharacterState(characterId: CharacterId, initialStates: GameState["scenario"]["initialStates"]): CharacterState {
    const configured = initialStates.find((item) => item.characterId === characterId);
    const base = configured ? { hp: configured.hp, mp: configured.mp } : { hp: 120, mp: 120 };
    return { characterId, ...base, conditions: [], isDefeated: false };
  }

  private applyStateDeltaSuggestion(
    states: CharacterState[],
    suggestion: Record<string, number>,
    delta: StateDelta,
    initialStates: GameState["scenario"]["initialStates"],
  ) {
    for (const [key, value] of Object.entries(suggestion)) {
      if (typeof value !== "number" || value === 0) continue;
      // Parse key format: "characterId_hp", "characterId.mp", or bare "hp"/"mp"
      let charId: string | undefined;
      let attr: string;
      const match = key.match(/^(.+?)[._](hp|mp)$/i);
      if (match) {
        charId = match[1];
        attr = match[2].toLowerCase();
      } else if (/^(hp|mp)$/i.test(key)) {
        // Bare key: apply to first matching character
        attr = key.toLowerCase();
        charId = states[0]?.characterId;
      } else {
        continue;
      }
      const char = states.find((s) => s.characterId === charId);
      if (!char) continue;
      const maxVal = initialStates.find((s) => s.characterId === charId);
      if (attr === "hp") {
        const maxHp = maxVal?.hp ?? char.hp;
        char.hp = Math.min(maxHp, Math.max(0, char.hp + value));
        char.isDefeated = char.hp <= 0;
      } else if (attr === "mp") {
        const maxMp = maxVal?.mp ?? char.mp;
        char.mp = Math.min(maxMp, Math.max(0, char.mp + value));
      }
      delta[key] = (delta[key] ?? 0) + value;
    }
  }
}
