import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Use vi.hoisted to create a mock useGameStore whose return value we control
// per-test via mockReturnValue in beforeEach.
// ---------------------------------------------------------------------------
const { mockUseGameStore, mockStart, mockContinueStory } = vi.hoisted(() => {
  const mSt = vi.fn().mockResolvedValue(undefined);
  const mCs = vi.fn().mockResolvedValue(undefined);
  return {
    mockUseGameStore: vi.fn(),
    mockStart: mSt,
    mockContinueStory: mCs,
  };
});

vi.mock("../../../store/gameStore.js", () => ({
  useGameStore: mockUseGameStore,
}));

vi.mock("../UiConfigContext.js", () => {
  const P = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  return {
    default: { Provider: P, Consumer: ({ children }: { children: React.ReactNode }) => <>{children}</> },
    useLabels: () => ({
      interactiveStory: "互动故事", statusCompleted: "已结束",
      statusActive: "进行中", round: "回合", continue: "继续",
      autoPlay: "自动继续", send: "发送",
      rules: "故事规则", scenarioRules: "剧情规则",
      promptRules: "提示词规则", currentStatus: "当前状态",
      currentStage: "当前阶段", storyManagement: "故事管理",
      viewRules: "查看规则", hp: "气血", mp: "内力",
    }),
    useUiConfig: () => ({}),
  };
});

