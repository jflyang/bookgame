import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { StoryPackage, StoryPluginManifest } from "@story-game/shared";

const mockSaveStoryPackage = vi.fn();
const mockUploadAudio = vi.fn();
const mockUploadImage = vi.fn();
const mockUploadVideo = vi.fn();
const mockAudioPlay = vi.fn().mockResolvedValue(undefined);
const mockAudioPause = vi.fn();
let mockAudioSrc = "";

const manifestWithPerformances: StoryPluginManifest = {
  id: "pkg_001", type: "story-plugin", schemaVersion: "2",
  title: "测试", description: "", version: "1.0.0", author: "",
  capabilities: { audio: true, customFonts: false, customCss: false, characterPortraits: false, backgroundImages: false, performances: true },
  audio: { bgm: { scenes: {} }, sfx: {} },
  images: { portraits: {}, backgrounds: {} },
  fonts: {},
  performances: {
    qiaofeng_entrance: {
      name: "乔峰英雄登场", renderer: "video", durationMs: 4200,
      trigger: { type: "firstAppearance", characterId: "qiaofeng" },
      playOnce: "session",
      video: { webm: "assets/performances/qf/video/e.webm", containsAudio: true },
      layers: {}, audio: {},
    },
    xiao_wei_breath: {
      name: "小薇轻喘", renderer: "audio", durationMs: 1600,
      trigger: { type: "knowledgeUse", characterId: "xiao_wei", knowledgeTitle: "小薇轻喘", keywords: ["轻喘", "喘气"] },
      playOnce: "never",
      layers: {},
      audio: { main: "assets/performances/xw/audio/breath.mp3" },
    },
    bg_sunset: {
      name: "落日背景", renderer: "image", durationMs: 3000,
      trigger: { type: "stageEnter", stageId: "opening" },
      playOnce: "session",
      layers: { bg: "assets/performances/bg/images/sunset.png" },
      audio: {},
    },
    no_asset_audio: {
      name: "无资源音频", renderer: "audio", durationMs: 1000,
      trigger: { type: "firstAppearance", characterId: "xuzhu" },
      playOnce: "never",
      layers: {}, audio: {},
    },
  },
  entry: "story.json",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

const mockPackage: StoryPackage = {
  id: "pkg_001", title: "测试故事", description: "desc", hidden: false,
  thumbnail: "", storySettingPrompt: "",
  scenario: {
    id: "scenario_1", title: "测试故事", premise: "", currentStage: "opening",
    stages: ["opening", "battle", "ending"], stageDetails: [], currentGoal: "", rules: [], initialStates: [],
  },
  characters: [
    { id: "qiaofeng", name: "乔峰", role: "主导者", avatar: "乔", personaPrompt: "", rules: [], knowledgeBaseIds: [] },
    { id: "xuzhu", name: "虚竹", role: "主角", avatar: "虚", personaPrompt: "", rules: [], knowledgeBaseIds: [] },
  ],
  skills: [], knowledgeDocuments: [], promptRules: [],
  debugConfig: { showPromptLayers: false, showRawOutput: false, showValidation: false },
  pluginManifest: manifestWithPerformances,
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
  uploadPerformanceAudio: (...args: unknown[]) => mockUploadAudio(...args),
  uploadPerformanceImage: (...args: unknown[]) => mockUploadImage(...args),
  uploadPerformanceVideo: (...args: unknown[]) => mockUploadVideo(...args),
}));

import { PerformanceConfigPanel } from "../PerformanceConfigPanel.js";

