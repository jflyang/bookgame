import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockDeleteStoryPackage = vi.fn();
const mockCreateStoryPackage = vi.fn();
const mockEditStoryPackage = vi.fn();
const mockStart = vi.fn();
const mockShowImport = vi.fn();
const mockLoadStoryPackages = vi.fn();
const mockSaveStoryPackage = vi.fn();

vi.mock("../../../../store/gameStore.js", () => ({
  useGameStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      storyPackages: [
        { id: "pkg1", title: "Story A", description: "desc", hidden: false, thumbnail: "", scenario: { currentStage: "start" }, characters: [{ id: "c1" }], skills: [{ id: "s1" }], knowledgeDocuments: [], updatedAt: "2026-05-27T08:00:00Z" },
        { id: "pkg2", title: "Story B", description: "desc", hidden: false, thumbnail: "", scenario: { currentStage: "mid" }, characters: [{ id: "c1" }, { id: "c2" }], skills: [], knowledgeDocuments: [], updatedAt: "2026-05-27T08:00:00Z" },
      ],
      createStoryPackage: mockCreateStoryPackage,
      deleteStoryPackage: mockDeleteStoryPackage,
      editStoryPackage: mockEditStoryPackage,
      start: mockStart,
      showImport: mockShowImport,
      loadStoryPackages: mockLoadStoryPackages,
      saveStoryPackage: mockSaveStoryPackage,
      error: null,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock("../../../../lib/adminApi.js", () => ({
  downloadStoryPackage: vi.fn(),
}));

import { StoryLibrary } from "../StoryLibrary.js";

describe("StoryLibrary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
  });

  it("renders all story packages as cards", () => {
    render(<StoryLibrary />);
    expect(screen.getByText("Story A")).toBeTruthy();
    expect(screen.getByText("Story B")).toBeTruthy();
  });

  it("shows character and skill counts per card", () => {
    render(<StoryLibrary />);
    // Story A has 1 char, 1 skill; Story B has 2 chars, 0 skills
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(2);
  });

  it("calls editStoryPackage when edit button is clicked", () => {
    render(<StoryLibrary />);
    const editButtons = screen.getAllByText("编辑");
    fireEvent.click(editButtons[0]);
    expect(mockEditStoryPackage).toHaveBeenCalledWith("pkg1");
  });

  it("shows confirm dialog on delete and calls deleteStoryPackage", () => {
    render(<StoryLibrary />);
    const deleteButtons = screen.getAllByText("删除");
    fireEvent.click(deleteButtons[0]);
    expect(window.confirm).toHaveBeenCalled();
    expect(mockDeleteStoryPackage).toHaveBeenCalledWith("pkg1");
  });

  it("does not call deleteStoryPackage if confirm is cancelled", () => {
    window.confirm = vi.fn(() => false);
    render(<StoryLibrary />);
    const deleteButtons = screen.getAllByText("删除");
    fireEvent.click(deleteButtons[0]);
    expect(mockDeleteStoryPackage).not.toHaveBeenCalled();
  });

  it("calls createStoryPackage when create button clicked", () => {
    render(<StoryLibrary />);
    const createBtn = screen.getByText("新建故事");
    fireEvent.click(createBtn);
    expect(mockCreateStoryPackage).toHaveBeenCalled();
  });

  it("offers the AI story package draft template as a download", () => {
    render(<StoryLibrary />);
    const link = screen.getByText("下载 AI 模板").closest("a");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toBe("/ai-story-package-draft-template.txt");
    expect(link?.getAttribute("download")).toBe("ai-story-package-draft-template.txt");
  });

  it("has enter-play buttons that call start", () => {
    render(<StoryLibrary />);
    const playBtns = screen.getAllByText("进入展示界面");
    expect(playBtns.length).toBeGreaterThanOrEqual(2);
    // Click the card-level button (not the header one)
    fireEvent.click(playBtns[1]);
    expect(mockStart).toHaveBeenCalledWith("pkg1");
  });
});
