import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../../../store/gameStore.js", () => ({
  useGameStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      messages: [
        {
          id: "msg_1",
          sessionId: "s1",
          role: "assistant",
          speakerId: "qiaofeng",
          content: "虚竹，今日一战，你我兄弟并肩！",
          usedSkills: [],
          stateDelta: {},
          createdAt: new Date().toISOString(),
        },
        {
          id: "msg_2",
          sessionId: "s1",
          role: "user",
          speakerId: null,
          content: "我准备好了。",
          usedSkills: [],
          stateDelta: {},
          createdAt: new Date().toISOString(),
        },
        {
          id: "msg_3",
          sessionId: "s1",
          role: "assistant",
          speakerId: "xuzhu",
          content: "多谢乔大哥！",
          usedSkills: ["skill_1"],
          stateDelta: { hp: -30 },
          createdAt: new Date().toISOString(),
        },
      ],
      streamingContent: null,
      isStreaming: false,
      streamingSpeakerId: null,
      streamingSpeakerName: null,
      skills: [{ id: "skill_1", name: "天山六阳掌", description: "", type: "attack", power: 60, accuracy: 90, cost: 30, target: "single" }],
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock("../UiConfigContext.js", () => ({
  useUiConfig: () => ({
    scene: {
      heading: "枯松岭",
      introNarration: "暮色低垂...",
      emptyTitle: "山道毒雾初起",
      emptyHint: "点击继续",
    },
    avatar: { style: "gradient" },
  }),
}));

vi.mock("../contexts/StoryAssetsContext.js", () => ({
  useStoryAssets: () => ({ getPortraitUrl: () => null }),
}));

import { MessageList } from "../components/MessageList.js";

const testCharacters = [
  { id: "qiaofeng", name: "乔峰", role: "主导者", avatar: "乔", personaPrompt: "", rules: [], skillIds: [], knowledgeBaseIds: [] },
  { id: "xuzhu", name: "虚竹", role: "主角", avatar: "虚", personaPrompt: "", rules: [], skillIds: [], knowledgeBaseIds: [] },
];

describe("MessageList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders scene heading", () => {
    render(<MessageList characters={testCharacters} />);
    expect(screen.getByText("枯松岭")).toBeTruthy();
  });

  it("renders message content", () => {
    render(<MessageList characters={testCharacters} />);
    expect(screen.getByText("虚竹，今日一战，你我兄弟并肩！")).toBeTruthy();
    expect(screen.getByText("我准备好了。")).toBeTruthy();
  });

  it("renders character names for assistant messages", () => {
    render(<MessageList characters={testCharacters} />);
    expect(screen.getByText("乔峰")).toBeTruthy();
    expect(screen.getByText("虚竹")).toBeTruthy();
  });

  it("renders user messages as bubbles", () => {
    render(<MessageList characters={testCharacters} />);
    const bubbles = document.querySelectorAll(".user-bubble");
    expect(bubbles.length).toBeGreaterThan(0);
  });

  it("shows skill badges on messages with used skills", () => {
    render(<MessageList characters={testCharacters} />);
    expect(screen.getByText("天山六阳掌")).toBeTruthy();
  });

  it("renders scene heading even with messages", () => {
    render(<MessageList characters={testCharacters} />);
    // Scene heading always visible
    expect(screen.getByText("枯松岭")).toBeTruthy();
  });
});
