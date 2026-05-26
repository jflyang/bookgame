import { readdirSync, readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import type { GameState, Message } from "@story-game/shared";
import { createModuleLogger } from "../utils/logger.js";
import { assertSafeId, resolveInside } from "../data/pathGuards.js";
import { TaskPackageRepository } from "../data/taskPackageRepository.js";

const logger = createModuleLogger("sessionSave");

export interface SessionSave {
  sessionId: string;
  label: string;
  gameState: GameState;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface SessionSaveMeta {
  sessionId: string;
  label: string;
  round: number;
  status: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export class SessionSaveService {
  private readonly repository: TaskPackageRepository;

  constructor(storage: string | TaskPackageRepository) {
    this.repository = typeof storage === "string" ? new TaskPackageRepository(storage) : storage;
  }

  private savesDir(storyPackageId: string) {
    return this.repository.savesDir(assertSafeId(storyPackageId, "storyPackageId"));
  }

  list(storyPackageId: string): SessionSaveMeta[] {
    const dir = this.savesDir(storyPackageId);
    if (!existsSync(dir)) return [];
    const files = readdirSync(dir).filter((f) => f.endsWith(".session.json"));
    return files.map((file) => {
      const raw = readFileSync(resolveInside(dir, file), "utf-8");
      const save = JSON.parse(raw) as SessionSave;
      return {
        sessionId: save.sessionId,
        label: save.label,
        round: save.gameState.round,
        status: save.gameState.status,
        messageCount: save.messages.length,
        createdAt: save.createdAt,
        updatedAt: save.updatedAt,
      };
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  get(storyPackageId: string, sessionId: string): SessionSave {
    const path = resolveInside(this.savesDir(storyPackageId), `${assertSafeId(sessionId, "sessionId")}.session.json`);
    if (!existsSync(path)) throw new Error(`Save not found: ${sessionId}`);
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as SessionSave;
  }

  save(storyPackageId: string, label: string, gameState: GameState, messages: Message[]): SessionSave {
    const dir = this.savesDir(storyPackageId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const sessionId = assertSafeId(gameState.sessionId, "sessionId");
    const now = new Date().toISOString();
    const savePath = resolveInside(dir, `${sessionId}.session.json`);
    const existing = existsSync(savePath);
    const save: SessionSave = {
      sessionId,
      label,
      gameState: structuredClone(gameState),
      messages: structuredClone(messages),
      createdAt: existing ? (() => { const r = readFileSync(savePath, "utf-8"); return JSON.parse(r).createdAt; })() : now,
      updatedAt: now,
    };
    writeFileSync(savePath, JSON.stringify(save, null, 2), "utf-8");
    logger.info({ storyPackageId, sessionId, label }, "session saved");
    return save;
  }

  delete(storyPackageId: string, sessionId: string): void {
    const path = resolveInside(this.savesDir(storyPackageId), `${assertSafeId(sessionId, "sessionId")}.session.json`);
    if (existsSync(path)) {
      unlinkSync(path);
      logger.info({ storyPackageId, sessionId }, "save deleted");
    }
  }
}
