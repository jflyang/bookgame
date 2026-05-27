import { describe, it, expect, beforeEach, vi } from "vitest";
import { AdminApplicationService } from "../adminApplicationService.js";
import type { DialogueEngine } from "../../services/dialogueEngine.js";
import type { StoryPackageService } from "../../services/storyPackageService.js";
import type { SessionSaveService } from "../../services/sessionSaveService.js";
import type { MediaService } from "../../services/mediaService.js";
import type { LlmConfigService } from "../../resources/llm/llmConfigService.js";
import type { AuditLogService } from "../../services/auditLogService.js";
import type { Character, LlmConfig, StoryPackage } from "@story-game/shared";

const mockCharacter: Character = {
  id: "qiaofeng",
  name: "乔峰",
  role: "主导者",
  avatar: "乔",
  personaPrompt: "You are Qiao Feng",
  rules: [],
  skillIds: [],
  knowledgeBaseIds: [],
};

const mockStoryPackage: StoryPackage = {
  id: "pkg_001",
  title: "Test Package",
  description: "A test",
  hidden: false,
  storySettingPrompt: "# Test",
  scenario: {
    id: "sc1",
    title: "Test",
    premise: "P",
    currentStage: "start",
    stages: ["start"],
    stageDetails: [],
    currentGoal: "G",
    rules: [],
    initialStates: [],
  },
  characters: [structuredClone(mockCharacter)],
  skills: [],
  knowledgeDocuments: [],
  promptRules: [],
  debugConfig: { showPromptLayers: false, showRawOutput: false, showValidation: false },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function createMockDialogueEngine() {
  return {
    listStoryPackages: vi.fn(),
    createStoryPackage: vi.fn(),
    updateStoryPackage: vi.fn(),
    deleteStoryPackage: vi.fn(),
    getCharacters: vi.fn(),
    updateCharacter: vi.fn(),
    getSessionState: vi.fn(),
    getMessages: vi.fn(),
  } as any;
}

function createMockStoryPackageService() {
  return {
    get: vi.fn(),
    list: vi.fn(),
    createExportZip: vi.fn(),
    upsert: vi.fn(),
    importZip: vi.fn(),
    create: vi.fn(),
    savePerformanceAudioAsset: vi.fn(),
    savePerformanceImageAsset: vi.fn(),
  } as any;
}

function createMockSessionSaveService() {
  return {
    list: vi.fn(),
    get: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  } as any;
}

function createMockMediaService() {
  return {
    saveImage: vi.fn(),
    getImageStream: vi.fn(),
    imagePath: vi.fn(),
    removeImage: vi.fn(),
  } as any;
}

function createMockLlmConfigService() {
  return {
    getView: vi.fn(),
    update: vi.fn(),
    getConfig: vi.fn(),
  } as any;
}

function createMockAuditLogService() {
  return {
    list: vi.fn(),
    append: vi.fn(),
    findBySession: vi.fn(),
  } as any;
}

describe("AdminApplicationService", () => {
  let service: AdminApplicationService;
  let mockDE: ReturnType<typeof createMockDialogueEngine>;
  let mockSP: ReturnType<typeof createMockStoryPackageService>;
  let mockSS: ReturnType<typeof createMockSessionSaveService>;
  let mockMedia: ReturnType<typeof createMockMediaService>;
  let mockLLM: ReturnType<typeof createMockLlmConfigService>;
  let mockAudit: ReturnType<typeof createMockAuditLogService>;

  beforeEach(() => {
    mockDE = createMockDialogueEngine();
    mockSP = createMockStoryPackageService();
    mockSS = createMockSessionSaveService();
    mockMedia = createMockMediaService();
    mockLLM = createMockLlmConfigService();
    mockAudit = createMockAuditLogService();
    service = new AdminApplicationService(mockDE, mockSP, mockSS, mockMedia, mockLLM, mockAudit);
  });

  it("listStoryPackages delegates to dialogueEngine", () => {
    const result = { storyPackages: [structuredClone(mockStoryPackage)] };
    mockDE.listStoryPackages.mockReturnValue(result);
    expect(service.listStoryPackages()).toBe(result);
    expect(mockDE.listStoryPackages).toHaveBeenCalledOnce();
  });

  it("createStoryPackage delegates to dialogueEngine", () => {
    const result = { storyPackage: structuredClone(mockStoryPackage), storyPackages: [mockStoryPackage] };
    mockDE.createStoryPackage.mockReturnValue(result);
    expect(service.createStoryPackage("New", "pkg_001")).toBe(result);
    expect(mockDE.createStoryPackage).toHaveBeenCalledWith("New", "pkg_001");
  });

  it("updateStoryPackage delegates to dialogueEngine", () => {
    const result = { storyPackage: structuredClone(mockStoryPackage), storyPackages: [mockStoryPackage] };
    mockDE.updateStoryPackage.mockReturnValue(result);
    expect(service.updateStoryPackage(mockStoryPackage)).toBe(result);
    expect(mockDE.updateStoryPackage).toHaveBeenCalledWith(mockStoryPackage);
  });

  it("deleteStoryPackage delegates to dialogueEngine", () => {
    const result = { removed: structuredClone(mockStoryPackage), storyPackages: [] };
    mockDE.deleteStoryPackage.mockReturnValue(result);
    expect(service.deleteStoryPackage("pkg_001")).toBe(result);
    expect(mockDE.deleteStoryPackage).toHaveBeenCalledWith("pkg_001");
  });

  it("exportStoryPackage returns buffer and filename", () => {
    const buffer = Buffer.from("zip-data");
    mockSP.get.mockReturnValue(structuredClone(mockStoryPackage));
    mockSP.createExportZip.mockReturnValue(buffer);
    const result = service.exportStoryPackage("pkg_001");
    expect(result.buffer).toBe(buffer);
    expect(result.filename).toBe("Test Package.task-package.zip");
    expect(mockSP.get).toHaveBeenCalledWith("pkg_001");
    expect(mockSP.createExportZip).toHaveBeenCalledWith("pkg_001");
  });

  it("getCharacters delegates to dialogueEngine", () => {
    const result = { characters: [structuredClone(mockCharacter)], skills: [], knowledgeDocuments: [] };
    mockDE.getCharacters.mockReturnValue(result);
    expect(service.getCharacters()).toBe(result);
    expect(mockDE.getCharacters).toHaveBeenCalledOnce();
  });

  it("updateCharacter delegates to dialogueEngine", () => {
    const result = { character: structuredClone(mockCharacter), characters: [mockCharacter] };
    mockDE.updateCharacter.mockReturnValue(result);
    expect(service.updateCharacter(mockCharacter)).toBe(result);
    expect(mockDE.updateCharacter).toHaveBeenCalledWith(mockCharacter.id, mockCharacter);
  });

  it("updateThumbnail saves image and updates package", () => {
    const url = "/api/admin/media/pkg_001";
    const pkg = structuredClone(mockStoryPackage);
    mockMedia.saveImage.mockReturnValue(url);
    mockSP.get.mockReturnValue(pkg);
    mockSP.upsert.mockReturnValue({ ...pkg, thumbnail: url });

    const result = service.updateThumbnail("pkg_001", Buffer.from("img"), "thumb.png");
    expect(result.thumbnail).toBe(url);
    expect(mockMedia.saveImage).toHaveBeenCalledWith("pkg_001", Buffer.from("img"), "thumb.png");
    expect(mockSP.upsert).toHaveBeenCalledWith(expect.objectContaining({ thumbnail: url }));
  });

  it("deleteThumbnail removes image and clears thumbnail", () => {
    const pkg = structuredClone(mockStoryPackage);
    pkg.thumbnail = "/api/admin/media/pkg_001";
    mockSP.get.mockReturnValue(pkg);

    const result = service.deleteThumbnail("pkg_001");
    expect(result.ok).toBe(true);
    expect(mockMedia.removeImage).toHaveBeenCalledWith("pkg_001");
    expect(mockSP.upsert).toHaveBeenCalledWith(expect.objectContaining({ thumbnail: "" }));
  });

  it("deleteThumbnail does not upsert when no thumbnail exists", () => {
    mockSP.get.mockReturnValue(structuredClone(mockStoryPackage));
    service.deleteThumbnail("pkg_001");
    expect(mockMedia.removeImage).toHaveBeenCalled();
    expect(mockSP.upsert).not.toHaveBeenCalled();
  });

  it("uploadPerformanceAudio stores a package asset", () => {
    mockSP.savePerformanceAudioAsset.mockReturnValue("assets/performances/qf/audio/hit.mp3");
    const result = service.uploadPerformanceAudio("pkg_001", "qf_audio", Buffer.from("mp3"), "hit.mp3");
    expect(result.path).toBe("assets/performances/qf/audio/hit.mp3");
    expect(mockSP.savePerformanceAudioAsset).toHaveBeenCalledWith("pkg_001", "qf_audio", Buffer.from("mp3"), "hit.mp3");
  });

  it("uploadPerformanceImage stores a package asset", () => {
    mockSP.savePerformanceImageAsset.mockReturnValue("assets/performances/qf/images/card.png");
    const result = service.uploadPerformanceImage("pkg_001", "qf_image", Buffer.from("png"), "card.png");
    expect(result.path).toBe("assets/performances/qf/images/card.png");
    expect(mockSP.savePerformanceImageAsset).toHaveBeenCalledWith("pkg_001", "qf_image", Buffer.from("png"), "card.png");
  });

  it("getMedia returns stream and mime type for existing image", () => {
    const stream = { pipe: vi.fn() } as unknown as NodeJS.ReadableStream;
    mockMedia.getImageStream.mockReturnValue(stream);
    mockMedia.imagePath.mockReturnValue("/tmp/media/pkg_001/thumbnail.png");
    const result = service.getMedia("pkg_001");
    expect(result).not.toBeNull();
    expect(result!.stream).toBe(stream);
    expect(result!.mime).toBe("image/png");
  });

  it("getMedia returns null when no image exists", () => {
    mockMedia.getImageStream.mockReturnValue(null);
    expect(service.getMedia("pkg_001")).toBeNull();
  });

  it("listSaves delegates to sessionSaveService", () => {
    const saves = [{ sessionId: "s1", label: "Save 1", round: 3, status: "active", messageCount: 5, createdAt: "2026-01-01", updatedAt: "2026-01-02" }];
    mockSS.list.mockReturnValue(saves);
    expect(service.listSaves("pkg_001")).toEqual({ saves });
    expect(mockSS.list).toHaveBeenCalledWith("pkg_001");
  });

  it("getSave delegates to sessionSaveService", () => {
    const save = { sessionId: "s1", label: "Save", gameState: {} as any, messages: [], createdAt: "", updatedAt: "" };
    mockSS.get.mockReturnValue(save);
    expect(service.getSave("pkg_001", "s1")).toEqual({ save });
    expect(mockSS.get).toHaveBeenCalledWith("pkg_001", "s1");
  });

  it("saveCurrentSession gets state and messages, then saves", () => {
    const state = { gameState: { round: 1 } };
    const messages = [{ id: "m1", content: "Hi" }];
    const save = { sessionId: "s1", label: "存档", gameState: state.gameState, messages, createdAt: "", updatedAt: "" };
    mockDE.getSessionState.mockReturnValue(state);
    mockDE.getMessages.mockReturnValue(messages);
    mockSS.save.mockReturnValue(save);

    const result = service.saveCurrentSession("pkg_001", "s1");
    expect(result.save).toBe(save);
    expect(mockDE.getSessionState).toHaveBeenCalledWith("s1");
    expect(mockDE.getMessages).toHaveBeenCalledWith("s1");
    expect(mockSS.save).toHaveBeenCalledWith("pkg_001", expect.any(String), state.gameState, messages);
  });

  it("deleteSave delegates to sessionSaveService", () => {
    expect(service.deleteSave("pkg_001", "s1")).toEqual({ ok: true });
    expect(mockSS.delete).toHaveBeenCalledWith("pkg_001", "s1");
  });

  describe("testLlmConnection", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
      mockLLM.getConfig.mockReturnValue({});
    });

    it("returns ok for mock provider", async () => {
      const config: LlmConfig = { provider: "mock", baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash", temperature: 0.8, maxTokens: 800 };
      const result = await service.testLlmConnection(config);
      expect(result.ok).toBe(true);
      expect(result.latency).toBe(0);
      expect(result.error).toContain("Mock");
    });

    it("deepseek without key and no stored key returns error", async () => {
      mockLLM.getConfig.mockReturnValue({ apiKey: "" });
      const config: LlmConfig = { provider: "deepseek", baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash", temperature: 0.8, maxTokens: 800 };
      const result = await service.testLlmConnection(config);
      expect(result.ok).toBe(false);
      expect(result.error).toContain("API Key");
    });

    it("deepseek with key calls fetch and returns ok", async () => {
      const response = { ok: true, json: async () => ({ choices: [{ message: { content: "Hi there!" } }] }) };
      (globalThis.fetch as any).mockResolvedValue(response);
      const config: LlmConfig = { provider: "deepseek", baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash", temperature: 0.8, maxTokens: 800, apiKey: "sk-test" };
      const result = await service.testLlmConnection(config);
      expect(result.ok).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.deepseek.com/chat/completions",
        expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer sk-test" }) })
      );
    });

    it("deepseek with fetch error returns error with latency", async () => {
      (globalThis.fetch as any).mockRejectedValue(new Error("Network failure"));
      const config: LlmConfig = { provider: "deepseek", baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash", temperature: 0.8, maxTokens: 800, apiKey: "sk-test" };
      const result = await service.testLlmConnection(config);
      expect(result.ok).toBe(false);
      expect(result.error).toBe("Network failure");
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it("deepseek fills apiKey from stored config when not provided", async () => {
      mockLLM.getConfig.mockReturnValue({ apiKey: "sk-stored" });
      const response = { ok: true, json: async () => ({ choices: [{ message: { content: "Hi" } }] }) };
      (globalThis.fetch as any).mockResolvedValue(response);
      const config: LlmConfig = { provider: "deepseek", baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash", temperature: 0.8, maxTokens: 800 };
      const result = await service.testLlmConnection(config);
      expect(result.ok).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer sk-stored" }) })
      );
    });
  });

  it("listAuditLog delegates to auditLogService", () => {
    const entries = [{ id: "1", type: "state_change", sessionId: "s1", summary: "changed", timestamp: "" }];
    mockAudit.list.mockReturnValue(entries);
    expect(service.listAuditLog()).toEqual({ entries });
    expect(mockAudit.list).toHaveBeenCalledWith({ type: undefined, sessionId: undefined, limit: 200 });
  });

  it("listAuditLog passes type and sessionId filters", () => {
    const entries = [{ id: "1", type: "state_change", sessionId: "s1", summary: "changed", timestamp: "" }];
    mockAudit.list.mockReturnValue(entries);
    service.listAuditLog("state_change", "s1");
    expect(mockAudit.list).toHaveBeenCalledWith({ type: "state_change", sessionId: "s1", limit: 200 });
  });
});
