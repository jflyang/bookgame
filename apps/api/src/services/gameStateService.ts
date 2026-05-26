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

  constructor(private readonly scenarios: ScenarioService) {}

  createSession(input: CreateSessionRequest) {
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

  applyAssistantTurn(sessionId: string, speakerId: CharacterId, output: LlmStoryOutput, skill?: Skill) {
    const state = this.get(sessionId);
    const delta: StateDelta = {};
    if (skill) {
      this.applySkillDelta(state.characters, speakerId, skill, delta);
    }
    if (output.stageSuggestion && state.scenario.stages.includes(output.stageSuggestion)) {
      state.scenario.currentStage = output.stageSuggestion;
    }
    state.round += 1;
    state.lastSpeakerId = speakerId;
    state.updatedAt = new Date().toISOString();
    state.status = state.characters.some((item) => item.characterId === "dingchunqiu" && item.isDefeated)
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

  private applySkillDelta(states: CharacterState[], speakerId: CharacterId, skill: Skill, delta: StateDelta) {
    const actor = states.find((item) => item.characterId === speakerId);
    if (!actor) return;
    const mpCost = Math.min(actor.mp, skill.cost.mp);
    actor.mp -= mpCost;
    delta[`${speakerId}.mp`] = -mpCost;

    if (!skill.damage) return;
    const targetId: CharacterId = speakerId === "dingchunqiu" ? "xuzhu" : "dingchunqiu";
    const target = states.find((item) => item.characterId === targetId);
    if (!target) return;
    const damage = skill.damage.min + Math.floor(Math.random() * (skill.damage.max - skill.damage.min + 1));
    target.hp = Math.max(0, target.hp - damage);
    target.isDefeated = target.hp <= 0;
    delta[`${targetId}.hp`] = -damage;
  }
}
