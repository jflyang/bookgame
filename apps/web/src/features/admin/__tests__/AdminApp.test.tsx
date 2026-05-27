import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { StoryPackage } from "@story-game/shared";

const basePackage: StoryPackage = {
  id: "test-pkg", title: "Test", description: "", hidden: false, storySettingPrompt: "",
  scenario: { id: "s1", title: "T", premise: "", currentStage: "s", stages: ["s"], stageDetails: [], currentGoal: "", rules: [], initialStates: [] },
  characters: [], skills: [], knowledgeDocuments: [], promptRules: [],
  debugConfig: { showPromptLayers: false, showRawOutput: false, showValidation: false },
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
};

vi.mock("../../../store/gameStore.js", () => ({
  useGameStore: Object.assign(
    (sel?: (s: Record<string, unknown>) => unknown) => {
      const state: Record<string, unknown> = {
        storyPackages: [basePackage], editingPackageId: "test-pkg",
        loadStoryPackages: vi.fn(), loadLlmConfig: vi.fn(),
        saveStoryPackage: vi.fn(), editStoryPackage: vi.fn(),
        error: null, llmConfig: null,
      };
      return sel ? sel(state) : state;
    },
    { getState: () => ({ editingPackageId: "test-pkg", storyPackages: [basePackage], editStoryPackage: vi.fn() }), setState: vi.fn() }
  ),
}));

vi.mock("../../../lib/adminApi.js", () => ({ deleteThumbnail: vi.fn(), downloadStoryPackage: vi.fn(), uploadThumbnail: vi.fn() }));
vi.mock("../../../lib/gameApi.js", () => ({ createSession: vi.fn(), sendMessage: vi.fn(), sendMessageStream: vi.fn() }));

import { AdminApp } from "../AdminApp.js";

describe("AdminApp", () => {
  beforeEach(() => { vi.clearAllMocks(); window.history.pushState({}, "", "/admin"); });

  it("renders sidebar nav and main shell", () => {
    render(<AdminApp />);
    expect(screen.getByLabelText("管理导航")).toBeTruthy();
    expect(document.querySelector(".admin-shell")).toBeTruthy();
  });

  it("renders StoryLibrary for /admin", () => {
    render(<AdminApp />);
    expect(screen.getByText("新建故事")).toBeTruthy();
  });

  it("renders StoryEditor for /admin/story-packages/:id", () => {
    window.history.pushState({}, "", "/admin/story-packages/test-pkg");
    render(<AdminApp />);
    expect(screen.getByText("TASK PACKAGE WORKFLOW")).toBeTruthy();
  });

  it("renders LlmConfigPanel for /admin/model-config", () => {
    window.history.pushState({}, "", "/admin/model-config");
    render(<AdminApp />);
    expect(screen.getByText("大模型配置")).toBeTruthy();
  });
});
