import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import type { GameState, Message } from "@story-game/shared";
import { createModuleLogger } from "../utils/logger.js";
import { assertSafeId, resolveInside } from "../data/pathGuards.js";

const logger = createModuleLogger("sessionSave");

export const MAX_SAVE_SLOTS = 3;

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

export interface SaveSlot {
  slot: number;
  save: SessionSaveMeta | null;
}

export class SessionSaveService {
  constructor(private readonly savesRootDir: string) {
    if (!existsSync(savesRootDir)) mkdirSync(savesRootDir, { recursive: true });
  }

  private savesDir(storyPackageId: string) {
    return resolveInside(this.savesRootDir, assertSafeId(storyPackageId, "storyPackageId"));
  }

  private slotPath(storyPackageId: string, slot: number): string {
    return resolveInside(this.savesDir(storyPackageId), `slot-${slot}.session.json`);
  }

  /** Returns all 3 slots — slot number + metadata or null for empty */
  listSlots(storyPackageId: string): SaveSlot[] {
    const dir = this.savesDir(storyPackageId);
    if (!existsSync(dir)) return Array.from({ length: MAX_SAVE_SLOTS }, (_, i) => ({ slot: i + 1, save: null }));
    const slots: SaveSlot[] = [];
    for (let slot = 1; slot <= MAX_SAVE_SLOTS; slot++) {
      const path = this.slotPath(storyPackageId, slot);
      if (existsSync(path)) {
        try {
          const raw = readFileSync(path, "utf-8");
          const save = JSON.parse(raw) as SessionSave;
          slots.push({
            slot,
            save: {
              sessionId: save.sessionId,
              label: save.label,
              round: save.gameState.round,
              status: save.gameState.status,
              messageCount: save.messages.length,
              createdAt: save.createdAt,
              updatedAt: save.updatedAt,
            },
          });
        } catch (err) {
          logger.warn({ err, path, storyPackageId, slot }, "corrupt session save file, treating as empty slot");
          slots.push({ slot, save: null });
        }
      } else {
        slots.push({ slot, save: null });
      }
    }
    return slots;
  }

  /** Legacy list — returns flat array for backward compat */
  list(storyPackageId: string): SessionSaveMeta[] {
    return this.listSlots(storyPackageId)
      .filter((s) => s.save !== null)
      .map((s) => s.save!);
  }

  /** Get save by slot number */
  getBySlot(storyPackageId: string, slot: number): SessionSave {
    const path = this.slotPath(storyPackageId, slot);
    if (!existsSync(path)) throw new Error(`存档槽 ${slot} 为空`);
    const raw = readFileSync(path, "utf-8");
    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.sessionId || !parsed?.gameState || !parsed?.messages) {
        throw new Error(`存档槽 ${slot} 数据不完整，可能已损坏`);
      }
      return parsed as SessionSave;
    } catch (err) {
      if (err instanceof SyntaxError) {
        logger.error({ err, path, slot }, "corrupt save file — JSON parse failed");
        throw new Error(`存档槽 ${slot} 文件损坏，无法读取`);
      }
      throw err;
    }
  }

  /** Get save by session ID (for legacy compat, scans all slots) */
  get(storyPackageId: string, sessionId: string): SessionSave {
    for (let slot = 1; slot <= MAX_SAVE_SLOTS; slot++) {
      const path = this.slotPath(storyPackageId, slot);
      if (existsSync(path)) {
        try {
          const raw = readFileSync(path, "utf-8");
          const save = JSON.parse(raw) as SessionSave;
          if (save.sessionId === sessionId) return save;
        } catch (err) {
          logger.warn({ err, path, slot }, "skipping unreadable save file during lookup");
        }
      }
    }
    throw new Error(`未找到会话 ${sessionId} 的存档`);
  }

  /** Save to a specific slot (1-3). Overwrites if slot is occupied. */
  saveToSlot(storyPackageId: string, slot: number, label: string, gameState: GameState, messages: Message[]): SessionSave {
    if (slot < 1 || slot > MAX_SAVE_SLOTS) throw new Error(`Slot must be 1-${MAX_SAVE_SLOTS}`);
    const dir = this.savesDir(storyPackageId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const sessionId = assertSafeId(gameState.sessionId, "sessionId");
    const now = new Date().toISOString();
    const savePath = this.slotPath(storyPackageId, slot);
    const existing = existsSync(savePath);
    const save: SessionSave = {
      sessionId,
      label,
      gameState: structuredClone(gameState),
      messages: structuredClone(messages),
      createdAt: existing ? (() => { const r = readFileSync(savePath, "utf-8"); return JSON.parse(r).createdAt; })() : now,
      updatedAt: now,
    };
    try {
      writeFileSync(savePath, JSON.stringify(save, null, 2), "utf-8");
    } catch (err) {
      const cause = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to write session save to ${savePath}: ${cause}`);
    }
    logger.info({ storyPackageId, slot, sessionId, label }, "session saved to slot");
    return save;
  }

  /** Legacy save for backward compat — auto-picks first empty slot or overwrites slot 3 */
  save(storyPackageId: string, label: string, gameState: GameState, messages: Message[]): SessionSave {
    const slots = this.listSlots(storyPackageId);
    const empty = slots.find((s) => s.save === null);
    const slot = empty ? empty.slot : MAX_SAVE_SLOTS;
    return this.saveToSlot(storyPackageId, slot, label, gameState, messages);
  }

  /** Delete a save by slot */
  deleteBySlot(storyPackageId: string, slot: number): void {
    const path = this.slotPath(storyPackageId, slot);
    if (existsSync(path)) {
      unlinkSync(path);
      logger.info({ storyPackageId, slot }, "save slot deleted");
    }
  }

  /** Legacy delete by session ID */
  delete(storyPackageId: string, sessionId: string): void {
    for (let slot = 1; slot <= MAX_SAVE_SLOTS; slot++) {
      const path = this.slotPath(storyPackageId, slot);
      if (existsSync(path)) {
        const raw = readFileSync(path, "utf-8");
        const save = JSON.parse(raw) as SessionSave;
        if (save.sessionId === sessionId) {
          unlinkSync(path);
          logger.info({ storyPackageId, sessionId, slot }, "save deleted");
          return;
        }
      }
    }
  }
}
