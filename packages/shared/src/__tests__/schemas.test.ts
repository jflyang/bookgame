import { describe, it, expect } from "vitest";
import {
  llmConfigSchema,
  llmConfigViewSchema,
  updateLlmConfigRequestSchema,
  gameStateSchema,
  knowledgeDocumentSchema,
  stateDeltaSchema,
  runtimeTurnRecordSchema,
  runtimeStatsAggregateSchema,
  characterStateSchema,
  llmActionSchema,
  storyPromptRuleSchema,
} from "../index.js";

describe("llmConfigSchema", () => {
  it("accepts valid full config", () => {
    const result = llmConfigSchema.safeParse({
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      temperature: 0.8,
      maxTokens: 800,
      apiKey: "sk-abc123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts config without optional apiKey", () => {
    const result = llmConfigSchema.safeParse({
      provider: "mock",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      temperature: 0.8,
      maxTokens: 800,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid baseUrl", () => {
    const result = llmConfigSchema.safeParse({
      provider: "deepseek",
      baseUrl: "not-a-url",
      model: "deepseek-v4-flash",
      temperature: 0.8,
      maxTokens: 800,
    });
    expect(result.success).toBe(false);
  });

  it("rejects temperature out of range", () => {
    const result = llmConfigSchema.safeParse({
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      temperature: 3,
      maxTokens: 800,
    });
    expect(result.success).toBe(false);
  });

  it("rejects maxTokens <= 0", () => {
    const result = llmConfigSchema.safeParse({
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      temperature: 0.8,
      maxTokens: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("llmConfigViewSchema", () => {
  it("has hasApiKey field instead of apiKey", () => {
    const result = llmConfigViewSchema.safeParse({
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      temperature: 0.8,
      maxTokens: 800,
      hasApiKey: true,
    });
    expect(result.success).toBe(true);
  });

  it("strips apiKey from parsed output", () => {
    const result = llmConfigViewSchema.safeParse({
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      temperature: 0.8,
      maxTokens: 800,
      hasApiKey: true,
      apiKey: "sk-secret",
    });
    expect(result.success).toBe(true);
    if (result.success) expect((result.data as any).apiKey).toBeUndefined();
  });
});

describe("updateLlmConfigRequestSchema", () => {
  it("accepts config with optional apiKey", () => {
    const result = updateLlmConfigRequestSchema.safeParse({
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-pro",
      temperature: 0.5,
      maxTokens: 400,
    });
    expect(result.success).toBe(true);
  });
});

describe("gameStateSchema", () => {
  const validState = {
    sessionId: "sess_001",
    scenarioId: "scenario_1",
    round: 3,
    lastSpeakerId: "qiaofeng",
    status: "active",
    characters: [
      { characterId: "qiaofeng", hp: 700, mp: 800, conditions: [], isDefeated: false },
    ],
    scenario: {
      id: "scenario_1",
      title: "Test",
      premise: "A test scenario",
      currentStage: "origin",
      stages: ["origin", "end"],
      currentGoal: "Test the system",
      rules: ["rule 1"],
      initialStates: [{ characterId: "qiaofeng", hp: 700, mp: 800 }],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("accepts valid game state", () => {
    const result = gameStateSchema.safeParse(validState);
    expect(result.success).toBe(true);
  });

  it("rejects negative round", () => {
    const result = gameStateSchema.safeParse({ ...validState, round: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = gameStateSchema.safeParse({ ...validState, status: "paused" });
    expect(result.success).toBe(false);
  });
});

describe("characterStateSchema", () => {
  const valid = { characterId: "qiaofeng", hp: 700, mp: 800, conditions: [], isDefeated: false };

  it("accepts valid character state", () => {
    const result = characterStateSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects non-integer hp", () => {
    const result = characterStateSchema.safeParse({ ...valid, hp: 1.5 });
    expect(result.success).toBe(false);
  });
});

describe("knowledgeDocumentSchema", () => {
  it("accepts valid document", () => {
    const now = new Date().toISOString();
    const result = knowledgeDocumentSchema.safeParse({
      id: "doc_1",
      title: "测试知识",
      ownerId: null,
      content: "这是一段测试内容",
      sourceType: "markdown",
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const now = new Date().toISOString();
    const result = knowledgeDocumentSchema.safeParse({
      id: "doc_1",
      ownerId: null,
      content: "test",
      sourceType: "markdown",
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(false);
  });
});

describe("stateDeltaSchema", () => {
  it("accepts numeric delta values", () => {
    const result = stateDeltaSchema.safeParse({
      qiaofeng_hp: -30,
      xuzhu_hp: -10,
      xuzhu_mp: -50,
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-integer values", () => {
    const result = stateDeltaSchema.safeParse({ hp: 1.5 });
    expect(result.success).toBe(false);
  });

  it("accepts empty delta", () => {
    const result = stateDeltaSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("runtimeTurnRecordSchema", () => {
  const validRecord = {
    id: "rt_001",
    sessionId: "sess_001",
    round: 1,
    speakerId: "qiaofeng",
    speakerName: "乔峰",
    prompt: "test prompt",
    rawLlmResponse: '{"speakerId":"qiaofeng","narration":"test"}',
    parsedOutput: null,
    validationResult: "passed" as const,
    validationErrors: [],
    stateDelta: { qiaofeng_hp: -10 },
    stageBefore: "origin",
    stageAfter: "origin",
    latencyMs: 2300,
    tokenUsage: { promptTokens: 1200, completionTokens: 300 },
    timestamp: new Date().toISOString(),
  };

  it("accepts valid record", () => {
    const result = runtimeTurnRecordSchema.safeParse(validRecord);
    expect(result.success).toBe(true);
  });

  it("rejects negative latency", () => {
    const result = runtimeTurnRecordSchema.safeParse({ ...validRecord, latencyMs: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid validation_result", () => {
    const result = runtimeTurnRecordSchema.safeParse({ ...validRecord, validationResult: "unknown" as any });
    expect(result.success).toBe(false);
  });
});

describe("runtimeStatsAggregateSchema", () => {
  it("accepts valid aggregate", () => {
    const result = runtimeStatsAggregateSchema.safeParse({
      totalTurns: 50,
      totalSessions: 5,
      avgLatencyMs: 2100,
      maxLatencyMs: 5000,
      minLatencyMs: 800,
      totalPromptTokens: 60000,
      totalCompletionTokens: 15000,
      avgPromptTokens: 1200,
      avgCompletionTokens: 300,
      validationPassCount: 48,
      validationFailCount: 2,
      stageChanges: 10,
      activeSpeakers: ["qiaofeng", "xuzhu"],
    });
    expect(result.success).toBe(true);
  });
});

describe("llmActionSchema", () => {
  it("accepts skill action with skillId", () => {
    const result = llmActionSchema.safeParse({
      type: "skill",
      skillId: "xianglong_kanglongyouhui",
      targetIds: ["dingchunqiu"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts command action with null skillId", () => {
    const result = llmActionSchema.safeParse({
      type: "command",
      skillId: null,
      targetIds: ["xuzhu", "dingchunqiu"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts observe action without skillId", () => {
    const result = llmActionSchema.safeParse({
      type: "observe",
      targetIds: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts observe action with null skillId", () => {
    const result = llmActionSchema.safeParse({
      type: "observe",
      skillId: null,
      targetIds: [],
    });
    expect(result.success).toBe(true);
  });

  it("defaults targetIds to empty array", () => {
    const result = llmActionSchema.safeParse({ type: "observe" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.targetIds).toEqual([]);
  });
});

describe("storyPromptRuleSchema", () => {
  it("accepts combat category", () => {
    const result = storyPromptRuleSchema.safeParse({
      id: "rule_combat_declaration",
      title: "战斗伤害宣告规则",
      category: "combat",
      content: "测试内容",
      enabled: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid categories", () => {
    for (const cat of ["knowledge_forcing", "group_chat_boundary", "scenario_injection", "state_output", "history_state", "combat", "custom"]) {
      const result = storyPromptRuleSchema.safeParse({
        id: "rule_test",
        title: "Test",
        category: cat,
        content: "test",
        enabled: true,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects unknown category", () => {
    const result = storyPromptRuleSchema.safeParse({
      id: "rule_test",
      title: "Test",
      category: "unknown_type",
      content: "test",
      enabled: true,
    });
    expect(result.success).toBe(false);
  });
});
