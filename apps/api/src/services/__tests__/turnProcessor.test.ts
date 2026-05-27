import { describe, it, expect, beforeEach, vi } from "vitest";
import { TurnProcessor } from "../turnProcessor.js";
import type {
  Character,
  Skill,
  GameState,
  LlmStoryOutput,
  SendMessageRequest,
} from "@story-game/shared";

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: "qiaofeng",
    name: "乔峰",
    role: "主导者",
    avatar: "乔",
    personaPrompt: "You are Qiao Feng",
    rules: ["be brave"],
    skillIds: ["test_skill"],
    knowledgeBaseIds: [],
    ...overrides,
  };
}

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "test_skill",
    name: "Test Skill",
    ownerId: "qiaofeng",
    cost: { mp: 10 },
    damage: { min: 15, max: 25 },
    effect: "Hurts",
    description: "A test skill",
    ...overrides,
  };
}

function makeGameState(overrides: Record<string, unknown> = {}): GameState {
  const base = {
    sessionId: "sess_001",
    round: 1,
    status: "active" as const,
    lastSpeakerId: null,
    characters: [
      {
        characterId: "qiaofeng" as const,
        hp: 100,
        mp: 80,
        conditions: [],
        isDefeated: false,
      },
    ],
    scenario: {
      id: "sc_001",
      title: "Test Scenario",
      currentStage: "opening",
      currentGoal: "Test",
      premise: "Test",
      rules: [],
      stages: ["opening", "climax", "ending"],
      initialStates: [],
    },
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    scenarioId: "sc_001",
  };
  return { ...base, ...overrides } as GameState;
}

function makeValidOutput(
  overrides: Partial<LlmStoryOutput> = {}
): LlmStoryOutput {
  return {
    speakerId: "qiaofeng" as const,
    narration: "He strikes fiercely",
    dialogue: "Take this!",
    action: {
      type: "skill",
      skillId: "test_skill",
      targetIds: ["xuzhu" as const],
    },
    stateDeltaSuggestion: {},
    ...overrides,
  };
}

