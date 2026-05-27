import { describe, it, expect, beforeEach } from "vitest";
import { ScenarioService } from "../scenarioService.js";
import type { Scenario } from "@story-game/shared";

const mockScenario: Scenario = {
  id: "sc1",
  title: "Test Story",
  premise: "A test premise",
  currentStage: "start",
  stages: ["start", "middle", "end"],
  stageDetails: [],
  currentGoal: "Win",
  rules: [],
  initialStates: [],
};

const mockScenario2: Scenario = {
  id: "sc2",
  title: "Second Story",
  premise: "Another premise",
  currentStage: "opening",
  stages: ["opening"],
  stageDetails: [],
  currentGoal: "Survive",
  rules: [],
  initialStates: [],
};

describe("ScenarioService", () => {
  let svc: ScenarioService;

  beforeEach(() => {
    svc = new ScenarioService(structuredClone([mockScenario, mockScenario2]));
  });

  it("list returns all scenarios", () => {
    expect(svc.list()).toHaveLength(2);
  });

  it("get returns scenario by id", () => {
    const scenario = svc.get("sc1");
    expect(scenario.title).toBe("Test Story");
    expect(scenario.currentGoal).toBe("Win");
  });

  it("get throws on unknown id", () => {
    expect(() => svc.get("nonexistent")).toThrow("Scenario not found: nonexistent");
  });

  it("get returns a cloned copy, not the original reference", () => {
    const scenario = svc.get("sc1");
    scenario.title = "Modified";
    const scenarioAgain = svc.get("sc1");
    expect(scenarioAgain.title).toBe("Test Story");
  });

  it("replaceAll replaces the scenarios array", () => {
    svc.replaceAll([structuredClone(mockScenario2)]);
    expect(svc.list()).toHaveLength(1);
    expect(svc.list()[0].id).toBe("sc2");
  });

  it("replaceAll with empty array clears scenarios", () => {
    svc.replaceAll([]);
    expect(svc.list()).toHaveLength(0);
  });

  it("replaceAll adds new scenarios to existing array (not replace reference)", () => {
    const newScenarios = [structuredClone(mockScenario), structuredClone(mockScenario2)];
    svc.replaceAll(newScenarios);
    expect(svc.list()).toBe(svc.list());
    expect(svc.list()).toHaveLength(2);
  });

  it("get returns scenarios added via replaceAll", () => {
    const newSc: Scenario = { id: "sc3", title: "New", premise: "P", currentStage: "s1", stages: ["s1"], stageDetails: [], currentGoal: "G", rules: [], initialStates: [] };
    svc.replaceAll([newSc]);
    expect(svc.get("sc3").id).toBe("sc3");
  });
});
