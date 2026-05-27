import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

// ---------------------------------------------------------------------------
// vi.hoisted variables – referenced by hoisted vi.mock factories
// ---------------------------------------------------------------------------
const {
  mockSaveStoryPackage,
  mockDeleteStoryPackage,
  mockShowLibrary,
  mockDownloadStoryPackage,
  mockUploadThumbnail,
  mockDeleteThumbnail,
} = vi.hoisted(() => ({
  mockSaveStoryPackage: vi.fn(),
  mockDeleteStoryPackage: vi.fn().mockResolvedValue(undefined),
  mockShowLibrary: vi.fn(),
  mockDownloadStoryPackage: vi.fn(),
  mockUploadThumbnail: vi.fn(),
  mockDeleteThumbnail: vi.fn(),
}));

function buildPackage(overrides: Record<string, unknown> = {}) {
  return {
    id: "pkg_1",
    title: "虚竹除害星宿老怪",
    description: "test description",
    hidden: false,
    thumbnail: "",
    storySettingPrompt: "test prompt",
    uiConfig: { layout: { showCharacterPanel: true, showQuickActions: true, showAutoPlay: true }, avatar: { style: "gradient" } },
    scenario: {
      id: "s1", title: "虚竹除害星宿老怪", premise: "test",
      currentStage: "origin", currentGoal: "打败丁春秋",
      stages: ["origin"], stageDetails: [], rules: ["不可直接杀死丁春秋"],
      initialStates: [],
    },
    characters: [{ id: "qiaofeng", name: "乔峰", role: "主导者", avatar: "乔", personaPrompt: "", rules: [], skillIds: [], knowledgeBaseIds: [] }],
    skills: [{ id: "s1", name: "降龙十八掌", description: "", type: "attack", power: 80, accuracy: 95, cost: 20, target: "single" }],
    knowledgeDocuments: [],
    promptRules: [],
    pluginManifest: {},
    debugConfig: { showPromptLayers: false, showRawOutput: false, showValidation: false },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// Populated in beforeEach; tests can mutate before calling render
let mockStoreState: Record<string, unknown>;

vi.mock("../../../../store/gameStore.js", () => ({
  useGameStore: (selector?: (s: unknown) => unknown) => {
    return selector ? selector(mockStoreState) : mockStoreState;
  },
}));

vi.mock("../../../../lib/adminApi.js", () => ({
  downloadStoryPackage: mockDownloadStoryPackage,
  uploadThumbnail: mockUploadThumbnail,
  deleteThumbnail: mockDeleteThumbnail,
}));

vi.mock("../CharacterConfigPanel.js", () => ({
  CharacterConfigPanel: () => <div data-testid="characters-panel" />,
}));
vi.mock("../PromptRulesPanel.js", () => ({
  PromptRulesPanel: () => <div data-testid="rules-panel" />,
}));
vi.mock("../PerformanceConfigPanel.js", () => ({
  PerformanceConfigPanel: () => <div data-testid="performances-panel" />,
}));
vi.mock("../StorySettingPanel.js", () => ({
  StorySettingPanel: () => <div data-testid="scenario-panel" />,
}));
vi.mock("../UiConfigPanel.js", () => ({
  UiConfigPanel: () => <div data-testid="ui-panel" />,
}));

import { StoryEditor } from "../StoryEditor.js";

function initState(overrides: Record<string, unknown> = {}) {
  mockStoreState = {
    editingPackageId: "pkg_1",
    storyPackages: [buildPackage()],
    saveStoryPackage: mockSaveStoryPackage,
    deleteStoryPackage: mockDeleteStoryPackage,
    showLibrary: mockShowLibrary,
    error: null,
    characters: [buildPackage().characters[0]],
    knowledgeDocuments: [],
    ...overrides,
  };
}

describe("StoryEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    // Mock window.location for URL tab tests
    Object.defineProperty(window, "location", {
      value: { ...window.location, search: "", href: "http://localhost/", pathname: "/editor", hash: "" },
      writable: true,
    });
    initState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1 ─────────────────────────────────────────────────────────────
  it("renders the story package title in the header", () => {
    render(<StoryEditor />);
    expect(screen.getByText("虚竹除害星宿老怪")).toBeTruthy();
  });

  // ── 2 ─────────────────────────────────────────────────────────────
  it("renders all workflow sidebar nodes", () => {
    render(<StoryEditor />);
    // Labels appear in sidebar, panel header, and inspector – use getAllByText
    expect(screen.getAllByText("封面与说明").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("剧情设定")).toBeTruthy();
    expect(screen.getByText("角色配置")).toBeTruthy();
    expect(screen.getByText("演出配置")).toBeTruthy();
    expect(screen.getByText("提示词规则")).toBeTruthy();
    expect(screen.getByText("UI 配置")).toBeTruthy();
  });

  // ── 3 ─────────────────────────────────────────────────────────────
  it("switches panel when a workflow node is clicked", () => {
    render(<StoryEditor />);
    // Default panel is "basic" – click on "characters"
    fireEvent.click(screen.getByText("角色配置"));
    expect(screen.getByTestId("characters-panel")).toBeTruthy();

    fireEvent.click(screen.getByText("剧情设定"));
    expect(screen.getByTestId("scenario-panel")).toBeTruthy();

    fireEvent.click(screen.getByText("UI 配置"));
    expect(screen.getByTestId("ui-panel")).toBeTruthy();
  });

  // ── 4 ─────────────────────────────────────────────────────────────
  it("shows correct panel for each workflow node", () => {
    const tree = () => screen.getByLabelText("任务包流程树");
    const nodePanelMap: [string, string][] = [
      ["封面与说明", "basic"],
      ["剧情设定", "scenario-panel"],
      ["角色配置", "characters-panel"],
      ["演出配置", "performances-panel"],
      ["提示词规则", "rules-panel"],
      ["UI 配置", "ui-panel"],
    ];
    render(<StoryEditor />);
    for (const [nodeLabel, panelId] of nodePanelMap) {
      fireEvent.click(within(tree()).getByText(nodeLabel));
      if (panelId === "basic") {
        expect(screen.getByDisplayValue("虚竹除害星宿老怪")).toBeTruthy();
      } else {
        expect(screen.getByTestId(panelId)).toBeTruthy();
      }
    }
  });

  // ── 5 ─────────────────────────────────────────────────────────────
  it("renders the basic panel with title and description fields", () => {
    render(<StoryEditor />);
    // Default active node is "basic"
    const titleInput = screen.getByDisplayValue("虚竹除害星宿老怪");
    expect(titleInput).toBeTruthy();
    const descInput = screen.getByDisplayValue("test description");
    expect(descInput).toBeTruthy();
  });

  // ── 6 ─────────────────────────────────────────────────────────────
  it("calls saveStoryPackage when save button is clicked", () => {
    render(<StoryEditor />);
    const saveBtn = screen.getByText("保存");
    fireEvent.click(saveBtn);
    expect(mockSaveStoryPackage).toHaveBeenCalledTimes(1);
    expect(mockSaveStoryPackage).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pkg_1", title: "虚竹除害星宿老怪" })
    );
  });

  // ── 7 ─────────────────────────────────────────────────────────────
  it("shows empty state when no storyPackage is selected", () => {
    initState({ editingPackageId: null, storyPackages: [] });
    render(<StoryEditor />);
    expect(screen.getByText("没有选中的故事包。")).toBeTruthy();
  });

  // ── 8 ─────────────────────────────────────────────────────────────
  it("calls downloadStoryPackage when export is clicked", () => {
    render(<StoryEditor />);
    const exportBtn = screen.getByText("导出");
    fireEvent.click(exportBtn);
    expect(mockDownloadStoryPackage).toHaveBeenCalledWith("pkg_1");
  });

  // ── 9 ─────────────────────────────────────────────────────────────
  it("shows confirm dialog on delete and calls deleteStoryPackage then showLibrary", async () => {
    render(<StoryEditor />);
    const deleteBtn = screen.getByText("删除");
    fireEvent.click(deleteBtn);
    expect(window.confirm).toHaveBeenCalled();
    expect(mockDeleteStoryPackage).toHaveBeenCalledWith("pkg_1");
    await waitFor(() => expect(mockShowLibrary).toHaveBeenCalledTimes(1));
  });

  // ── 10 ────────────────────────────────────────────────────────────
  it("does not call deleteStoryPackage if confirm is cancelled", () => {
    window.confirm = vi.fn(() => false);
    render(<StoryEditor />);
    const deleteBtn = screen.getByText("删除");
    fireEvent.click(deleteBtn);
    expect(mockDeleteStoryPackage).not.toHaveBeenCalled();
  });

  // ── 11 ────────────────────────────────────────────────────────────
  it("shows completion status dots in the summary bar", () => {
    render(<StoryEditor />);
    const summary = screen.getByLabelText("任务包完成度");
    expect(within(summary).getByText("入口")).toBeTruthy();
    expect(within(summary).getByText("世界")).toBeTruthy();
    expect(within(summary).getByText("角色")).toBeTruthy();
    expect(within(summary).getByText("界面")).toBeTruthy();
  });

  // ── 12 ────────────────────────────────────────────────────────────
  it("does not crash when promptRules is empty", () => {
    render(<StoryEditor />);
    fireEvent.click(screen.getByText("提示词规则"));
    expect(screen.getByTestId("rules-panel")).toBeTruthy();
  });
});
