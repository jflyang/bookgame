import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  listStoryPackages, createStoryPackage, updateStoryPackage, deleteStoryPackage,
  uploadThumbnail, deleteThumbnail, getLlmConfig, updateLlmConfig,
  downloadStoryPackage, uploadPerformanceAudio, uploadPerformanceImage,
} from "../adminApi.js";

function mockResponse(data: unknown, ok = true) {
  return {
    ok,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

describe("adminApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listStoryPackages", () => {
    it("fetches GET /api/admin/story-packages", async () => {
      mockFetch.mockResolvedValue(mockResponse({ storyPackages: [{ id: "p1" }, { id: "p2" }] }));
      const result = await listStoryPackages();
      expect(result.storyPackages).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/story-packages")
      );
    });
  });

  describe("createStoryPackage", () => {
    it("posts with title and sourcePackageId", async () => {
      mockFetch.mockResolvedValue(mockResponse({ storyPackage: { id: "new" }, storyPackages: [] }));
      await createStoryPackage("新故事", "source_id");
      const call = mockFetch.mock.calls[0];
      expect(call[1].method).toBe("POST");
      const body = JSON.parse(call[1].body);
      expect(body.title).toBe("新故事");
      expect(body.sourcePackageId).toBe("source_id");
    });
  });

  describe("updateStoryPackage", () => {
    it("puts to package endpoint", async () => {
      const pkg = { id: "p1", title: "Updated", description: "", hidden: false, thumbnail: "", storySettingPrompt: "", scenario: {} as any, characters: [], skills: [], knowledgeDocuments: [], promptRules: [], debugConfig: { showPromptLayers: false, showRawOutput: false, showValidation: false }, createdAt: "", updatedAt: "" };
      mockFetch.mockResolvedValue(mockResponse({ storyPackage: pkg, storyPackages: [pkg] }));
      const result = await updateStoryPackage(pkg);
      expect(result.storyPackages).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/story-packages/p1"),
        expect.objectContaining({ method: "PUT" })
      );
    });
  });

  describe("deleteStoryPackage", () => {
    it("deletes and returns updated list", async () => {
      mockFetch.mockResolvedValue(mockResponse({ storyPackages: [] }));
      const result = await deleteStoryPackage("p1");
      expect(result.storyPackages).toHaveLength(0);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/story-packages/p1"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("uploadThumbnail", () => {
    it("posts FormData to thumbnail endpoint", async () => {
      mockFetch.mockResolvedValue(mockResponse({ thumbnail: "/api/admin/media/pkg1" }));
      const file = new File(["fake"], "thumb.png", { type: "image/png" });
      const result = await uploadThumbnail("pkg1", file);
      expect(result.thumbnail).toBe("/api/admin/media/pkg1");
      const call = mockFetch.mock.calls[0];
      expect(call[1].method).toBe("POST");
      expect(call[1].body instanceof FormData).toBe(true);
    });
  });

  describe("deleteThumbnail", () => {
    it("deletes thumbnail", async () => {
      mockFetch.mockResolvedValue(mockResponse({ ok: true }));
      const result = await deleteThumbnail("pkg1");
      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/thumbnail"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("uploadPerformanceAudio", () => {
    it("posts FormData to performance audio endpoint", async () => {
      mockFetch.mockResolvedValue(mockResponse({ path: "assets/performances/qf/audio/hit.mp3" }));
      const file = new File(["fake"], "hit.mp3", { type: "audio/mpeg" });
      const result = await uploadPerformanceAudio("pkg1", "qf_audio", file);
      expect(result.path).toBe("assets/performances/qf/audio/hit.mp3");
      const call = mockFetch.mock.calls[0];
      expect(call[0]).toContain("/api/admin/story-packages/pkg1/performance-audio?performanceId=qf_audio");
      expect(call[1].method).toBe("POST");
      expect(call[1].body instanceof FormData).toBe(true);
    });
  });

  describe("uploadPerformanceImage", () => {
    it("posts FormData to performance image endpoint", async () => {
      mockFetch.mockResolvedValue(mockResponse({ path: "assets/performances/qf/images/card.png" }));
      const file = new File(["fake"], "card.png", { type: "image/png" });
      const result = await uploadPerformanceImage("pkg1", "qf_image", file);
      expect(result.path).toBe("assets/performances/qf/images/card.png");
      const call = mockFetch.mock.calls[0];
      expect(call[0]).toContain("/api/admin/story-packages/pkg1/performance-image?performanceId=qf_image");
      expect(call[1].method).toBe("POST");
      expect(call[1].body instanceof FormData).toBe(true);
    });
  });

  describe("getLlmConfig", () => {
    it("fetches config", async () => {
      mockFetch.mockResolvedValue(mockResponse({ llmConfig: { provider: "deepseek", hasApiKey: true } }));
      const result = await getLlmConfig();
      expect(result.llmConfig.provider).toBe("deepseek");
    });
  });

  describe("updateLlmConfig", () => {
    it("puts config", async () => {
      mockFetch.mockResolvedValue(mockResponse({ llmConfig: { provider: "deepseek", hasApiKey: true } }));
      const config = { provider: "deepseek" as const, baseUrl: "https://api.deepseek.com", model: "v4", temperature: 0.8, maxTokens: 800 };
      const result = await updateLlmConfig(config);
      expect(result.llmConfig.hasApiKey).toBe(true);
    });
  });

  describe("downloadStoryPackage", () => {
    it("creates anchor and clicks it", () => {
      const createElementSpy = vi.spyOn(document, "createElement");
      const mockAnchor = { href: "", download: "", click: vi.fn() } as any;
      createElementSpy.mockReturnValue(mockAnchor);
      vi.spyOn(document.body, "appendChild").mockImplementation(vi.fn());
      vi.spyOn(document.body, "removeChild").mockImplementation(vi.fn());

      downloadStoryPackage("pkg1");

      expect(mockAnchor.href).toContain("/api/admin/story-packages/pkg1/export");
      expect(mockAnchor.download).toBe("pkg1.story-package.zip");
      expect(mockAnchor.click).toHaveBeenCalled();

      createElementSpy.mockRestore();
    });
  });
});