vi.mock("../components/CharacterRail.js", () => ({
  CharacterRail: () => <div data-testid="character-rail" />,
}));
vi.mock("../components/Composer.js", () => ({
  Composer: () => <div data-testid="composer" />,
}));
vi.mock("../components/MessageList.js", () => ({
  MessageList: () => <div data-testid="message-list" />,
}));
vi.mock("../performances/StoryPerformanceRuntime.js", () => ({
  StoryPerformanceRuntime: () => null,
}));
vi.mock("../contexts/StoryAssetsContext.js", () => ({
  StoryAssetsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../contexts/AudioManager.js", () => ({
  AudioManagerProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../hooks/useCustomFonts.js", () => ({ useCustomFonts: () => {} }));
vi.mock("../hooks/useCustomCss.js", () => ({ useCustomCss: () => {} }));

import { PlayApp } from "../PlayApp.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeGameState(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: "sess1", round: 3, status: "active", lastSpeakerId: "qiaofeng",
    characters: [{ characterId: "qiaofeng", hp: 700, mp: 800, conditions: [], isDefeated: false }],
    scenario: {
      id: "scenario1", title: "虚竹除害星宿老怪", premise: "test",
      currentStage: "origin", stages: ["origin"], stageDetails: [], currentGoal: "打败丁春秋",
      rules: ["不可直接杀死丁春秋"], initialStates: [],
    },
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeStoryPackage() {
  return {
    id: "pkg_1", title: "虚竹除害星宿老怪", description: "test",
    hidden: false, storySettingPrompt: "test",
    uiConfig: { layout: { showCharacterPanel: true, showQuickActions: true, showAutoPlay: true }, avatar: { style: "gradient" } },
    scenario: { id: "s1", title: "", premise: "", currentStage: "origin", currentGoal: "", rules: [], stages: ["origin"], initialStates: [] },
    characters: [], skills: [], knowledgeDocuments: [], promptRules: [],
    debugConfig: { showPromptLayers: false, showRawOutput: false, showValidation: false },
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  };
}

function buildDefaultState() {
  return {
    loadStoryPackages: vi.fn().mockResolvedValue(undefined),
    storyPackages: [makeStoryPackage()],
    start: mockStart,
    gameState: makeGameState(),
    sessionId: "sess1",
    characters: [{ id: "qiaofeng", name: "乔峰", role: "主导者", avatar: "乔", personaPrompt: "", rules: [], skillIds: [], knowledgeBaseIds: [] }],
    continueStory: mockContinueStory,
    isSending: false,
    isAutoPlaying: false,
    setAutoPlay: vi.fn(),
    editingPackageId: "pkg_1",
    error: null as string | null,
    saves: [] as Record<string, unknown>[],
    loadSaves: vi.fn().mockResolvedValue(undefined),
    saveCurrentSession: vi.fn().mockResolvedValue(undefined),
    loadSavedSession: vi.fn().mockResolvedValue(undefined),
    deleteSavedSession: vi.fn().mockResolvedValue(undefined),
    messages: [],
    streamingContent: null,
    isStreaming: false,
    streamingSpeakerId: null,
    streamingSpeakerName: null,
    skills: [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("PlayApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGameStore.mockReturnValue(buildDefaultState());
  });

  afterEach(() => { vi.useRealTimers(); });

  it("renders story package nav sidebar with title", () => {
    render(<PlayApp />);
    const titles = screen.getAllByText("虚竹除害星宿老怪");
    expect(titles.length).toBeGreaterThanOrEqual(1);
    // Confirm the sidebar shows the package name
    expect(screen.getByTitle("虚竹除害星宿老怪")).toBeTruthy();
  });

  it("auto-starts first story when no session", () => {
    const state = buildDefaultState();
    state.sessionId = null;
    mockUseGameStore.mockReturnValue(state);
    render(<PlayApp />);
    expect(mockStart).toHaveBeenCalledWith("pkg_1");
  });

  it("shows game state: title, round, and status badge", () => {
    render(<PlayApp />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toBe("虚竹除害星宿老怪");
    expect(screen.getByText("回合 3")).toBeTruthy();
    // Status badge shows round number when active (not "completed" class)
    const badge = screen.getByText("回合 3").closest(".status-badge");
    expect(badge?.className).not.toContain("completed");
  });

  it("auto-play timer triggers continueStory after 3000ms", () => {
    vi.useFakeTimers();
    const state = buildDefaultState();
    state.isAutoPlaying = true;
    state.gameState = makeGameState({ status: "active" });
    mockUseGameStore.mockReturnValue(state);
    render(<PlayApp />);
    vi.advanceTimersByTime(3000);
    expect(mockContinueStory).toHaveBeenCalledTimes(1);
  });

  it("hides character rail when showCharacterPanel is false", () => {
    const pkg = makeStoryPackage();
    pkg.uiConfig = { layout: { showCharacterPanel: false, showQuickActions: true, showAutoPlay: true } };
    const state = buildDefaultState();
    state.storyPackages = [pkg];
    mockUseGameStore.mockReturnValue(state);
    render(<PlayApp />);
    expect(screen.queryByTestId("character-rail")).toBeNull();
  });

  it("opens and closes save modal", () => {
    render(<PlayApp />);
    fireEvent.click(screen.getByText("保存进度"));
    expect(screen.getByText("存档名称")).toBeTruthy();
    fireEvent.click(screen.getByText("取消"));
    expect(screen.queryByText("存档名称")).toBeNull();
  });

  it("opens load modal and shows saves list", () => {
    const state = buildDefaultState();
    state.saves = [
      { sessionId: "sv1", label: "存档一", round: 2, messageCount: 5, status: "active" },
      { sessionId: "sv2", label: "存档二", round: 4, messageCount: 10, status: "completed" },
    ];
    mockUseGameStore.mockReturnValue(state);
    render(<PlayApp />);
    fireEvent.click(screen.getByText("载入进度"));
    expect(screen.getByText("存档一")).toBeTruthy();
    expect(screen.getByText("存档二")).toBeTruthy();
  });

  it("opens and closes rules overlay", () => {
    render(<PlayApp />);
    fireEvent.click(screen.getByLabelText("查看规则"));
    expect(screen.getByText("剧情规则")).toBeTruthy();
    expect(screen.getByText(/不可直接杀死丁春秋/)).toBeTruthy();
    expect(screen.getByText("当前状态")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("关闭"));
    expect(screen.queryByText("剧情规则")).toBeNull();
  });

  it("toggles more menu dropdown", () => {
    render(<PlayApp />);
    const moreBtn = screen.getByLabelText("更多");
    fireEvent.click(moreBtn);
    expect(screen.getByText("故事管理")).toBeTruthy();
    expect(screen.getByText("查看规则")).toBeTruthy();
    fireEvent.click(moreBtn);
    expect(screen.queryByText("故事管理")).toBeNull();
  });

  it("displays error banner when store has error", () => {
    const state = buildDefaultState();
    state.error = "网络连接失败";
    mockUseGameStore.mockReturnValue(state);
    render(<PlayApp />);
    const errorEl = screen.getByText("网络连接失败");
    expect(errorEl).toBeTruthy();
    expect(errorEl.className).toContain("error-banner");
  });
});
