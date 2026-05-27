import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { StoryPackage } from "@story-game/shared";

const mockSaveStoryPackage = vi.fn();
const mockUploadPerformanceAudio = vi.fn();
const mockUploadPerformanceImage = vi.fn();

const mockPackage: StoryPackage = {
  id: "pkg_001",
  title: "测试故事",
  description: "desc",
  hidden: false,
  thumbnail: "",
  storySettingPrompt: "",
  scenario: {
    id: "scenario_1", title: "测试故事", premise: "", currentStage: "start",
    stages: ["start"], stageDetails: [], currentGoal: "", rules: [], initialStates: [],
  },
  characters: [
    { id: "qiaofeng", name: "乔峰", role: "主导者", avatar: "乔", personaPrompt: "", rules: [], skillIds: [], knowledgeBaseIds: [] },
  ],
  skills: [], knowledgeDocuments: [], promptRules: [],
  debugConfig: { showPromptLayers: false, showRawOutput: false, showValidation: false },
  createdAt: "2026-05-27T00:00:00.000Z", updatedAt: "2026-05-27T00:00:00.000Z",
};

vi.mock("../../../../store/gameStore.js", () => ({
  useGameStore: (selector?: (state: unknown) => unknown) => {
    const state = {
      editingPackageId: "pkg_001",
      storyPackages: [mockPackage],
      saveStoryPackage: mockSaveStoryPackage,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock("../../../../lib/adminApi.js", () => ({
  uploadPerformanceAudio: (...args: unknown[]) => mockUploadPerformanceAudio(...args),
  uploadPerformanceImage: (...args: unknown[]) => mockUploadPerformanceImage(...args),
}));

import { PerformanceConfigPanel } from "../PerformanceConfigPanel.js";

describe("PerformanceConfigPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadPerformanceAudio.mockResolvedValue({ path: "assets/performances/qf_audio/audio/hit.mp3" });
    mockUploadPerformanceImage.mockResolvedValue({ path: "assets/performances/qf_image/images/card.png" });
  });

  it("saves an audio performance", async () => {
    render(<PerformanceConfigPanel />);

    // Fill form
    fireEvent.change(screen.getByPlaceholderText("飞龙在天"), { target: { value: "飞龙在天" } });
    fireEvent.change(screen.getByPlaceholderText("qiaofeng_feilong_audio"), { target: { value: "qf_audio" } });
    fireEvent.change(screen.getByPlaceholderText("降龙十八掌·飞龙在天"), { target: { value: "降龙十八掌·飞龙在天" } });
    fireEvent.change(screen.getByPlaceholderText("飞龙在天、降龙十八掌"), { target: { value: "飞龙在天、降龙十八掌" } });
    fireEvent.change(screen.getByPlaceholderText("assets/performances/xxx/audio/file.mp3"), {
      target: { value: "assets/performances/qf_audio/audio/hit.mp3" },
    });
    fireEvent.click(screen.getByText("保存演出"));

    await waitFor(() => expect(mockSaveStoryPackage).toHaveBeenCalledOnce());
    const saved = mockSaveStoryPackage.mock.calls[0][0] as StoryPackage;
    expect(saved.pluginManifest?.performances.qf_audio).toMatchObject({
      name: "飞龙在天",
      renderer: "audio",
      trigger: {
        type: "knowledgeUse",
        characterId: "qiaofeng",
        knowledgeTitle: "降龙十八掌·飞龙在天",
        keywords: ["飞龙在天", "降龙十八掌"],
        matchBoldOnly: true,
      },
      audio: { main: "assets/performances/qf_audio/audio/hit.mp3" },
    });
  });

  it("saves an image performance when image type selected", async () => {
    render(<PerformanceConfigPanel />);

    // Switch to image type via radio button
    fireEvent.click(screen.getByText("图片"));

    fireEvent.change(screen.getByPlaceholderText("飞龙在天"), { target: { value: "飞龙在天图" } });
    fireEvent.change(screen.getByPlaceholderText("qiaofeng_feilong_audio"), { target: { value: "qf_image" } });
    fireEvent.change(screen.getByPlaceholderText("降龙十八掌·飞龙在天"), { target: { value: "降龙十八掌" } });
    fireEvent.change(screen.getByPlaceholderText("飞龙在天、降龙十八掌"), { target: { value: "飞龙在天" } });
    fireEvent.change(screen.getByPlaceholderText("assets/performances/xxx/images/file.png"), {
      target: { value: "assets/performances/qf_image/images/card.png" },
    });
    fireEvent.click(screen.getByText("保存演出"));

    await waitFor(() => expect(mockSaveStoryPackage).toHaveBeenCalledOnce());
    const saved = mockSaveStoryPackage.mock.calls[0][0] as StoryPackage;
    expect(saved.pluginManifest?.performances.qf_image).toMatchObject({
      name: "飞龙在天图",
      renderer: "image",
      layers: { bg: "assets/performances/qf_image/images/card.png" },
    });
  });

  it("uploads audio file and fills asset path", async () => {
    render(<PerformanceConfigPanel />);
    fireEvent.change(screen.getByPlaceholderText("qiaofeng_feilong_audio"), { target: { value: "qf_audio" } });

    const file = new File(["fake"], "hit.mp3", { type: "audio/mpeg" });
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(mockUploadPerformanceAudio).toHaveBeenCalledWith("pkg_001", "qf_audio", file));
    expect(screen.getByDisplayValue("assets/performances/qf_audio/audio/hit.mp3")).toBeTruthy();
  });

  it("uploads image file after switching type", async () => {
    render(<PerformanceConfigPanel />);
    fireEvent.click(screen.getByText("图片"));
    fireEvent.change(screen.getByPlaceholderText("qiaofeng_feilong_audio"), { target: { value: "qf_image" } });

    const file = new File(["fake"], "card.png", { type: "image/png" });
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(mockUploadPerformanceImage).toHaveBeenCalledWith("pkg_001", "qf_image", file));
    expect(screen.getByDisplayValue("assets/performances/qf_image/images/card.png")).toBeTruthy();
  });
});
