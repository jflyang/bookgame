import { describe, it, expect, beforeEach, vi } from "vitest";
import { TurnProcessor } from "../turnProcessor.js";
import type { Character, GameState, LlmStoryOutput, SendMessageRequest } from "@story-game/shared";

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: "qiaofeng", name: "乔峰", role: "主导者", avatar: "乔",
    personaPrompt: "You are Qiao Feng", rules: ["be brave"],
    skillIds: [], knowledgeBaseIds: [], ...overrides,
  };
}

function makeGameState(overrides: Record<string, unknown> = {}): GameState {
  return {
    sessionId: "sess_001", round: 1, status: "active", lastSpeakerId: null,
    characters: [{ characterId: "qiaofeng", hp: 100, mp: 80, conditions: [], isDefeated: false }],
    scenario: {
      id: "sc_001", title: "Test", currentStage: "opening", currentGoal: "Test",
      premise: "Test", rules: [], stages: ["opening", "climax", "ending"], initialStates: [],
    },
    createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z",
    scenarioId: "sc_001", ...overrides,
  } as GameState;
}

function makeValidOutput(overrides: Partial<LlmStoryOutput> = {}): LlmStoryOutput {
  return {
    speakerId: "qiaofeng", narration: "He strikes fiercely", dialogue: "Take this!",
    action: { type: "skill", skillId: "test_skill", targetIds: ["xuzhu"] },
    stateDeltaSuggestion: {}, ...overrides,
  };
}

