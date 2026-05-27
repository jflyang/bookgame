import { describe, it, expect, beforeEach, vi } from "vitest";
import { PromptService } from "../promptService.js";
import type { Character, GameState, Message, StoryPackage, StoryPromptRule } from "@story-game/shared";

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: "qiaofeng",
    name: "乔峰",
    role: "主导者",
    avatar: "乔",
    personaPrompt: "You are Qiao Feng, a brave hero.",
    rules: ["be brave"],
    skillIds: ["xianglong_zhang"],
    knowledgeBaseIds: ["kb_wulin"],
    ...overrides,
  };
}

function makeXuzhu(): Character {
  return {
    id: "xuzhu",
    name: "虚竹",
    role: "行动者",
    avatar: "虚",
    personaPrompt: "You are Xu Zhu, a gentle monk.",
    rules: [],
    skillIds: ["beiming_shengong"],
    knowledgeBaseIds: [],
  };
}

function makeGameState(overrides: Record<string, unknown> = {}): GameState {
  return {
    sessionId: "sess_001",
    round: 3,
    status: "active",
    lastSpeakerId: "xuzhu",
    characters: [
      { characterId: "qiaofeng", hp: 85, mp: 70, conditions: [], isDefeated: false },
      { characterId: "xuzhu", hp: 100, mp: 200, conditions: ["poisoned"], isDefeated: false },
    ],
    scenario: {
      id: "sc_001",
      title: "Test Story",
      currentStage: "climax",
      currentGoal: "Defeat the villain",
      premise: "A test premise",
      rules: [],
      stages: ["opening", "climax", "ending"],
      stageDetails: [
        { id: "opening", title: "开端", description: "故事开始" },
        { id: "climax", title: "高潮", description: "决战时刻", enterWhen: "到达山顶", guidance: "可以全力出手了" },
      ],
      initialStates: [],
    },
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    scenarioId: "sc_001",
    ...overrides,
  } as GameState;
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg_001",
    sessionId: "sess_001",
    role: "assistant",
    speakerId: "qiaofeng",
    content: "乔峰：看招！",
    usedSkills: [],
    stateDelta: {},
    createdAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeStoryPackage(overrides: Partial<StoryPackage> = {}): StoryPackage {
  return {
    id: "pkg_001",
    title: "Test Package",
    description: "A test",
    storySettingPrompt: "这是一个发生在武侠世界的恩怨故事。",
    scenario: {
      id: "sc_001",
      title: "Test",
      currentStage: "climax",
      currentGoal: "Defeat",
      premise: "Test",
      rules: [],
      stages: ["opening", "climax", "ending"],
      initialStates: [],
    },
    characters: [makeCharacter(), makeXuzhu()],
    skills: [],
    knowledgeDocuments: [],
    promptRules: [
      { id: "rule_1", title: "禁止现代词汇", content: "不得出现任何现代词汇，如{currentCharacterName}。", enabled: true },
    ],
    debugConfig: { showPromptLayers: false, showRawOutput: false, showValidation: false },
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("PromptService", () => {
  let svc: PromptService;
  let mockCharacters: Record<string, ReturnType<typeof vi.fn>>;
  let mockAgents: Record<string, ReturnType<typeof vi.fn>>;

  const character = makeCharacter();
  const xuzhu = makeXuzhu();

  beforeEach(() => {
    mockCharacters = { get: vi.fn(), list: vi.fn() };
    mockAgents = { buildAgentContext: vi.fn() };

    mockCharacters.get.mockReturnValue(character);
    mockCharacters.list.mockReturnValue([character, xuzhu]);
    mockAgents.buildAgentContext.mockReturnValue({
      character,
      knowledgeHits: [
        {
          documentId: "kb_wulin",
          title: "武林秘籍",
          content: "降龙十八掌秘诀",
          score: 3,
        },
      ],
    });

    svc = new PromptService(
      mockCharacters as never,
      mockAgents as never
    );
  });

  it("buildPrompt includes system instructions and JSON format requirement", () => {
    const state = makeGameState();
    const history = [makeMessage()];

    const prompt = svc.buildPrompt(
      "qiaofeng",
      state,
      history,
      "攻击虚竹",
      undefined
    );

    expect(prompt).toContain("多人角色互动故事游戏");
    expect(prompt).toContain("输出必须是符合约定 schema 的 JSON");
    expect(prompt).toContain("speakerId,narration,dialogue,action");
  });

  it("buildPrompt includes character persona", () => {
    const prompt = svc.buildPrompt(
      "qiaofeng",
      makeGameState(),
      [],
      "hello",
      undefined
    );

    expect(prompt).toContain("乔峰");
    expect(prompt).toContain("You are Qiao Feng, a brave hero.");
  });

  it("buildPrompt lists other characters", () => {
    const prompt = svc.buildPrompt(
      "qiaofeng",
      makeGameState(),
      [],
      "hello",
      undefined
    );

    expect(prompt).toContain("虚竹");
    expect(prompt).toContain("行动者");
  });

  it("buildPrompt includes game state", () => {
    const prompt = svc.buildPrompt(
      "qiaofeng",
      makeGameState(),
      [],
      "hello",
      undefined
    );

    expect(prompt).toContain('"hp":85');
    expect(prompt).toContain('"mp":70');
    expect(prompt).toContain('"hp":100');
  });

  it("buildPrompt includes stage guide with current stage", () => {
    const prompt = svc.buildPrompt(
      "qiaofeng",
      makeGameState(),
      [],
      "hello",
      undefined
    );

    expect(prompt).toContain("当前剧情阶段：climax");
    expect(prompt).toContain("可用剧情阶段：opening -> climax -> ending");
    expect(prompt).toContain("当前剧情目标：Defeat the villain");
    expect(prompt).toContain("高潮");
    expect(prompt).toContain("决战时刻");
  });

  it("buildPrompt includes storyPackage rules when provided", () => {
    const pkg = makeStoryPackage();

    const prompt = svc.buildPrompt(
      "qiaofeng",
      makeGameState(),
      [],
      "hello",
      pkg
    );

    expect(prompt).toContain("【故事包规则：禁止现代词汇】");
    expect(prompt).toContain("禁止现代词汇");
    // Variable substitution: {currentCharacterName} should be replaced with 乔峰
    expect(prompt).toContain("乔峰");
  });

  it("buildPrompt includes story setting from package", () => {
    const pkg = makeStoryPackage();

    const prompt = svc.buildPrompt(
      "qiaofeng",
      makeGameState(),
      [],
      "hello",
      pkg
    );

    expect(prompt).toContain("这是一个发生在武侠世界的恩怨故事");
  });

  it("buildPrompt includes knowledge hits from agent context", () => {
    const prompt = svc.buildPrompt(
      "qiaofeng",
      makeGameState(),
      [],
      "降龙十八掌",
      undefined
    );

    expect(mockAgents.buildAgentContext).toHaveBeenCalledWith(
      "qiaofeng",
      "降龙十八掌"
    );
    expect(prompt).toContain("降龙十八掌秘诀");
  });

  it("buildPrompt includes recent history", () => {
    const history = [makeMessage({ content: "乔峰：看招！" })];

    const prompt = svc.buildPrompt(
      "qiaofeng",
      makeGameState(),
      history,
      "hello",
      undefined
    );

    expect(prompt).toContain("乔峰：看招！");
  });

  it("buildPrompt ignores disabled rules", () => {
    const pkg = makeStoryPackage({
      promptRules: [
        { id: "r1", title: "Enabled Rule", content: "这是启用规则", enabled: true },
        { id: "r2", title: "Disabled Rule", content: "这是禁用规则", enabled: false },
      ],
    });

    const prompt = svc.buildPrompt(
      "qiaofeng",
      makeGameState(),
      [],
      "hello",
      pkg
    );

    expect(prompt).toContain("这是启用规则");
    expect(prompt).not.toContain("这是禁用规则");
  });

  it("buildPrompt uses scenario JSON when no storyPackage setting prompt", () => {
    const prompt = svc.buildPrompt(
      "qiaofeng",
      makeGameState(),
      [],
      "hello",
      undefined
    );

    // Should use JSON.stringify(state.scenario) as scenario setting
    expect(prompt).toContain("Test Story");
    expect(prompt).toContain("climax");
  });
});
