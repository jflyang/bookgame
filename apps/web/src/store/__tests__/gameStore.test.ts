import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the API modules before importing the store
vi.mock("../../lib/adminApi.js", () => ({
  listStoryPackages: vi.fn(),
  createStoryPackage: vi.fn(),
  updateStoryPackage: vi.fn(),
  deleteStoryPackage: vi.fn(),
  downloadStoryPackage: vi.fn(),
  uploadThumbnail: vi.fn(),
  deleteThumbnail: vi.fn(),
  importStoryPackageZip: vi.fn(),
  getLlmConfig: vi.fn(),
  updateLlmConfig: vi.fn(),
}));

vi.mock("../../lib/gameApi.js", () => ({
  createSession: vi.fn(),
  sendMessage: vi.fn(),
  sendMessageStream: vi.fn(),
}));

import { useGameStore } from "../gameStore.js";
import * as adminApi from "../../lib/adminApi.js";

const mockPackage = {
  id: "pkg1",
  title: "Test Story",
  description: "",
  storySettingPrompt: "",
  scenario: {
    id: "sc1", title: "Test", premise: "", currentStage: "start",
    stages: ["start"], stageDetails: [], currentGoal: "", rules: [], initialStates: [],
  },
  characters: [],
  skills: [],
  knowledgeDocuments: [],
  promptRules: [],
  debugConfig: { showPromptLayers: false, showRawOutput: false, showValidation: false },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("gameStore — deleteStoryPackage", () => {
  beforeEach(() => {
    useGameStore.setState({
      storyPackages: [
        { ...mockPackage, id: "pkg1", title: "Story A" },
        { ...mockPackage, id: "pkg2", title: "Story B" },
      ],
      editingPackageId: null,
      error: null,
      view: "library",
    });
    vi.clearAllMocks();
  });

  it("removes the package from the list on success", async () => {
    vi.mocked(adminApi.deleteStoryPackage).mockResolvedValue({
      storyPackages: [{ ...mockPackage, id: "pkg2", title: "Story B" }],
    } as never);

    await useGameStore.getState().deleteStoryPackage("pkg1");

    const state = useGameStore.getState();
    expect(state.storyPackages).toHaveLength(1);
    expect(state.storyPackages[0].id).toBe("pkg2");
    expect(state.view).toBe("library");
    expect(state.editingPackageId).toBeNull();
  });

  it("clears error on delete success", async () => {
    useGameStore.setState({ error: "previous error" });
    vi.mocked(adminApi.deleteStoryPackage).mockResolvedValue({
      storyPackages: [{ ...mockPackage, id: "pkg2", title: "Story B" }],
    } as never);

    await useGameStore.getState().deleteStoryPackage("pkg1");

    expect(useGameStore.getState().error).toBeNull();
  });

  it("propagates error when API fails", async () => {
    vi.mocked(adminApi.deleteStoryPackage).mockRejectedValue(new Error("API down"));

    await expect(
      useGameStore.getState().deleteStoryPackage("pkg1")
    ).rejects.toThrow("API down");
    // storyPackages should remain unchanged
    expect(useGameStore.getState().storyPackages).toHaveLength(2);
  });
});

describe("gameStore — createStoryPackage", () => {
  beforeEach(() => {
    useGameStore.setState({
      storyPackages: [{ ...mockPackage, id: "pkg1", title: "Story A" }],
      editingPackageId: null,
      error: null,
      view: "library",
    });
    vi.clearAllMocks();
  });

  it("adds the new package and stays on library view", async () => {
    vi.mocked(adminApi.createStoryPackage).mockResolvedValue({
      storyPackage: { ...mockPackage, id: "new-pkg", title: "New Story" },
      storyPackages: [
        { ...mockPackage, id: "new-pkg", title: "New Story" },
        { ...mockPackage, id: "pkg1", title: "Story A" },
      ],
    } as never);

    await useGameStore.getState().createStoryPackage("New Story");

    const state = useGameStore.getState();
    expect(state.storyPackages).toHaveLength(2);
    expect(state.view).toBe("library"); // stays on library, not editor
    expect(state.editingPackageId).toBeNull(); // does not jump to editor
  });
});