describe("TurnProcessor", () => {
  let processor: TurnProcessor;
  let mockCharacters: Record<string, ReturnType<typeof vi.fn>>;
  let mockMemory: Record<string, ReturnType<typeof vi.fn>>;
  let mockStates: Record<string, ReturnType<typeof vi.fn>>;
  let mockPrompts: Record<string, ReturnType<typeof vi.fn>>;
  let mockRules: Record<string, ReturnType<typeof vi.fn>>;
  let mockLlm: Record<string, ReturnType<typeof vi.fn>>;
  let mockAuditLog: Record<string, ReturnType<typeof vi.fn>>;
  let mockSpeakerSelector: Record<string, ReturnType<typeof vi.fn>>;
  let mockStats: Record<string, ReturnType<typeof vi.fn>>;
  let mockSkills: Record<string, ReturnType<typeof vi.fn>>;
  let mockGetStoryPackage: ReturnType<typeof vi.fn>;

  const sessionId = "sess_001";
  const input: SendMessageRequest = { text: "攻击他！" };
  const character = makeCharacter();
  const gameState = makeGameState();
  const validOutput = makeValidOutput();

  beforeEach(() => {
    mockCharacters = { get: vi.fn(), list: vi.fn() };
    mockMemory = { append: vi.fn(), recent: vi.fn(), list: vi.fn().mockReturnValue([]) };
    mockStates = { get: vi.fn(), applyAssistantTurn: vi.fn(), withLock: vi.fn((_id: string, fn: () => Promise<unknown>) => fn()) };
    mockPrompts = { buildPrompt: vi.fn() };
    mockRules = { validateOutput: vi.fn() };
    mockLlm = { complete: vi.fn(), stream: vi.fn() };
    mockAuditLog = { append: vi.fn() };
    mockSpeakerSelector = { select: vi.fn() };
    mockStats = { recordCompleteTurn: vi.fn() };
    mockSkills = { get: vi.fn().mockReturnValue(undefined), list: vi.fn().mockReturnValue([]) };
    mockGetStoryPackage = vi.fn();

    mockSpeakerSelector.select.mockReturnValue("qiaofeng");
    mockCharacters.get.mockReturnValue(character);
    mockCharacters.list.mockReturnValue([character]);
    mockStates.get.mockReturnValue(gameState);
    mockPrompts.buildPrompt.mockReturnValue("system prompt\nuser query");
    mockLlm.complete.mockResolvedValue({ output: validOutput, raw: JSON.stringify(validOutput) });
    mockRules.validateOutput.mockReturnValue(validOutput);
    mockStates.applyAssistantTurn.mockReturnValue({
      state: { ...gameState, round: 2 },
      delta: { "dingchunqiu.hp": -20 },
    });
    mockGetStoryPackage.mockReturnValue(undefined);

    processor = new TurnProcessor(
      mockCharacters as never, mockMemory as never, mockStates as never,
      mockPrompts as never, mockRules as never, mockLlm as never,
      mockAuditLog as never, mockSpeakerSelector as never,
      mockStats as never, mockSkills as never,
      mockGetStoryPackage as never,
    );
  });

  // ---- sendMessage ----

  it("returns { message, gameState, debug }", async () => {
    const result = await processor.sendMessage(sessionId, input);
    expect(result).toHaveProperty("message");
    expect(result).toHaveProperty("gameState");
    expect(result).toHaveProperty("debug");
    expect(result.message.role).toBe("assistant");
    expect(result.message.speakerId).toBe("qiaofeng");
    expect(result.message.id).toMatch(/^msg_/);
    expect(result.message.content).toContain("He strikes fiercely");
    expect(result.debug.selectedSpeakerId).toBe("qiaofeng");
    expect(result.debug.validation).toBe("passed");
  });

  it("validates output via ruleChecker", async () => {
    await processor.sendMessage(sessionId, input);
    expect(mockRules.validateOutput).toHaveBeenCalledWith("qiaofeng", validOutput);
  });

  it("records stats on successful turn", async () => {
    await processor.sendMessage(sessionId, input);
    expect(mockStats.recordCompleteTurn).toHaveBeenCalledTimes(1);
    const arg = mockStats.recordCompleteTurn.mock.calls[0][0];
    expect(arg.sessionId).toBe(sessionId);
    expect(arg.speakerId).toBe("qiaofeng");
    expect(arg.validationResult).toBe("passed");
    expect(arg.stageBefore).toBe("opening");
  });

  it("records failed stats and rethrows on validation error", async () => {
    mockRules.validateOutput.mockImplementation(() => { throw new Error("speaker mismatch"); });
    await expect(processor.sendMessage(sessionId, input)).rejects.toThrow("speaker mismatch");
    expect(mockStats.recordCompleteTurn).toHaveBeenCalledTimes(1);
    expect(mockStats.recordCompleteTurn.mock.calls[0][0].validationResult).toBe("failed");
  });

  it("writes audit log entries", async () => {
    await processor.sendMessage(sessionId, input);
    const calls = mockAuditLog.append.mock.calls.map((c: unknown[]) => (c[0] as { type: string }).type);
    expect(calls).toContain("llm_response");
  });

  it("writes session_completed when game ends", async () => {
    mockStates.applyAssistantTurn.mockReturnValue({
      state: { ...gameState, round: 2, status: "completed" },
      delta: {},
    });
    await processor.sendMessage(sessionId, input);
    const types = mockAuditLog.append.mock.calls.map((c: unknown[]) => (c[0] as { type: string }).type);
    expect(types).toContain("session_completed");
  });

  it("prepares turn: appends user message, selects speaker, reads state", async () => {
    await processor.sendMessage(sessionId, input);
    expect(mockMemory.append).toHaveBeenCalled();
    expect(mockSpeakerSelector.select).toHaveBeenCalledWith(sessionId, input, undefined);
    expect(mockStates.get).toHaveBeenCalledWith(sessionId);
  });

  it("handles missing story package gracefully", async () => {
    await processor.sendMessage(sessionId, input);
    expect(mockPrompts.buildPrompt).toHaveBeenCalled();
  });

  // ---- sendMessageStream ----

  it("yields meta, token, and done events in order", async () => {
    const chunks = ["Hello ", "World"];
    async function* mockStream() { for (const c of chunks) yield c; }
    mockLlm.stream.mockReturnValue(mockStream());

    const events: string[] = [];
    for await (const event of processor.sendMessageStream(sessionId, input)) {
      events.push((event as { type: string }).type);
    }
    expect(events).toEqual(["meta", "token", "token", "done"]);
  });

  it("records stats after stream completes", async () => {
    async function* mockStream() { yield "Hello"; }
    mockLlm.stream.mockReturnValue(mockStream());

    for await (const _ of processor.sendMessageStream(sessionId, input)) { void _; }
    expect(mockStats.recordCompleteTurn).toHaveBeenCalledTimes(1);
    expect(mockStats.recordCompleteTurn.mock.calls[0][0].validationResult).toBe("passed");
  });

  it("records failed stats on validation error after stream", async () => {
    async function* mockStream() { yield "bad json"; }
    mockLlm.stream.mockReturnValue(mockStream());
    mockRules.validateOutput.mockImplementation(() => { throw new Error("invalid"); });

    await expect(async () => {
      for await (const _ of processor.sendMessageStream(sessionId, input)) { void _; }
    }).rejects.toThrow("invalid");

    expect(mockStats.recordCompleteTurn).toHaveBeenCalledTimes(1);
    expect(mockStats.recordCompleteTurn.mock.calls[0][0].validationResult).toBe("failed");
  });

  it("parses valid JSON from stream buffer", async () => {
    const json = JSON.stringify(validOutput);
    async function* mockStream() { yield json; }
    mockLlm.stream.mockReturnValue(mockStream());

    for await (const _ of processor.sendMessageStream(sessionId, input)) { void _; }
    expect(mockRules.validateOutput).toHaveBeenCalledWith("qiaofeng", expect.objectContaining({ speakerId: "qiaofeng" }));
  });

  // ---- Skill damage resolution ----

  it("strips self-HP damage when LLM incorrectly sets it", async () => {
    const output = makeValidOutput({
      action: { type: "skill", skillId: "天山六阳掌", targetIds: ["dingchunqiu"] },
      stateDeltaSuggestion: { qiaofeng_hp: -30, dingchunqiu_hp: -5 },
    });
    mockSkills.get.mockReturnValue({
      id: "天山六阳掌", name: "天山六阳掌", ownerId: "qiaofeng",
      cost: { mp: 30 }, damage: { min: 35, max: 50 },
    });
    mockRules.validateOutput.mockReturnValue(output);
    mockLlm.complete.mockResolvedValue({ output, raw: JSON.stringify(output) });

    await processor.sendMessage(sessionId, input);
    const applied = mockStates.applyAssistantTurn.mock.calls[0][2] as { stateDeltaSuggestion: Record<string, number> };
    // Self HP should be removed
    expect(applied.stateDeltaSuggestion.qiaofeng_hp).toBeUndefined();
    // Target HP should be set to calculated damage (35~50, overwriting LLM's -5)
    expect(applied.stateDeltaSuggestion.dingchunqiu_hp).toBeLessThanOrEqual(-35);
    expect(applied.stateDeltaSuggestion.dingchunqiu_hp).toBeGreaterThanOrEqual(-50);
  });

  it("uses fallback enemy target from attackableTargetIds when targetIds is empty for damage skill", async () => {
    mockCharacters.list.mockReturnValue([
      { id: "qiaofeng", name: "乔峰", role: "主导者", attackableTargetIds: ["dingchunqiu"] },
      { id: "dingchunqiu", name: "丁春秋", role: "反派", attackableTargetIds: [] },
    ] as never);
    const output = makeValidOutput({
      action: { type: "skill", skillId: "星宿毒雾", targetIds: [] },
      stateDeltaSuggestion: { dingchunqiu_mp: -30 },
    });
    mockSkills.get.mockReturnValue({
      id: "星宿毒雾", name: "星宿毒雾", ownerId: "dingchunqiu",
      cost: { mp: 30 }, damage: { min: 20, max: 35 },
    });
    mockRules.validateOutput.mockReturnValue(output);
    mockLlm.complete.mockResolvedValue({ output, raw: JSON.stringify(output) });

    await processor.sendMessage(sessionId, input);
    const applied = mockStates.applyAssistantTurn.mock.calls[0][2] as { stateDeltaSuggestion: Record<string, number> };
    // Should fallback to character in speaker's attackableTargetIds (dingchunqiu)
    expect(applied.stateDeltaSuggestion.dingchunqiu_hp).toBeLessThanOrEqual(-20);
    expect(applied.stateDeltaSuggestion.dingchunqiu_hp).toBeGreaterThanOrEqual(-35);
  });

  it("falls back to first entry in attackableTargetIds when multiple targets configured", async () => {
    mockCharacters.list.mockReturnValue([
      { id: "qiaofeng", name: "乔峰", role: "主导者", attackableTargetIds: ["dingchunqiu", "duanyu"] },
      { id: "dingchunqiu", name: "丁春秋", role: "反派", attackableTargetIds: [] },
      { id: "duanyu", name: "段誉", role: "观察者", attackableTargetIds: [] },
    ] as never);
    const output = makeValidOutput({
      action: { type: "skill", skillId: "天山六阳掌", targetIds: [] },
      stateDeltaSuggestion: {},
    });
    mockSkills.get.mockReturnValue({
      id: "天山六阳掌", name: "天山六阳掌", ownerId: "qiaofeng",
      cost: { mp: 30 }, damage: { min: 35, max: 50 },
    });
    mockRules.validateOutput.mockReturnValue(output);
    mockLlm.complete.mockResolvedValue({ output, raw: JSON.stringify(output) });

    await processor.sendMessage(sessionId, input);
    const applied = mockStates.applyAssistantTurn.mock.calls[0][2] as { stateDeltaSuggestion: Record<string, number> };
    // Should pick the first attackable target (dingchunqiu)
    expect(applied.stateDeltaSuggestion.dingchunqiu_hp).toBeLessThanOrEqual(-35);
    // Should NOT hit the second target
    expect(applied.stateDeltaSuggestion.duanyu_hp).toBeUndefined();
  });

  it("falls back to any non-speaker when attackableTargetIds is empty", async () => {
    mockCharacters.list.mockReturnValue([
      { id: "qiaofeng", name: "乔峰", role: "主导者", attackableTargetIds: [] },
      { id: "xuzhu", name: "虚竹", role: "行动者", attackableTargetIds: [] },
    ] as never);
    const output = makeValidOutput({
      action: { type: "skill", skillId: "天山六阳掌", targetIds: [] },
      stateDeltaSuggestion: {},
    });
    mockSkills.get.mockReturnValue({
      id: "天山六阳掌", name: "天山六阳掌", ownerId: "qiaofeng",
      cost: { mp: 30 }, damage: { min: 35, max: 50 },
    });
    mockRules.validateOutput.mockReturnValue(output);
    mockLlm.complete.mockResolvedValue({ output, raw: JSON.stringify(output) });

    await processor.sendMessage(sessionId, input);
    const applied = mockStates.applyAssistantTurn.mock.calls[0][2] as { stateDeltaSuggestion: Record<string, number> };
    // Should fall back to the only non-speaker (xuzhu)
    expect(applied.stateDeltaSuggestion.xuzhu_hp).toBeLessThanOrEqual(-35);
    // Self should NOT get HP damage
    expect(applied.stateDeltaSuggestion.qiaofeng_hp).toBeUndefined();
  });

  it("does not use fallback when LLM provides explicit targetIds", async () => {
    mockCharacters.list.mockReturnValue([
      { id: "qiaofeng", name: "乔峰", role: "主导者", attackableTargetIds: ["dingchunqiu"] },
      { id: "xuzhu", name: "虚竹", role: "行动者", attackableTargetIds: [] },
      { id: "dingchunqiu", name: "丁春秋", role: "反派", attackableTargetIds: [] },
    ] as never);
    const output = makeValidOutput({
      action: { type: "skill", skillId: "天山六阳掌", targetIds: ["xuzhu"] },
      stateDeltaSuggestion: {},
    });
    mockSkills.get.mockReturnValue({
      id: "天山六阳掌", name: "天山六阳掌", ownerId: "qiaofeng",
      cost: { mp: 30 }, damage: { min: 35, max: 50 },
    });
    mockRules.validateOutput.mockReturnValue(output);
    mockLlm.complete.mockResolvedValue({ output, raw: JSON.stringify(output) });

    await processor.sendMessage(sessionId, input);
    const applied = mockStates.applyAssistantTurn.mock.calls[0][2] as { stateDeltaSuggestion: Record<string, number> };
    // Should use the LLM-specified target (xuzhu), NOT the attackableTargetIds fallback
    expect(applied.stateDeltaSuggestion.xuzhu_hp).toBeLessThanOrEqual(-35);
    expect(applied.stateDeltaSuggestion.dingchunqiu_hp).toBeUndefined();
  });

  it("returns usedSkill name for non-skill action", async () => {
    const output = makeValidOutput({
      action: { type: "command", targetIds: ["xuzhu"] },
      stateDeltaSuggestion: {},
    });
    mockRules.validateOutput.mockReturnValue(output);
    mockLlm.complete.mockResolvedValue({ output, raw: JSON.stringify(output) });

    const result = await processor.sendMessage(sessionId, input);
    expect(result.debug.usedSkill).toBeNull();
  });

  // ── formatCombatLine ──

  it("message content includes combat line with skill damage and MP cost", async () => {
    mockCharacters.list.mockReturnValue([
      { id: "qiaofeng", name: "乔峰", role: "主导者" },
      { id: "dingchunqiu", name: "丁春秋", role: "反派" },
    ] as never);
    const output = makeValidOutput({
      action: { type: "skill", skillId: "天山六阳掌", targetIds: ["dingchunqiu"] },
      stateDeltaSuggestion: { dingchunqiu_hp: -42, qiaofeng_mp: -30 },
    });
    mockSkills.get.mockReturnValue({
      id: "天山六阳掌", name: "天山六阳掌", ownerId: "qiaofeng",
      cost: { mp: 30 }, damage: { min: 35, max: 50 },
    });
    mockRules.validateOutput.mockReturnValue(output);
    mockLlm.complete.mockResolvedValue({ output, raw: JSON.stringify(output) });

    const result = await processor.sendMessage(sessionId, input);
    expect(result.message.content).toContain("⚔ 乔峰 施展【天山六阳掌】");
    expect(result.message.content).toMatch(/→ 丁春秋 气血-\d+/);
    expect(result.message.content).toContain("｜ 乔峰 内力-30");
  });

  it("message content does NOT include full status line", async () => {
    const output = makeValidOutput();
    mockRules.validateOutput.mockReturnValue(output);
    mockLlm.complete.mockResolvedValue({ output, raw: JSON.stringify(output) });

    const result = await processor.sendMessage(sessionId, input);
    expect(result.message.content).not.toContain("[状态]");
  });

  it("message content has no combat line for non-skill actions", async () => {
    for (const actionType of ["observe", "command", "escape", "defend"]) {
      const output = makeValidOutput({
        action: { type: actionType as never, targetIds: [] },
        stateDeltaSuggestion: {},
      });
      mockRules.validateOutput.mockReturnValue(output);
      mockLlm.complete.mockResolvedValue({ output, raw: JSON.stringify(output) });

      const result = await processor.sendMessage(sessionId, input);
      expect(result.message.content).not.toContain("⚔");
      expect(result.message.content).not.toContain("[乔峰");
    }
  });

  it("combat line shows target but no MP when MP is 0", async () => {
    mockCharacters.list.mockReturnValue([
      { id: "qiaofeng", name: "乔峰", role: "主导者" },
      { id: "dingchunqiu", name: "丁春秋", role: "反派" },
    ] as never);
    const output = makeValidOutput({
      action: { type: "skill", skillId: "免费技能", targetIds: ["dingchunqiu"] },
      stateDeltaSuggestion: {},
    });
    mockSkills.get.mockReturnValue({
      id: "免费技能", name: "免费技能", ownerId: "qiaofeng",
      cost: { mp: 0 }, damage: { min: 10, max: 20 },
    });
    mockRules.validateOutput.mockReturnValue(output);
    mockLlm.complete.mockResolvedValue({ output, raw: JSON.stringify(output) });

    const result = await processor.sendMessage(sessionId, input);
    expect(result.message.content).toContain("⚔ 乔峰 施展【免费技能】");
    expect(result.message.content).toContain("→ 丁春秋 气血-");
    // No MP cost should appear
    expect(result.message.content).not.toContain("内力");
  });

  // ── StreamContentExtractor ──

  it("stream yields extracted content for JSON tokens", async () => {
    // Simulate real DeepSeek JSON streaming output with realistic chunk sizes
    const json = JSON.stringify(makeValidOutput({
      narration: "虚竹一掌拍出",
      dialogue: "看招！",
      action: { type: "skill", skillId: "天山六阳掌", targetIds: ["dingchunqiu"] },
      stateDeltaSuggestion: {},
    }));
    // Real LLM streams in larger chunks (20+ chars). Split accordingly so JSON
    // detection triggers before any content leaks.
    const chunks: string[] = [];
    for (let i = 0; i < json.length; i += 30) {
      chunks.push(json.slice(i, i + 30));
    }
    async function* mockStream() { for (const c of chunks) yield c; }
    mockLlm.stream.mockReturnValue(mockStream());

    const tokens: string[] = [];
    for await (const event of processor.sendMessageStream(sessionId, input)) {
      if (event.type === "token") tokens.push((event as { token: string }).token);
    }
    const combined = tokens.join("");
    // Must contain Chinese content
    expect(combined).toContain("虚竹一掌拍出");
    expect(combined).toContain("看招！");
    // Must NOT contain JSON structural keys
    expect(combined).not.toContain('"speakerId"');
    expect(combined).not.toContain('"narration"');
    expect(combined).not.toContain('"action"');
  });

  it("stream passes through non-JSON plain text", async () => {
    async function* mockStream() { yield "Hello "; yield "World"; }
    mockLlm.stream.mockReturnValue(mockStream());

    const tokens: string[] = [];
    for await (const event of processor.sendMessageStream(sessionId, input)) {
      if (event.type === "token") tokens.push((event as { token: string }).token);
    }
    expect(tokens.join("")).toBe("Hello World");
  });

  it("stream handles JSON escape sequences", async () => {
    const output = makeValidOutput({
      narration: `He said: "hello"\nnew line test`,
      dialogue: "continue",
    });
    const json = JSON.stringify(output);
    async function* mockStream() { yield json; }
    mockLlm.stream.mockReturnValue(mockStream());

    const tokens: string[] = [];
    for await (const event of processor.sendMessageStream(sessionId, input)) {
      if (event.type === "token") tokens.push((event as { token: string }).token);
    }
    const combined = tokens.join("");
    expect(combined).toContain("He said: ");
    expect(combined).toContain("hello");
    expect(combined).toContain("new line test");
  });

  it("stream handles JSON that arrives gradually with no content in early chunks", async () => {
    // Early chunks only have JSON structure, content comes later
    const chunks = [
      '{"speakerId":"',
      'qiaofeng","narr',
      'ation":"渐',
      '入佳境","dialogue":"',
      '继续","action"',
      ':{"type":"observe","targetIds":[]}}',
    ];
    async function* mockStream() { for (const c of chunks) yield c; }
    mockLlm.stream.mockReturnValue(mockStream());

    const tokens: string[] = [];
    for await (const event of processor.sendMessageStream(sessionId, input)) {
      if (event.type === "token") tokens.push((event as { token: string }).token);
    }
    const combined = tokens.join("");
    expect(combined).toContain("渐入佳境");
    expect(combined).toContain("继续");
    expect(combined).not.toContain("speakerId");
    expect(combined).not.toContain("qiaofeng");
  });
});