describe("TurnProcessor", () => {
  let processor: TurnProcessor;
  let mockCharacters: Record<string, ReturnType<typeof vi.fn>>;
  let mockSkills: Record<string, ReturnType<typeof vi.fn>>;
  let mockMemory: Record<string, ReturnType<typeof vi.fn>>;
  let mockStates: Record<string, ReturnType<typeof vi.fn>>;
  let mockPrompts: Record<string, ReturnType<typeof vi.fn>>;
  let mockRules: Record<string, ReturnType<typeof vi.fn>>;
  let mockLlm: Record<string, ReturnType<typeof vi.fn>>;
  let mockAuditLog: Record<string, ReturnType<typeof vi.fn>>;
  let mockSpeakerSelector: Record<string, ReturnType<typeof vi.fn>>;
  let mockStats: Record<string, ReturnType<typeof vi.fn>>;
  let mockGetStoryPackage: ReturnType<typeof vi.fn>;

  const sessionId = "sess_001";
  const input: SendMessageRequest = { text: "攻击他！" };
  const character = makeCharacter();
  const skill = makeSkill();
  const gameState = makeGameState();
  const validOutput = makeValidOutput();

  beforeEach(() => {
    mockCharacters = { get: vi.fn(), list: vi.fn() };
    mockSkills = { get: vi.fn() };
    mockMemory = { append: vi.fn(), recent: vi.fn(), list: vi.fn().mockReturnValue([]) };
    mockStates = { get: vi.fn(), applyAssistantTurn: vi.fn() };
    mockPrompts = { buildPrompt: vi.fn() };
    mockRules = { validateOutput: vi.fn() };
    mockLlm = { complete: vi.fn(), stream: vi.fn() };
    mockAuditLog = { append: vi.fn() };
    mockSpeakerSelector = { select: vi.fn() };
    mockStats = { recordCompleteTurn: vi.fn() };
    mockGetStoryPackage = vi.fn();

    // Default mock behavior
    mockSpeakerSelector.select.mockReturnValue("qiaofeng");
    mockCharacters.get.mockReturnValue(character);
    mockCharacters.list.mockReturnValue([character]);
    mockStates.get.mockReturnValue(gameState);
    mockPrompts.buildPrompt.mockReturnValue("system prompt\nuser query");
    mockLlm.complete.mockResolvedValue({
      output: validOutput,
      raw: JSON.stringify(validOutput),
    });
    mockRules.validateOutput.mockReturnValue(validOutput);
    mockSkills.get.mockReturnValue(skill);
    mockStates.applyAssistantTurn.mockReturnValue({
      state: { ...gameState, round: 2 },
      delta: { "qiaofeng.mp": -10, "xuzhu.hp": -20 },
    });
    mockGetStoryPackage.mockReturnValue(undefined);

    processor = new TurnProcessor(
      mockCharacters as never,
      mockSkills as never,
      mockMemory as never,
      mockStates as never,
      mockPrompts as never,
      mockRules as never,
      mockLlm as never,
      mockAuditLog as never,
      mockSpeakerSelector as never,
      mockStats as never,
      mockGetStoryPackage
    );
  });

  // ---------------------------------------------------------------------------
  // sendMessage
  // ---------------------------------------------------------------------------

  it("sendMessage returns { message, gameState, debug }", async () => {
    const result = await processor.sendMessage(sessionId, input);

    expect(result).toHaveProperty("message");
    expect(result).toHaveProperty("gameState");
    expect(result).toHaveProperty("debug");

    expect(result.message.role).toBe("assistant");
    expect(result.message.speakerId).toBe("qiaofeng");
    expect(result.message.id).toMatch(/^msg_/);
    expect(result.message.content).toContain("He strikes fiercely");
    expect(result.message.content).toContain("乔峰");

    expect(result.debug.selectedSpeakerId).toBe("qiaofeng");
    expect(result.debug.usedSkill).toBe("test_skill");
    expect(result.debug.validation).toBe("passed");
  });

  it("sendMessage applies skill when skillId matches owner", async () => {
    const result = await processor.sendMessage(sessionId, input);

    expect(result.debug.usedSkill).toBe("test_skill");
    expect(result.message.usedSkills).toEqual(["test_skill"]);
    expect(mockSkills.get).toHaveBeenCalledWith("test_skill");
    expect(mockStates.applyAssistantTurn).toHaveBeenCalledWith(
      sessionId,
      "qiaofeng",
      validOutput,
      skill
    );
  });

  it("sendMessage does not apply skill on owner mismatch", async () => {
    const mismatchedSkill = makeSkill({ ownerId: "xuzhu" });
    mockSkills.get.mockReturnValue(mismatchedSkill);

    const result = await processor.sendMessage(sessionId, input);

    expect(result.debug.usedSkill).toBeNull();
    expect(result.message.usedSkills).toEqual([]);
    expect(mockStates.applyAssistantTurn).toHaveBeenCalledWith(
      sessionId,
      "qiaofeng",
      validOutput,
      undefined
    );
  });

  it("sendMessage validates output via ruleChecker", async () => {
    await processor.sendMessage(sessionId, input);

    expect(mockRules.validateOutput).toHaveBeenCalledWith(
      "qiaofeng",
      validOutput
    );
  });

  it("sendMessage records stats on successful turn", async () => {
    await processor.sendMessage(sessionId, input);

    expect(mockStats.recordCompleteTurn).toHaveBeenCalledTimes(1);
    const callArg = mockStats.recordCompleteTurn.mock.calls[0][0];
    expect(callArg.sessionId).toBe(sessionId);
    expect(callArg.round).toBe(1);
    expect(callArg.speakerId).toBe("qiaofeng");
    expect(callArg.validationResult).toBe("passed");
    expect(callArg.validationErrors).toEqual([]);
    expect(callArg.stateDelta).toEqual({ "qiaofeng.mp": -10, "xuzhu.hp": -20 });
    expect(callArg.stageBefore).toBe("opening");
    expect(typeof callArg.latencyMs).toBe("number");
  });

  it("sendMessage records failed stats and rethrows on validation error", async () => {
    const validationError = new Error("speaker mismatch");
    mockRules.validateOutput.mockImplementation(() => {
      throw validationError;
    });

    await expect(processor.sendMessage(sessionId, input)).rejects.toThrow(
      "speaker mismatch"
    );

    expect(mockStats.recordCompleteTurn).toHaveBeenCalledTimes(1);
    const callArg = mockStats.recordCompleteTurn.mock.calls[0][0];
    expect(callArg.validationResult).toBe("failed");
    expect(callArg.parsedOutput).toBeNull();
  });

  it("sendMessage writes audit log for llm_response", async () => {
    await processor.sendMessage(sessionId, input);

    expect(mockAuditLog.append).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "llm_response",
        sessionId,
        speakerId: "qiaofeng",
      })
    );
  });

  it("sendMessage writes session_completed audit log when game ends", async () => {
    const completedState = makeGameState({ status: "completed" });
    mockStates.applyAssistantTurn.mockReturnValue({
      state: completedState,
      delta: {},
    });

    await processor.sendMessage(sessionId, input);

    const calls = mockAuditLog.append.mock.calls.map((c: unknown[]) => c[0]);
    expect(calls.filter((c: { type: string }) => c.type === "session_completed")).toHaveLength(1);
  });

  it("sendMessage prepares turn: appends user message, selects speaker, reads state", async () => {
    await processor.sendMessage(sessionId, input);

    // User message appended
    const userMsgAppend = mockMemory.append.mock.calls.find(
      (c: unknown[]) => (c[0] as { role: string }).role === "user"
    );
    expect(userMsgAppend).toBeDefined();
    expect(userMsgAppend[0].content).toBe("攻击他！");

    // Speaker selected
    expect(mockSpeakerSelector.select).toHaveBeenCalledWith(sessionId, input);

    // State read
    expect(mockStates.get).toHaveBeenCalledWith(sessionId);
  });

  // ---------------------------------------------------------------------------
  // sendMessageStream
  // ---------------------------------------------------------------------------

  it("sendMessageStream yields meta, token, and done events in order", async () => {
    async function* mockStream() {
      yield "Hello ";
      yield "World";
    }
    mockLlm.stream.mockReturnValue(mockStream());

    const events: unknown[] = [];
    for await (const event of processor.sendMessageStream(sessionId, input)) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThanOrEqual(4);
    expect(events[0]).toEqual({
      type: "meta",
      speakerId: "qiaofeng",
      speakerName: "乔峰",
    });
    expect(events[1]).toEqual({
      type: "token",
      token: "Hello ",
      speakerId: "qiaofeng",
    });
    expect(events[2]).toEqual({
      type: "token",
      token: "World",
      speakerId: "qiaofeng",
    });
    const doneEvent = events[events.length - 1] as Record<string, unknown>;
    expect(doneEvent.type).toBe("done");
    expect(doneEvent.message).toBeDefined();
    expect(doneEvent.gameState).toBeDefined();
    expect(doneEvent.debug).toBeDefined();
  });

  // This test covers the invalid JSON path in stream
  it("sendMessageStream parses valid JSON from stream buffer", async () => {
    const outputJson = JSON.stringify(validOutput);
    async function* mockStream() {
      yield outputJson;
    }
    mockLlm.stream.mockReturnValue(mockStream());
    // For this path, rules.validateOutput will succeed
    mockRules.validateOutput.mockReturnValue(validOutput);

    const events: unknown[] = [];
    for await (const event of processor.sendMessageStream(sessionId, input)) {
      events.push(event);
    }

    // meta + token + done
    expect(events.length).toBeGreaterThanOrEqual(2);
    const doneEvent = events.find((e) => (e as { type: string }).type === "done") as Record<string, unknown> | undefined;
    expect(doneEvent).toBeDefined();
    expect((doneEvent as Record<string, unknown>).message).toBeDefined();
    expect((doneEvent as Record<string, unknown>).gameState).toBeDefined();
    expect((doneEvent as Record<string, unknown>).debug).toBeDefined();
  });

  it("sendMessageStream records stats after stream completes", async () => {
    const outputJson = JSON.stringify(validOutput);
    async function* mockStream() {
      yield outputJson;
    }
    mockLlm.stream.mockReturnValue(mockStream());
    mockRules.validateOutput.mockReturnValue(validOutput);

    // Consume stream fully
    const events: unknown[] = [];
    for await (const event of processor.sendMessageStream(sessionId, input)) {
      events.push(event);
    }

    expect(mockStats.recordCompleteTurn).toHaveBeenCalledTimes(1);
    const callArg = mockStats.recordCompleteTurn.mock.calls[0][0];
    expect(callArg.sessionId).toBe(sessionId);
    expect(callArg.validationResult).toBe("passed");
    expect(callArg.validationErrors).toEqual([]);
  });

  it("sendMessageStream records failed stats on validation error after stream", async () => {
    const outputJson = JSON.stringify(validOutput);
    async function* mockStream() {
      yield outputJson;
    }
    mockLlm.stream.mockReturnValue(mockStream());
    mockRules.validateOutput.mockImplementation(() => {
      throw new Error("invalid output");
    });

    // Consume stream — after tokens it should throw
    const events: unknown[] = [];
    await expect(
      (async () => {
        for await (const event of processor.sendMessageStream(sessionId, input)) {
          events.push(event);
        }
      })()
    ).rejects.toThrow("invalid output");

    expect(mockStats.recordCompleteTurn).toHaveBeenCalledTimes(1);
    const callArg = mockStats.recordCompleteTurn.mock.calls[0][0];
    expect(callArg.validationResult).toBe("failed");
    expect(callArg.parsedOutput).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  it("handles missing story package gracefully", async () => {
    mockGetStoryPackage.mockReturnValue(undefined);

    const result = await processor.sendMessage(sessionId, input);

    expect(result.debug.selectedSpeakerId).toBe("qiaofeng");
    expect(mockPrompts.buildPrompt).toHaveBeenCalled();
    const callArgs = (mockPrompts.buildPrompt as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(callArgs[0]).toBe("qiaofeng");
    expect(callArgs[3]).toBe("攻击他！");
    expect(callArgs[4]).toBeUndefined();
  });

  it("handles streaming with step-by-step token emission", async () => {
    const tokens = ['{"speakerId": "qiaofeng", "narri', 'tion": "Te', 'st", "dialogue": "Hi", "action": {"type": "observe", "targetIds": []}}'];
    async function* mockStream() {
      for (const t of tokens) yield t;
    }
    mockLlm.stream.mockReturnValue(mockStream());
    const fallbackOutput: LlmStoryOutput = {
      speakerId: "qiaofeng",
      narration: '{"speakerId": "qiaofeng", "narrition": "Test", "dialogue": "Hi", "action": {"type": "observe", "targetIds": []}}',
      dialogue: "",
      action: { type: "command", targetIds: [] },
      stateDeltaSuggestion: {},
    };
    // After JSON parsing fails, the catch block creates a fallback
    // which will still have empty dialogue → validateOutput will throw
    mockRules.validateOutput.mockImplementation(() => {
      throw new Error("dialogue cannot be empty");
    });

    const events: unknown[] = [];
    await expect(
      (async () => {
        for await (const event of processor.sendMessageStream(sessionId, input)) {
          events.push(event);
        }
      })()
    ).rejects.toThrow("dialogue cannot be empty");

    // 1 meta + 3 tokens = 4 events before error
    expect(events.length).toBe(4);
    const tokenEvents = events.filter(
      (e) => (e as { type: string }).type === "token"
    );
    expect(tokenEvents).toHaveLength(3);
    expect((tokenEvents[0] as { token: string }).token).toContain("narri");
    expect((tokenEvents[1] as { token: string }).token).toContain("tion");
    expect((tokenEvents[2] as { token: string }).token).toContain("dialogue");
  });
});
