import { describe, it, expect, beforeEach } from "vitest";
import { GameStateService } from "../gameStateService.js";
import { ScenarioService } from "../scenarioService.js";
import type { Skill, LlmStoryOutput } from "@story-game/shared";

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
    { characterId: "qiaofeng" as const, hp: 100, mp: 50 },
    { characterId: "dingchunqiu" as const, hp: 80, mp: 30 }
  ]
};

const mockSkill: Skill = {
  id: "test_skill",
  name: "Test Skill",
  ownerId: "qiaofeng",
  cost: { mp: 10 },
  damage: { min: 15, max: 25 },
  effect: "Hurts",
  description: "A test skill"
};

const mockSkillNoDmg: Skill = {
  id: "defend",
  name: "Defend",
  ownerId: "qiaofeng",
  cost: { mp: 5 },
  effect: "Blocks",
  description: "Defensive"
};

function makeOutput(speakerId: "qiaofeng" | "dingchunqiu", stage?: string): LlmStoryOutput {
  return {
    speakerId,
    narration: "Acts",
    dialogue: "Hah!",
    action: { type: "skill", skillId: "test_skill", targetIds: ["dingchunqiu"] },
    stateDeltaSuggestion: {},
    ...(stage ? { stageSuggestion: stage } : {})
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
    const state = svc.createSession({ scenarioId: "test", characterIds: ["qiaofeng", "dingchunqiu"] });
    expect(state.sessionId).toMatch(/^session_/);
    expect(state.round).toBe(0);
    const qf = state.characters.find((c) => c.characterId === "qiaofeng");
    expect(qf?.hp).toBe(100);
    expect(qf?.mp).toBe(50);
  });

  it("applyAssistantTurn deducts mp and hp", () => {
    const state = svc.createSession({ scenarioId: "test", characterIds: ["qiaofeng", "dingchunqiu"] });
    const { state: newState, delta } = svc.applyAssistantTurn(state.sessionId, "qiaofeng", makeOutput("qiaofeng"), mockSkill);
    expect(newState.round).toBe(1);
    const qf = newState.characters.find((c) => c.characterId === "qiaofeng")!;
    expect(qf.mp).toBe(40);
    const dc = newState.characters.find((c) => c.characterId === "dingchunqiu")!;
    expect(dc.hp).toBeLessThan(80);
    expect(delta["qiaofeng.mp"]).toBe(-10);
    expect(delta["dingchunqiu.hp"]).toBeLessThan(0);
  });

  it("damage is within range over 50 trials", () => {
    const state = svc.createSession({ scenarioId: "test", characterIds: ["qiaofeng", "dingchunqiu"] });
    for (let i = 0; i < 50; i++) {
      const s = structuredClone(state);
      const { state: ns, delta } = svc.applyAssistantTurn(s.sessionId, "qiaofeng", makeOutput("qiaofeng"), mockSkill);
      const dmg = -(delta["dingchunqiu.hp"] ?? 0);
      expect(dmg).toBeGreaterThanOrEqual(15);
      expect(dmg).toBeLessThanOrEqual(25);
    }
  });

  it("defeat triggers completion", () => {
    const state = svc.createSession({ scenarioId: "test", characterIds: ["qiaofeng", "dingchunqiu"] });
    const dc = state.characters.find((c) => c.characterId === "dingchunqiu")!;
    dc.hp = 1;
    const bigSkill: Skill = { ...mockSkill, damage: { min: 100, max: 100 } };
    const { state: newState } = svc.applyAssistantTurn(state.sessionId, "qiaofeng", makeOutput("qiaofeng"), bigSkill);
    const dcAfter = newState.characters.find((c) => c.characterId === "dingchunqiu")!;
    expect(dcAfter.isDefeated).toBe(true);
    expect(newState.status).toBe("completed");
  });

  it("valid stageSuggestion advances stage", () => {
    const state = svc.createSession({ scenarioId: "test", characterIds: ["qiaofeng", "dingchunqiu"] });
    const { state: ns } = svc.applyAssistantTurn(state.sessionId, "qiaofeng", makeOutput("qiaofeng", "middle"), mockSkillNoDmg);
    expect(ns.scenario.currentStage).toBe("middle");
  });

  it("invalid stageSuggestion is ignored", () => {
    const state = svc.createSession({ scenarioId: "test", characterIds: ["qiaofeng", "dingchunqiu"] });
    const { state: ns } = svc.applyAssistantTurn(state.sessionId, "qiaofeng", makeOutput("qiaofeng", "nonexistent"), mockSkillNoDmg);
    expect(ns.scenario.currentStage).toBe("opening");
  });

  it("skill without damage works", () => {
    const state = svc.createSession({ scenarioId: "test", characterIds: ["qiaofeng", "dingchunqiu"] });
    const { state: ns } = svc.applyAssistantTurn(state.sessionId, "qiaofeng", makeOutput("qiaofeng"), mockSkillNoDmg);
    expect(ns.round).toBe(1);
  });
});
