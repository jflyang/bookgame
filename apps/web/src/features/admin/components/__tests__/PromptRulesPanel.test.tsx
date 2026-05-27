import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { StoryPackage } from "@story-game/shared";

const mockSaveStoryPackage = vi.fn();
let mockEditingPackageId: string | null = "pkg1";

const basePackage: StoryPackage = {
  id: "pkg1", title: "Test", description: "D", hidden: false,
  storySettingPrompt: "",
  scenario: { id: "s1", title: "T", premise: "", currentStage: "s", stages: ["s"], stageDetails: [], currentGoal: "", rules: [], initialStates: [] },
  characters: [], skills: [], knowledgeDocuments: [],
  promptRules: [
    { id: "r1", title: "Rule1", category: "custom", enabled: true, content: "Content1" },
    { id: "r2", title: "Rule2", category: "knowledge_forcing", enabled: false, content: "Content2" },
  ],
  debugConfig: { showPromptLayers: false, showRawOutput: false, showValidation: false },
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
};

vi.mock("../../../../store/gameStore.js", () => ({
  useGameStore: (sel?: (s: any) => any) => {
    const state = { storyPackages: [basePackage], editingPackageId: mockEditingPackageId, saveStoryPackage: mockSaveStoryPackage };
    return sel ? sel(state) : state;
  },
}));

import { PromptRulesPanel } from "../PromptRulesPanel.js";

describe("PromptRulesPanel", () => {
  beforeEach(() => { vi.clearAllMocks(); mockEditingPackageId = "pkg1"; });

  it("renders rule list with enabled count", () => {
    render(<PromptRulesPanel />);
    expect(screen.getByText("故事包规则")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("renders rule titles", () => {
    render(<PromptRulesPanel />);
    expect(screen.getByText("Rule1")).toBeTruthy();
    expect(screen.getByText("Rule2")).toBeTruthy();
  });

  it("toggles rule enabled state", () => {
    render(<PromptRulesPanel />);
    const cbs = screen.getAllByRole("checkbox");
    fireEvent.click(cbs[0]);
    const pkg = mockSaveStoryPackage.mock.calls[0][0] as StoryPackage;
    expect(pkg.promptRules.find((r) => r.id === "r1")?.enabled).toBe(false);
  });

  it("adds new rule", () => {
    render(<PromptRulesPanel />);
    fireEvent.click(screen.getByText("新增规则"));
    const pkg = mockSaveStoryPackage.mock.calls[0][0] as StoryPackage;
    expect(pkg.promptRules).toHaveLength(3);
    expect(pkg.promptRules[2].category).toBe("custom");
  });

  it("edits rule title", () => {
    render(<PromptRulesPanel />);
    const input = screen.getByDisplayValue("Rule1");
    fireEvent.change(input, { target: { value: "NewTitle" } });
    const pkg = mockSaveStoryPackage.mock.calls[0][0] as StoryPackage;
    expect(pkg.promptRules.find((r) => r.id === "r1")?.title).toBe("NewTitle");
  });

  it("edits rule content", () => {
    render(<PromptRulesPanel />);
    const ta = screen.getByDisplayValue("Content1");
    fireEvent.change(ta, { target: { value: "NewContent" } });
    const pkg = mockSaveStoryPackage.mock.calls[0][0] as StoryPackage;
    expect(pkg.promptRules.find((r) => r.id === "r1")?.content).toBe("NewContent");
  });

  it("deletes rule", () => {
    render(<PromptRulesPanel />);
    fireEvent.click(screen.getAllByText("删除")[0]);
    const pkg = mockSaveStoryPackage.mock.calls[0][0] as StoryPackage;
    expect(pkg.promptRules).toHaveLength(1);
  });

  it("returns null when no editing package", () => {
    mockEditingPackageId = null;
    const { container } = render(<PromptRulesPanel />);
    expect(container.innerHTML).toBe("");
  });
});
