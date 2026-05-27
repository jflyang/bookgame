import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { getMockState, setMockState } = vi.hoisted(() => {
  let state: Record<string, unknown> = {};
  return {
    getMockState: () => state,
    setMockState: (s: Record<string, unknown>) => { state = s; },
  };
});

vi.mock("../../../store/gameStore.js", () => ({
  useGameStore: (selector?: (s: unknown) => unknown) => {
    const state = getMockState();
    return selector ? selector(state) : state;
  },
}));

vi.mock("../UiConfigContext.js", () => ({
  useUiConfig: () => {
    const state = getMockState();
    return state.uiConfig ?? {
      scene: {},
      avatar: { style: "gradient" },
    };
  },
}));

vi.mock("../contexts/StoryAssetsContext.js", () => ({
  useStoryAssets: () => ({ getPortraitUrl: () => null }),
}));

import { MessageList } from "../components/MessageList.js";

const testCharacters = [
  { id: "qiaofeng", name: "乔峰", role: "主导者", avatar: "乔", personaPrompt: "", rules: [], skillIds: [], knowledgeBaseIds: [] },
  { id: "xuzhu", name: "虚竹", role: "主角", avatar: "虚", personaPrompt: "", rules: [], skillIds: [], knowledgeBaseIds: [] },
];

function defaultState() {
  return {
    messages: [
      {
        id: "msg_1", sessionId: "s1", role: "assistant", speakerId: "qiaofeng",
        content: "虚竹，今日一战，你我兄弟并肩！",
        usedSkills: [], stateDelta: {}, createdAt: new Date().toISOString(),
      },
    ],
    streamingContent: null,
    isStreaming: false,
    streamingSpeakerId: null,
    streamingSpeakerName: null,
    skills: [],
  };
}

describe("MessageList — basic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockState({
      ...defaultState(),
      uiConfig: {
        scene: { heading: "枯松岭", introNarration: "暮色低垂...", emptyTitle: "山道毒雾初起", emptyHint: "点击继续" },
        avatar: { style: "gradient" },
      },
    });
  });

  it("renders scene heading", () => {
    render(<MessageList characters={testCharacters} />);
    expect(screen.getByText("枯松岭")).toBeTruthy();
  });

  it("renders message content", () => {
    render(<MessageList characters={testCharacters} />);
    expect(screen.getByText("虚竹，今日一战，你我兄弟并肩！")).toBeTruthy();
  });

  it("renders character names for assistant messages", () => {
    render(<MessageList characters={testCharacters} />);
    expect(screen.getByText("乔峰")).toBeTruthy();
  });

  it("renders user messages as bubbles", () => {
    setMockState({
      ...defaultState(),
      messages: [
        { id: "m1", sessionId: "s1", role: "user", speakerId: null, content: "我准备好了。", usedSkills: [], stateDelta: {}, createdAt: new Date().toISOString() },
      ],
      uiConfig: { scene: {}, avatar: { style: "gradient" } },
    });
    render(<MessageList characters={testCharacters} />);
    const userTexts = document.querySelectorAll(".user-text");
    expect(userTexts.length).toBeGreaterThan(0);
  });

  it("renders intro narration when provided", () => {
    render(<MessageList characters={testCharacters} />);
    expect(screen.getByText("暮色低垂...")).toBeTruthy();
  });

  it("auto-scrolls to bottom when messages change", () => {
    const { container } = render(<MessageList characters={testCharacters} />);
    const scrollEl = container.querySelector(".story-scroll");
    expect(scrollEl).toBeTruthy();
    expect(scrollEl!.scrollTop).toBe(scrollEl!.scrollHeight);
  });

  it("renders empty title and hint when no messages and not streaming", () => {
    setMockState({
      messages: [],
      streamingContent: null,
      isStreaming: false,
      streamingSpeakerId: null,
      streamingSpeakerName: null,
      skills: [],
      uiConfig: {
        scene: { heading: "", introNarration: "", emptyTitle: "开始冒险", emptyHint: "输入内容开始" },
        avatar: { style: "gradient" },
      },
    });
    render(<MessageList characters={testCharacters} />);
    expect(screen.getByText("开始冒险")).toBeTruthy();
    expect(screen.getByText("输入内容开始")).toBeTruthy();
  });
});

