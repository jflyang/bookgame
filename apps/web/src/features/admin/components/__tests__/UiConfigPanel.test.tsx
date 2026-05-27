import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { StoryPackage, UiConfig } from "@story-game/shared";

const mockSave = vi.fn();
let mockPkgId: string | null = "pkg1";
const uiCfg: UiConfig = {
  layout: { showCharacterPanel: true, showQuickActions: true, showDiceButton: true, showAutoPlay: true },
  theme: { primaryColor: "#1f5b51", accentColor: "#2b987a", backgroundColor: "#f7f1e7", surfaceColor: "#fffaf2", textColor: "#2f3133", headingFont: "STKaiti", bodyFont: "Inter", navBackground: "#0a1728" },
  scene: { heading: "", introNarration: "", emptyTitle: "", emptyHint: "" },
  labels: { hp: "HP", mp: "MP", characters: "Chars", lastSpeaker: "Last", continue: "Go", autoPlay: "Auto", send: "Send", manageCharacters: "Mgmt", rules: "Rules", scenarioRules: "SR", promptRules: "PR", currentStatus: "Status", round: "Round", currentStage: "Stage", statusActive: "Active", statusCompleted: "Done", interactiveStory: "Interactive", storyManagement: "Mgmt", viewRules: "View" },
  avatar: { style: "gradient" },
};
const pkg: StoryPackage = {
  id: "pkg1", title: "T", description: "D", hidden: false, storySettingPrompt: "",
  scenario: { id: "s1", title: "T", premise: "", currentStage: "s", stages: ["s"], stageDetails: [], currentGoal: "", rules: [], initialStates: [] },
  characters: [], skills: [], knowledgeDocuments: [], promptRules: [],
  debugConfig: { showPromptLayers: false, showRawOutput: false, showValidation: false },
  uiConfig: uiCfg, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
};

vi.mock("../../../../store/gameStore.js", () => ({
  useGameStore: (sel?: (s: any) => any) => {
    const state = { storyPackages: [pkg], editingPackageId: mockPkgId, saveStoryPackage: mockSave };
    return sel ? sel(state) : state;
  },
}));

import { UiConfigPanel } from "../UiConfigPanel.js";

describe("UiConfigPanel", () => {
  beforeEach(() => { vi.clearAllMocks(); mockPkgId = "pkg1"; });

  it("renders theme presets", () => {
    render(<UiConfigPanel />);
    expect(screen.getAllByText("武侠纸页").length).toBeGreaterThan(0);
    expect(screen.getAllByText("清爽浅色").length).toBeGreaterThan(0);
    expect(screen.getAllByText("暗色江湖").length).toBeGreaterThan(0);
  });

  it("renders layout toggles", () => {
    render(<UiConfigPanel />);
    expect(screen.getAllByText("角色面板").length).toBeGreaterThan(0);
    expect(screen.getAllByText("快捷操作").length).toBeGreaterThan(0);
    expect(screen.getAllByText("自动继续").length).toBeGreaterThan(0);
  });

  it("applies theme preset", () => {
    render(<UiConfigPanel />);
    fireEvent.click(screen.getByText("暗色江湖"));
    fireEvent.click(screen.getByText("保存界面配置"));
    expect((mockSave.mock.calls[0][0] as StoryPackage).uiConfig?.theme?.primaryColor).toBe("#0f766e");
  });

  it("toggles layout", () => {
    render(<UiConfigPanel />);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByText("保存界面配置"));
    expect((mockSave.mock.calls[0][0] as StoryPackage).uiConfig?.layout?.showCharacterPanel).toBe(false);
  });

  it("saves on button click", () => {
    render(<UiConfigPanel />);
    fireEvent.click(screen.getByText("保存界面配置"));
    expect(mockSave).toHaveBeenCalled();
  });

  it("returns null when no editing package", () => {
    mockPkgId = null;
    const { container } = render(<UiConfigPanel />);
    expect(container.innerHTML).toBe("");
  });
});
