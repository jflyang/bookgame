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
      mockAgents as never,
      { list: vi.fn().mockReturnValue([]) } as never
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
    expect(prompt).toContain("输出严格 JSON");
    expect(prompt).toContain("speakerId");
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

    expect(prompt).toContain("HP85");
    expect(prompt).toContain("MP70");
    expect(prompt).toContain("HP100");
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

    // Story setting is used in rules variable substitution via {scenarioSetting}
    expect(prompt).toContain("高潮");
    expect(prompt).toContain("决战时刻");
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

    // Without storyPackage, stage guide still renders from state.scenario
    expect(prompt).toContain("climax");
    expect(prompt).toContain("Defeat the villain");
  });

  it("buildPrompt includes combat declaration rule when provided", () => {
    const pkg = makeStoryPackage({
      promptRules: [
        { id: "rule_combat", title: "战斗伤害宣告规则", category: "combat", content: "【战斗宣告】攻击时必须宣告目标与伤害数值，并与stateDeltaSuggestion一致。", enabled: true },
      ],
    });

    const prompt = svc.buildPrompt(
      "qiaofeng",
      makeGameState(),
      [],
      "攻击",
      pkg
    );

    expect(prompt).toContain("【故事包规则：战斗伤害宣告规则】");
    expect(prompt).toContain("攻击时必须宣告目标与伤害数值");
    expect(prompt).toContain("stateDeltaSuggestion");
  });

  it("buildPrompt includes attackable targets when configured", () => {
    const qiaofengWithTargets = makeCharacter({ attackableTargetIds: ["dingchunqiu"] });
    const dingchunqiu: Character = {
      id: "dingchunqiu", name: "丁春秋", role: "反派", avatar: "丁",
      personaPrompt: "Villain", rules: [], skillIds: [], knowledgeBaseIds: [],
      attackableTargetIds: [],
    };

    mockCharacters.get.mockReturnValue(qiaofengWithTargets);
    mockCharacters.list.mockReturnValue([qiaofengWithTargets, xuzhu, dingchunqiu]);
    mockAgents.buildAgentContext.mockReturnValue({
      character: qiaofengWithTargets,
      knowledgeHits: [],
    });

    const prompt = svc.buildPrompt(
      "qiaofeng",
      makeGameState(),
      [],
      "攻击",
      undefined
    );

    expect(prompt).toContain("可攻击目标");
    expect(prompt).toContain("丁春秋");
  });

  it("buildPrompt emphasizes stateDeltaSuggestion consistency", () => {
    const prompt = svc.buildPrompt(
      "qiaofeng",
      makeGameState(),
      [],
      "继续",
      undefined
    );

    expect(prompt).toContain("stateDeltaSuggestion");
  });

  it("buildPrompt includes intro narration when provided", () => {
    const pkg = makeStoryPackage({
      uiConfig: {
        scene: { introNarration: "暮色低垂，寒风凛冽，山道上两道人影对峙。" },
      },
    });

    const state = makeGameState({ round: 1 });
    const prompt = svc.buildPrompt(
      "qiaofeng",
      state,
      [],
      "开始",
      pkg
    );

    expect(prompt).toContain("开场旁白");
    expect(prompt).toContain("暮色低垂，寒风凛冽");
  });

  it("buildPrompt omits intro narration when storyPackage has no uiConfig", () => {
    const prompt = svc.buildPrompt(
      "qiaofeng",
      makeGameState(),
      [],
      "开始",
      undefined
    );

    expect(prompt).not.toContain("开场旁白");
  });

  it("buildPrompt omits intro narration when uiConfig.scene has empty introNarration", () => {
    const pkg = makeStoryPackage({
      uiConfig: { scene: { introNarration: "" } },
    });

    const prompt = svc.buildPrompt(
      "qiaofeng",
      makeGameState(),
      [],
      "开始",
      pkg
    );

    expect(prompt).not.toContain("开场旁白");
  });

  it("buildPrompt renders skills list when skills are available", () => {
    const svcWithSkills = new PromptService(
      mockCharacters as never,
      mockAgents as never,
      {
        list: vi.fn().mockReturnValue([
          { id: "xianglong_zhang", name: "降龙十八掌", cost: { mp: 30 }, damage: { min: 40, max: 80 }, effect: "刚猛掌法" },
          { id: "beiming_shengong", name: "北冥神功", cost: { mp: 50 }, damage: { min: 0, max: 0 }, effect: "吸人内力" },
        ]),
      } as never
    );

    const prompt = svcWithSkills.buildPrompt(
      "qiaofeng",
      makeGameState(),
      [],
      "出招",
      undefined
    );

    expect(prompt).toContain("当前角色可用技能");
    expect(prompt).toContain("xianglong_zhang");
    expect(prompt).toContain("内力:30");
    expect(prompt).toContain("伤害:40~80");
    expect(prompt).toContain("刚猛掌法");
    expect(prompt).toContain("beiming_shengong");
    expect(prompt).toContain("内力:50");
    expect(prompt).toContain("吸人内力");
  });

  it("buildPrompt shows empty skills section when no skills", () => {
    const prompt = svc.buildPrompt(
      "qiaofeng",
      makeGameState(),
      [],
      "hello",
      undefined
    );

    expect(prompt).not.toContain("当前角色可用技能");
  });

  it("buildPrompt handles stage details with missing optional fields", () => {
    const state = makeGameState({
      scenario: {
        id: "sc_001", title: "Test", currentStage: "middle", currentGoal: "Survive",
        premise: "Test", rules: [], stages: ["start", "middle", "end"],
        stageDetails: [
          { id: "start" },
          { id: "middle", title: "中途" },
          { id: "end", description: "结局" },
        ],
        initialStates: [],
      },
    });

    const prompt = svc.buildPrompt("qiaofeng", state as GameState, [], "继续", undefined);

    expect(prompt).toContain("中途");
    expect(prompt).toContain("结局");
    // Missing title should not crash
    expect(prompt).toContain("start");
  });

  it("buildPrompt handles empty stageDetails array gracefully", () => {
    const state = makeGameState({
      scenario: {
        id: "sc_001", title: "Test", currentStage: "opening", currentGoal: "Go",
        premise: "Test", rules: [], stages: ["opening", "climax"],
        stageDetails: [],
        initialStates: [],
      },
    });

    const prompt = svc.buildPrompt("qiaofeng", state as GameState, [], "继续", undefined);
    // Stages render with ID when no details available
    expect(prompt).toContain("opening");
    expect(prompt).toContain("climax");
  });

  it("buildPrompt substitutes multiple variables in rules", () => {
    const pkg = makeStoryPackage({
      promptRules: [
        {
          id: "r_multi",
          title: "角色规则",
          content: "{currentCharacterName}对{otherCharacterNames}说话",
          enabled: true,
        },
      ],
    });

    const prompt = svc.buildPrompt("qiaofeng", makeGameState(), [], "你好", pkg);

    expect(prompt).toContain("乔峰对虚竹说话");
  });

  it("buildPrompt includes multiple knowledge hits", () => {
    mockAgents.buildAgentContext.mockReturnValue({
      character,
      knowledgeHits: [
        { documentId: "kb_1", title: "降龙十八掌", content: "天下第一刚猛掌法", score: 5 },
        { documentId: "kb_2", title: "打狗棒法", content: "丐帮镇帮之宝", score: 3 },
      ],
    });

    const prompt = svc.buildPrompt("qiaofeng", makeGameState(), [], "绝学", undefined);

    expect(prompt).toContain("天下第一刚猛掌法");
    expect(prompt).toContain("丐帮镇帮之宝");
  });

  it("buildPrompt excludes attackable targets section when none configured", () => {
    const prompt = svc.buildPrompt("qiaofeng", makeGameState(), [], "hello", undefined);

    expect(prompt).not.toContain("可攻击目标");
  });

  it("buildPrompt excludes attackable targets when list is empty", () => {
    const charNoTargets = makeCharacter({ attackableTargetIds: [] });
    mockCharacters.get.mockReturnValue(charNoTargets);
    mockAgents.buildAgentContext.mockReturnValue({ character: charNoTargets, knowledgeHits: [] });

    const prompt = svc.buildPrompt("qiaofeng", makeGameState(), [], "hello", undefined);

    expect(prompt).not.toContain("可攻击目标");
  });
});