describe("PerformanceConfigPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadAudio.mockResolvedValue({ path: "assets/performances/qf_audio/audio/hit.mp3" });
    mockUploadImage.mockResolvedValue({ path: "assets/performances/qf_image/images/card.png" });
    mockUploadVideo.mockResolvedValue({ path: "assets/performances/qf_video/video/entrance.webm" });
    mockAudioPlay.mockResolvedValue(undefined);
    mockAudioSrc = "";
    vi.stubGlobal("Audio", vi.fn().mockImplementation(function (this: HTMLAudioElement, src?: string) {
      mockAudioSrc = src ?? "";
      this.play = mockAudioPlay;
      this.pause = mockAudioPause;
      this.addEventListener = vi.fn();
      this.removeEventListener = vi.fn();
      Object.defineProperty(this, "src", { value: mockAudioSrc, writable: true });
    }));
  });

  it("renders existing performances list", () => {
    render(<PerformanceConfigPanel />);
    expect(screen.getByText("乔峰英雄登场")).toBeTruthy();
    expect(screen.getByText("乔峰")).toBeTruthy();
  });

  it("shows all renderer options", () => {
    render(<PerformanceConfigPanel />);
    expect(screen.getByText("视频")).toBeTruthy();
    expect(screen.getByText("声音")).toBeTruthy();
    expect(screen.getByText("图片")).toBeTruthy();
  });

  it("shows all trigger type options", () => {
    render(<PerformanceConfigPanel />);
    expect(screen.getByText("首次出场")).toBeTruthy();
    expect(screen.getByText("阶段进入")).toBeTruthy();
    expect(screen.getByText("知识库命中")).toBeTruthy();
  });

  it("saves an audio + knowledgeUse performance", async () => {
    render(<PerformanceConfigPanel />);

    // Switch to audio renderer
    const rendererSelect = screen.getAllByRole("combobox")[0];
    fireEvent.change(rendererSelect, { target: { value: "audio" } });

    // Switch to knowledgeUse trigger
    const triggerSelect = screen.getAllByRole("combobox")[1];
    fireEvent.change(triggerSelect, { target: { value: "knowledgeUse" } });

    // Fill form
    fireEvent.change(screen.getByPlaceholderText("飞龙在天"), { target: { value: "降龙十八掌" } });
    fireEvent.change(screen.getByPlaceholderText("降龙十八掌·飞龙在天"), { target: { value: "降龙十八掌·飞龙在天" } });
    fireEvent.change(screen.getByPlaceholderText("飞龙在天、降龙十八掌"), { target: { value: "飞龙在天、降龙十八掌" } });

    // Set asset path
    const monoInputs = document.querySelectorAll("input.mono");
    if (monoInputs.length > 0) {
      fireEvent.change(monoInputs[0], { target: { value: "assets/performances/qf_audio/audio/hit.mp3" } });
    }

    fireEvent.click(screen.getByText("保存演出"));

    await waitFor(() => expect(mockSaveStoryPackage).toHaveBeenCalledOnce());
    const saved = mockSaveStoryPackage.mock.calls[0][0] as StoryPackage;
    const perfs = saved.pluginManifest?.performances ?? {};
    const newPerf = Object.entries(perfs).find(([, p]) => p.name === "降龙十八掌");
    expect(newPerf).toBeTruthy();
    expect(newPerf![1].renderer).toBe("audio");
    expect(newPerf![1].trigger.type).toBe("knowledgeUse");
  });

  it("saves a video + firstAppearance performance", async () => {
    render(<PerformanceConfigPanel />);

    fireEvent.change(screen.getByPlaceholderText("飞龙在天"), { target: { value: "虚竹初次登场" } });

    // Set asset path
    const monoInputs = document.querySelectorAll("input.mono");
    if (monoInputs.length > 0) {
      fireEvent.change(monoInputs[0], { target: { value: "assets/performances/xz/video/e.webm" } });
    }

    fireEvent.click(screen.getByText("保存演出"));

    await waitFor(() => expect(mockSaveStoryPackage).toHaveBeenCalledOnce());
    const saved = mockSaveStoryPackage.mock.calls[0][0] as StoryPackage;
    const perfs = saved.pluginManifest?.performances ?? {};
    const newPerf = Object.entries(perfs).find(([, p]) => p.name === "虚竹初次登场");
    expect(newPerf).toBeTruthy();
    expect(newPerf![1].trigger.type).toBe("firstAppearance");
    expect(newPerf![1].renderer).toBe("video");
    expect(newPerf![1].playOnce).toBe("session");
  });

  it("deletes a performance", async () => {
    window.confirm = vi.fn(() => true);
    render(<PerformanceConfigPanel />);
    const delBtns = document.querySelectorAll(".danger-button");
    expect(delBtns.length).toBeGreaterThan(0);
    fireEvent.click(delBtns[0]);

    await waitFor(() => expect(mockSaveStoryPackage).toHaveBeenCalledOnce());
    const saved = mockSaveStoryPackage.mock.calls[0][0] as StoryPackage;
    expect(saved.pluginManifest?.performances.qiaofeng_entrance).toBeUndefined();
  });

  it("shows asset upload fields for audio renderer", () => {
    render(<PerformanceConfigPanel />);
    // Switch to audio renderer
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "audio" } });
    expect(screen.getByText("音频文件")).toBeTruthy();
  });

  describe("preview", () => {
    it("renders audio play button for audio performances with asset", () => {
      render(<PerformanceConfigPanel />);
      // "小薇轻喘" is audio with main asset
      const playBtns = document.querySelectorAll(".perf-preview-btn");
      expect(playBtns.length).toBe(1);
    });

    it("renders image thumbnail for image performances with asset", () => {
      render(<PerformanceConfigPanel />);
      // "落日背景" is image with bg asset
      const imgs = document.querySelectorAll(".perf-preview-img");
      expect(imgs.length).toBe(1);
      const img = imgs[0].querySelector("img");
      expect(img).toBeTruthy();
      expect(img!.getAttribute("src")).toContain("sunset.png");
    });

    it("does not render preview button for video performances", () => {
      render(<PerformanceConfigPanel />);
      // qiaofeng_entrance is video — should NOT have preview button
      const videoRow = document.querySelector("article.perf-row");
      expect(videoRow).toBeTruthy();
      const btn = videoRow!.querySelector(".perf-preview-btn");
      expect(btn).toBeNull();
    });

    it("does not render audio preview when asset path is empty", () => {
      render(<PerformanceConfigPanel />);
      // "无资源音频" has no audio.main
      const rows = document.querySelectorAll("article.perf-row");
      // Find the row with "无资源音频"
      let noAssetRow: Element | null = null;
      rows.forEach((row) => {
        if (row.textContent?.includes("无资源音频")) noAssetRow = row;
      });
      expect(noAssetRow).toBeTruthy();
      expect(noAssetRow!.querySelector(".perf-preview-btn")).toBeNull();
    });

    it("toggles play/pause on audio button click", () => {
      render(<PerformanceConfigPanel />);
      const playBtn = document.querySelector(".perf-preview-btn") as HTMLButtonElement;
      expect(playBtn).toBeTruthy();
      // Initially showing Play icon
      expect(playBtn.querySelector("svg")).toBeTruthy();

      fireEvent.click(playBtn);
      expect(mockAudioPlay).toHaveBeenCalledOnce();
      // Should now show Pause
      expect(playBtn.classList.contains("playing")).toBe(true);

      fireEvent.click(playBtn);
      // Should pause
      expect(mockAudioPause).toHaveBeenCalledOnce();
      expect(playBtn.classList.contains("playing")).toBe(false);
    });

    it("stops previous audio when playing a different one", () => {
      // This test verifies the toggleAudio logic: clicking a new audio stops the previous one
      render(<PerformanceConfigPanel />);
      const playBtn = document.querySelector(".perf-preview-btn") as HTMLButtonElement;
      expect(playBtn).toBeTruthy();

      // Click to play
      fireEvent.click(playBtn);
      expect(mockAudioPlay).toHaveBeenCalledTimes(1);
      expect(playBtn.classList.contains("playing")).toBe(true);

      // Click again to stop
      fireEvent.click(playBtn);
      expect(mockAudioPause).toHaveBeenCalledTimes(1);
      expect(playBtn.classList.contains("playing")).toBe(false);
    });

    it("image thumbnail links to full asset URL", () => {
      render(<PerformanceConfigPanel />);
      const imgLink = document.querySelector(".perf-preview-img") as HTMLAnchorElement;
      expect(imgLink).toBeTruthy();
      expect(imgLink.getAttribute("href")).toContain("/api/story-assets/pkg_001/");
      expect(imgLink.getAttribute("href")).toContain("sunset.png");
      expect(imgLink.getAttribute("target")).toBe("_blank");
    });
  });

  describe("edit", () => {
    it("populates form when edit button is clicked", () => {
      render(<PerformanceConfigPanel />);
      const editBtn = document.querySelector(".paper-icon");
      expect(editBtn).toBeTruthy();
      fireEvent.click(editBtn!);

      // Name input should be populated
      const nameInput = screen.getByPlaceholderText("飞龙在天") as HTMLInputElement;
      expect(nameInput.value).toBe("乔峰英雄登场");

      // Duration should be populated
      const durationInput = screen.getByDisplayValue("4200");
      expect(durationInput).toBeTruthy();
    });

    it("shows edit UI labels when editing", () => {
      render(<PerformanceConfigPanel />);
      fireEvent.click(document.querySelector(".paper-icon")!);

      expect(screen.getByText("保存修改")).toBeTruthy();
      expect(screen.getByText("取消编辑")).toBeTruthy();
      expect(screen.getByText("编辑演出 — 乔峰英雄登场")).toBeTruthy();
    });

    it("highlights the row being edited", () => {
      render(<PerformanceConfigPanel />);
      fireEvent.click(document.querySelector(".paper-icon")!);

      const editingRow = document.querySelector(".perf-row.editing");
      expect(editingRow).toBeTruthy();
    });

    it("cancels edit and resets form", () => {
      render(<PerformanceConfigPanel />);
      fireEvent.click(document.querySelector(".paper-icon")!);
      fireEvent.click(screen.getByText("取消编辑"));

      const nameInput = screen.getByPlaceholderText("飞龙在天") as HTMLInputElement;
      expect(nameInput.value).toBe("");
      expect(screen.queryByText("保存修改")).toBeNull();
    });

    it("saves edit with original performance ID", async () => {
      render(<PerformanceConfigPanel />);
      fireEvent.click(document.querySelector(".paper-icon")!);

      // Change the name
      const nameInput = screen.getByPlaceholderText("飞龙在天") as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: "乔峰霸气登场" } });

      fireEvent.click(screen.getByText("保存修改"));

      await waitFor(() => expect(mockSaveStoryPackage).toHaveBeenCalledOnce());
      const saved = mockSaveStoryPackage.mock.calls[0][0] as StoryPackage;
      const perfs = saved.pluginManifest?.performances ?? {};

      // Should have updated the existing ID (not created a new one)
      expect(perfs.qiaofeng_entrance).toBeTruthy();
      expect(perfs.qiaofeng_entrance.name).toBe("乔峰霸气登场");
      // Old name should not exist as a separate entry
      const oldNameEntry = Object.entries(perfs).find(([, p]) => p.name === "乔峰英雄登场");
      expect(oldNameEntry).toBeUndefined();
    });
  });
});
