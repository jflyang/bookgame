import { describe, it, expect } from "vitest";
import {
  characterSchema, skillSchema, scenarioSchema, llmStoryOutputSchema,
  storyPackageSchema, uiConfigSchema, messageSchema, createSessionRequestSchema
} from "./index.js";

describe("characterSchema", () => {
  const validChar = { id: "qiaofeng", name: "Test", role: "tester", avatar: "T", personaPrompt: "You are a tester", rules: [], skillIds: [], knowledgeBaseIds: [] };
  it("accepts valid character", () => { expect(() => characterSchema.parse(validChar)).not.toThrow(); });
  it("rejects missing name", () => { const c = { ...validChar }; delete (c as any).name; expect(() => characterSchema.parse(c)).toThrow(); });
  it("rejects unsafe id", () => { expect(() => characterSchema.parse({ ...validChar, id: "../invalid" })).toThrow(); });
});

describe("skillSchema", () => {
  const validSkill = { id: "fireball", name: "Fireball", ownerId: "qiaofeng", cost: { mp: 20 }, damage: { min: 10, max: 20 }, effect: "Burns", description: "A fireball" };
  it("accepts valid skill", () => { expect(() => skillSchema.parse(validSkill)).not.toThrow(); });
  it("rejects negative mp cost", () => { expect(() => skillSchema.parse({ ...validSkill, cost: { mp: -5 } })).toThrow(); });
  it("accepts skill without damage", () => { const s = { ...validSkill }; delete (s as any).damage; expect(() => skillSchema.parse(s)).not.toThrow(); });
});

describe("scenarioSchema", () => {
  const validScenario = { id: "test_scenario", title: "Test", premise: "A test", currentStage: "start", stages: ["start", "middle", "end"], currentGoal: "Win", rules: [], initialStates: [] };
  it("accepts valid scenario", () => { expect(() => scenarioSchema.parse(validScenario)).not.toThrow(); });
  it("accepts empty stages", () => { expect(() => scenarioSchema.parse({ ...validScenario, stages: [] })).not.toThrow(); });
  it("rejects missing title", () => { const s = { ...validScenario }; delete (s as any).title; expect(() => scenarioSchema.parse(s)).toThrow(); });
});

describe("llmStoryOutputSchema", () => {
  const valid = { speakerId: "qiaofeng" as const, narration: "He strikes", dialogue: "Take this!", action: { type: "skill" as const, skillId: "xianglong_kanglongyouhui", targetIds: ["dingchunqiu" as const] } };
  it("accepts valid output", () => { expect(() => llmStoryOutputSchema.parse(valid)).not.toThrow(); });
  it("rejects missing narration", () => { const v = { ...valid }; delete (v as any).narration; expect(() => llmStoryOutputSchema.parse(v)).toThrow(); });
  it("rejects unsafe speakerId", () => { expect(() => llmStoryOutputSchema.parse({ ...valid, speakerId: "../unknown" })).toThrow(); });
  it("rejects invalid action type", () => { expect(() => llmStoryOutputSchema.parse({ ...valid, action: { ...valid.action, type: "invalid" } })).toThrow(); });
  it("has default empty stateDeltaSuggestion", () => { const parsed = llmStoryOutputSchema.parse(valid); expect(parsed.stateDeltaSuggestion).toEqual({}); });
});

describe("uiConfigSchema", () => {
  it("accepts empty object with defaults", () => { const parsed = uiConfigSchema.parse({}); expect(parsed.layout).toBeDefined(); });
  it("accepts partial theme override", () => { const parsed = uiConfigSchema.parse({ theme: { primaryColor: "#ff0000" } }); expect(parsed.theme?.primaryColor).toBe("#ff0000"); });
});

describe("messageSchema", () => {
  const validMsg = { id: "msg_1", sessionId: "sess_1", role: "assistant" as const, speakerId: "qiaofeng" as const, content: "Hello", usedSkills: [], stateDelta: {}, createdAt: new Date().toISOString() };
  it("accepts valid message", () => { expect(() => messageSchema.parse(validMsg)).not.toThrow(); });
  it("rejects invalid role", () => { expect(() => messageSchema.parse({ ...validMsg, role: "invalid" })).toThrow(); });
});

describe("createSessionRequestSchema", () => {
  it("accepts empty with defaults", () => { const parsed = createSessionRequestSchema.parse({}); expect(parsed.scenarioId).toBe("xuzhu_vs_dingchunqiu"); expect(parsed.characterIds).toHaveLength(4); });
  it("accepts explicit scenarioId", () => { const parsed = createSessionRequestSchema.parse({ scenarioId: "custom" }); expect(parsed.scenarioId).toBe("custom"); });
  it("accepts custom characterIds", () => { const parsed = createSessionRequestSchema.parse({ characterIds: ["qiaofeng", "dingchunqiu"] }); expect(parsed.characterIds).toHaveLength(2); });
  it("rejects unsafe characterId", () => { expect(() => createSessionRequestSchema.parse({ characterIds: ["../invalid"] })).toThrow(); });
});

describe("storyPackageSchema", () => {
  const validPkg = {
    id: "pkg_1",
    title: "Test",
    description: "Desc",
    scenario: { id: "s1", title: "S", premise: "P", currentStage: "start", stages: ["start"], currentGoal: "G", rules: [], initialStates: [] },
    characters: [],
    skills: [],
    debugConfig: { showPromptLayers: true, showRawOutput: false, showValidation: true },
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z"
  };
  it("accepts valid package", () => { expect(() => storyPackageSchema.parse(validPkg)).not.toThrow(); });
  it("rejects missing title", () => { const p = { ...validPkg }; delete (p as any).title; expect(() => storyPackageSchema.parse(p)).toThrow(); });
  it("accepts optional thumbnail", () => {
    const pkg = { ...validPkg, thumbnail: "data:image/png;base64,abc123" };
    expect(() => storyPackageSchema.parse(pkg)).not.toThrow();
  });
});
