import { describe, it, expect, beforeEach } from "vitest";
import { GameStateService } from "../gameStateService.js";
import { ScenarioService } from "../scenarioService.js";
import type { LlmStoryOutput } from "@story-game/shared";

const mockScenario = {
  id: "test",
  title: "Test",
  premise: "Test premise",
  currentStage: "opening",
  stages: ["opening", "middle", "end"],
  stageDetails: [],
  currentGoal: "Test goal",
  rules: [],
  initialStates: [
    { characterId: "qiaofeng", hp: 100, mp: 50 },
    { characterId: "dingchunqiu", hp: 80, mp: 30 },
  ],
};

function makeOutput(overrides: Partial<LlmStoryOutput> = {}): LlmStoryOutput {
  return {
    speakerId: "qiaofeng",
    narration: "Acts",
    dialogue: "Hah!",
    action: { type: "skill", skillId: "test_skill", targetIds: ["dingchunqiu"] },
    stateDeltaSuggestion: {},
    ...overrides,
  };
}

describe("GameStateService", () => {
  let svc: GameStateService;
  let scenarios: ScenarioService;

  beforeEach(() => {
    scenarios = new ScenarioService([structuredClone(mockScenario)]);
    svc = new GameStateService(scenarios);
  });

  it("creates session with initial states", () => {
    const state = svc.createSession({
      scenarioId: "test",
      characterIds: ["qiaofeng", "dingchunqiu"],
    });
    expect(state.sessionId).toMatch(/^session_/);
    expect(state.round).toBe(0);
    expect(state.status).toBe("active");
    expect(state.characters).toHaveLength(2);
    expect(state.characters[0].characterId).toBe("qiaofeng");
    expect(state.characters[0].hp).toBe(100);
  });

  it("get throws for unknown session", () => {
    expect(() => svc.get("nonexistent")).toThrow("Session not found");
  });

  it("restore loads saved state", () => {
    const state = svc.createSession({ scenarioId: "test", characterIds: ["qiaofeng"] });
    state.round = 10;
    svc.restore(state);
    const restored = svc.get(state.sessionId);
    expect(restored.round).toBe(10);
  });

  it("applyAssistantTurn advances round and sets lastSpeaker", () => {
    const state = svc.createSession({ scenarioId: "test", characterIds: ["qiaofeng"] });
    const output = makeOutput();
    const { state: ns } = svc.applyAssistantTurn(state.sessionId, "qiaofeng", output);
    expect(ns.round).toBe(1);
    expect(ns.lastSpeakerId).toBe("qiaofeng");
  });

  it("applyAssistantTurn applies stateDeltaSuggestion for HP", () => {
    const state = svc.createSession({ scenarioId: "test", characterIds: ["dingchunqiu"] });
    const output = makeOutput({ stateDeltaSuggestion: { "dingchunqiu.hp": -30 } });
    const { state: ns, delta } = svc.applyAssistantTurn(state.sessionId, "qiaofeng", output);
    expect(ns.characters[0].hp).toBe(50); // 80 - 30
    expect(delta["dingchunqiu.hp"]).toBe(-30);
  });

  it("applyAssistantTurn triggers defeat when HP reaches 0", () => {
    const state = svc.createSession({ scenarioId: "test", characterIds: ["dingchunqiu"] });
    const output = makeOutput({ stateDeltaSuggestion: { "dingchunqiu.hp": -100 } });
    const { state: ns } = svc.applyAssistantTurn(state.sessionId, "qiaofeng", output);
    expect(ns.characters[0].hp).toBe(0);
    expect(ns.characters[0].isDefeated).toBe(true);
    expect(ns.status).toBe("completed");
  });

  it("applyAssistantTurn applies stateDeltaSuggestion for MP", () => {
    const state = svc.createSession({ scenarioId: "test", characterIds: ["qiaofeng"] });
    const output = makeOutput({ stateDeltaSuggestion: { "qiaofeng.mp": -10 } });
    const { delta } = svc.applyAssistantTurn(state.sessionId, "qiaofeng", output);
    expect(delta["qiaofeng.mp"]).toBe(-10);
  });

  it("applyAssistantTurn changes stage when suggestion is valid", () => {
    const state = svc.createSession({ scenarioId: "test", characterIds: ["qiaofeng"] });
    const output = makeOutput({ stageSuggestion: "middle" });
    const { state: ns } = svc.applyAssistantTurn(state.sessionId, "qiaofeng", output);
    expect(ns.scenario.currentStage).toBe("middle");
  });

  it("applyAssistantTurn ignores invalid stage suggestion", () => {
    const state = svc.createSession({ scenarioId: "test", characterIds: ["qiaofeng"] });
    const output = makeOutput({ stageSuggestion: "nonexistent" });
    const { state: ns } = svc.applyAssistantTurn(state.sessionId, "qiaofeng", output);
    expect(ns.scenario.currentStage).toBe("opening");
  });
});
