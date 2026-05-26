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

  listStoryPackages() {
    return this.dialogueEngine.listStoryPackages();
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

  listAuditLog(type?: string, sessionId?: string) {
    return { entries: this.auditLog.list({ type: type as any, sessionId, limit: 200 }) };
  }
}
