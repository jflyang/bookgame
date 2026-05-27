import { extname } from "node:path";
import type {
  Character,
  LlmConfig,
  StoryPackage
} from "@story-game/shared";
import type { AuditLogService } from "../services/auditLogService.js";
import type { DialogueEngine } from "../services/dialogueEngine.js";
import type { MediaService } from "../services/mediaService.js";
import type { SessionSaveService } from "../services/sessionSaveService.js";
import type { StoryPackageService } from "../services/storyPackageService.js";
import type { LlmConfigService } from "../resources/llm/llmConfigService.js";

export class AdminApplicationService {
  constructor(
    private readonly dialogueEngine: DialogueEngine,
    private readonly storyPackages: StoryPackageService,
    private readonly sessionSaves: SessionSaveService,
    private readonly media: MediaService,
    private readonly llmConfig: LlmConfigService,
    private readonly auditLog: AuditLogService
  ) {}

  exportStoryPackage(id: string) {
    const pkg = this.storyPackages.get(id);
    return {
      buffer: this.storyPackages.createExportZip(id),
      filename: `${pkg.title || id}.task-package.zip`
    };
  }

  getCharacters() {
    return this.dialogueEngine.getCharacters();
  }

  updateCharacter(character: Character) {
    return this.dialogueEngine.updateCharacter(character.id, character);
  }

  listStoryPackages(includeHidden?: boolean) {
    return this.dialogueEngine.listStoryPackages(includeHidden);
  }

  createStoryPackage(title: string, sourcePackageId?: string) {
    return this.dialogueEngine.createStoryPackage(title, sourcePackageId);
  }

  importStoryPackage(buffer: Buffer, title?: string) {
    const storyPackage = this.storyPackages.importZip(buffer, title);
    return { storyPackage, storyPackages: this.storyPackages.list() };
  }

  updateStoryPackage(storyPackage: StoryPackage) {
    return this.dialogueEngine.updateStoryPackage(storyPackage);
  }

  deleteStoryPackage(id: string) {
    return this.dialogueEngine.deleteStoryPackage(id);
  }

  getLlmConfig() {
    return { llmConfig: this.llmConfig.getView() };
  }

  updateLlmConfig(config: LlmConfig) {
    return { llmConfig: this.llmConfig.update(config) };
  }

  updateThumbnail(id: string, buffer: Buffer, filename: string) {
    const url = this.media.saveImage(id, buffer, filename);
    const pkg = this.storyPackages.get(id);
    this.storyPackages.upsert({ ...pkg, thumbnail: url });
    return { thumbnail: url };
  }

  getMedia(id: string) {
    const stream = this.media.getImageStream(id);
    if (!stream) return null;
    const path = this.media.imagePath(id);
    const ext = path ? extname(path) : ".png";
    const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".gif" ? "image/gif" : ext === ".webp" ? "image/webp" : "image/png";
    return { stream, mime };
  }

  deleteThumbnail(id: string) {
    this.media.removeImage(id);
    const pkg = this.storyPackages.get(id);
    if (pkg.thumbnail) this.storyPackages.upsert({ ...pkg, thumbnail: "" });
    return { ok: true };
  }

  uploadPerformanceAudio(id: string, performanceId: string, buffer: Buffer, filename: string) {
    const path = this.storyPackages.savePerformanceAudioAsset(id, performanceId, buffer, filename);
    return { path };
  }

  uploadPerformanceImage(id: string, performanceId: string, buffer: Buffer, filename: string) {
    const path = this.storyPackages.savePerformanceImageAsset(id, performanceId, buffer, filename);
    return { path };
  }

  listSaves(storyPackageId: string) {
    return { saves: this.sessionSaves.list(storyPackageId) };
  }

  getSave(storyPackageId: string, saveId: string) {
    return { save: this.sessionSaves.get(storyPackageId, saveId) };
  }

  saveCurrentSession(storyPackageId: string, sessionId: string, label?: string) {
    const state = this.dialogueEngine.getSessionState(sessionId);
    const messages = this.dialogueEngine.getMessages(sessionId);
    const save = this.sessionSaves.save(storyPackageId, label || `存档 ${new Date().toLocaleString("zh-CN")}`, state.gameState, messages);
    return { save };
  }

  deleteSave(storyPackageId: string, saveId: string) {
    this.sessionSaves.delete(storyPackageId, saveId);
    return { ok: true };
  }

  async testLlmConnection(config: LlmConfig): Promise<{ ok: boolean; latency: number; error?: string }> {
    const start = Date.now();
    try {
      const testConfig = { ...config };
      if (!testConfig.apiKey) {
        testConfig.apiKey = this.llmConfig.getConfig().apiKey;
      }

      if (testConfig.provider === "mock") {
        return { ok: true, latency: 0, error: "Mock 模式无需真实连接" };
      }

      if (!testConfig.apiKey) {
        return { ok: false, latency: 0, error: "未配置 API Key，请先填写并保存密钥" };
      }

      const response = await fetch(`${testConfig.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testConfig.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: testConfig.model,
          temperature: 0,
          max_tokens: 200,
          messages: [{ role: "user", content: "Hi" }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        return { ok: false, latency: Date.now() - start, error: `${response.status} ${errText}` };
      }

      const data = await response.json() as any;
      const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.message?.reasoning_content;
      if (!content) {
        const raw = JSON.stringify(data).slice(0, 300);
        return { ok: false, latency: Date.now() - start, error: `模型返回空内容，请检查 model 名称是否正确。原始响应: ${raw}` };
      }

      return { ok: true, latency: Date.now() - start };
    } catch (err) {
      return { ok: false, latency: Date.now() - start, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  listAuditLog(type?: string, sessionId?: string) {
    return { entries: this.auditLog.list({ type: type as any, sessionId, limit: 200 }) };
  }
}