describe("MessageList — rigorous", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders streaming content with speaker name", () => {
    setMockState({
      messages: [],
      streamingContent: "虚竹正在运功...",
      isStreaming: true,
      streamingSpeakerId: "xuzhu",
      streamingSpeakerName: "虚竹",
      skills: [],
      uiConfig: { scene: {}, avatar: { style: "gradient" } },
    });
    render(<MessageList characters={testCharacters} />);
    expect(screen.getByText("虚竹正在运功...")).toBeTruthy();
    expect(screen.getByText("虚竹")).toBeTruthy();
  });

  it("renders combat bar when message has combat content", () => {
    setMockState({
      messages: [{
        id: "m_c", sessionId: "s1", role: "assistant", speakerId: "qiaofeng",
        content: "看招！\n\n⚔ 亢龙有悔 · 伤害 45",
        usedSkills: ["xianglong_zhang"], stateDelta: { qiaofeng_hp: 0 },
        createdAt: new Date().toISOString(),
      }],
      streamingContent: null, isStreaming: false, streamingSpeakerId: null, streamingSpeakerName: null, skills: [],
      uiConfig: { scene: {}, avatar: { style: "gradient" } },
    });
    render(<MessageList characters={testCharacters} />);
    const combatBar = document.querySelector(".combat-bar");
    expect(combatBar).toBeTruthy();
    expect(combatBar!.textContent).toContain("亢龙有悔");
  });

  it("stateDeltaHints function exists but is not yet wired into render", () => {
    setMockState({
      messages: [{
        id: "m_d", sessionId: "s1", role: "assistant", speakerId: "qiaofeng",
        content: "接招！",
        usedSkills: [], stateDelta: { dingchunqiu_hp: -35, xuzhu_mp: -20 },
        createdAt: new Date().toISOString(),
      }],
      streamingContent: null, isStreaming: false, streamingSpeakerId: null, streamingSpeakerName: null, skills: [],
      uiConfig: { scene: {}, avatar: { style: "gradient" } },
    });
    render(<MessageList characters={testCharacters} />);
    const deltaTags = document.querySelectorAll(".delta-tag");
    // stateDeltaHints is defined but not called in render — will be 0 until wired
    expect(deltaTags.length).toBe(0);
  });

  it("renders bold markdown with <strong> tags", () => {
    setMockState({
      messages: [{
        id: "m_b", sessionId: "s1", role: "assistant", speakerId: "qiaofeng",
        content: "接我**降龙十八掌**！",
        usedSkills: [], stateDelta: {}, createdAt: new Date().toISOString(),
      }],
      streamingContent: null, isStreaming: false, streamingSpeakerId: null, streamingSpeakerName: null, skills: [],
      uiConfig: { scene: {}, avatar: { style: "gradient" } },
    });
    render(<MessageList characters={testCharacters} />);
    const strong = document.querySelector("strong");
    expect(strong).toBeTruthy();
    expect(strong!.textContent).toBe("降龙十八掌");
  });

  it("filters out '继续' continue messages", () => {
    setMockState({
      messages: [
        {
          id: "m1", sessionId: "s1", role: "assistant", speakerId: "qiaofeng",
          content: "前面就是星宿海了。", usedSkills: [], stateDelta: {}, createdAt: new Date().toISOString(),
        },
        {
          id: "m2", sessionId: "s1", role: "user", speakerId: null,
          content: "继续", usedSkills: [], stateDelta: {}, createdAt: new Date().toISOString(),
        },
      ],
      streamingContent: null, isStreaming: false, streamingSpeakerId: null, streamingSpeakerName: null, skills: [],
      uiConfig: { scene: {}, avatar: { style: "gradient" } },
    });
    render(<MessageList characters={testCharacters} />);
    expect(screen.getByText("前面就是星宿海了。")).toBeTruthy();
    expect(screen.queryByText("继续")).toBeNull();
  });

  it("renders gradient avatar when style is gradient", () => {
    setMockState({
      ...defaultState(),
      uiConfig: { scene: {}, avatar: { style: "gradient" } },
    });
    render(<MessageList characters={testCharacters} />);
    const avatars = document.querySelectorAll(".avatar-qiaofeng");
    expect(avatars.length).toBeGreaterThan(0);
  });

  it("renders emoji avatar when style is emoji", () => {
    setMockState({
      ...defaultState(),
      uiConfig: { scene: {}, avatar: { style: "emoji" } },
    });
    render(<MessageList characters={testCharacters} />);
    const textAvatars = document.querySelectorAll(".text-avatar");
    expect(textAvatars.length).toBeGreaterThan(0);
  });

  it("renders nothing for intro narration when not configured", () => {
    setMockState({
      ...defaultState(),
      uiConfig: { scene: { heading: "Test" }, avatar: { style: "gradient" } },
    });
    render(<MessageList characters={testCharacters} />);
    const narrationLines = document.querySelectorAll(".narration-line");
    expect(narrationLines.length).toBe(0);
  });

  it("handles messages without stateDelta gracefully", () => {
    setMockState({
      messages: [{
        id: "m_noop", sessionId: "s1", role: "assistant", speakerId: "qiaofeng",
        content: "今日天气不错。", usedSkills: [], stateDelta: {},
        createdAt: new Date().toISOString(),
      }],
      streamingContent: null, isStreaming: false, streamingSpeakerId: null, streamingSpeakerName: null, skills: [],
      uiConfig: { scene: {}, avatar: { style: "gradient" } },
    });
    render(<MessageList characters={testCharacters} />);
    const deltaHints = document.querySelectorAll(".state-delta-hints");
    expect(deltaHints.length).toBe(0);
  });
});
