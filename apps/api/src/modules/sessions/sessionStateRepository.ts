import type Database from "better-sqlite3";
import type { GameState, Message } from "@story-game/shared";
import { getDatabase } from "../database/database.js";
import { createModuleLogger } from "../../utils/logger.js";

const logger = createModuleLogger("sessionState:db");

export interface LiveSessionRow {
  session_id: string;
  story_package_id: string;
  game_state: string;
  messages: string;
  updated_at: string;
}

export interface LiveSession {
  sessionId: string;
  storyPackageId: string;
  gameState: GameState;
  messages: Message[];
  updatedAt: string;
}

export class SessionStateRepository {
  private db: Database.Database;
  private upsertStmt?: Database.Statement;
  private deleteStmt?: Database.Statement;

  constructor() {
    this.db = getDatabase();
  }

  /** Persist full session state (called after each turn) */
  save(sessionId: string, storyPackageId: string, gameState: GameState, messages: Message[]): void {
    if (!this.upsertStmt) {
      this.upsertStmt = this.db.prepare(`
        INSERT INTO session_live_state (session_id, story_package_id, game_state, messages, updated_at)
        VALUES (@session_id, @story_package_id, @game_state, @messages, @updated_at)
        ON CONFLICT(session_id) DO UPDATE SET
          story_package_id = excluded.story_package_id,
          game_state = excluded.game_state,
          messages = excluded.messages,
          updated_at = excluded.updated_at
      `);
    }
    this.upsertStmt.run({
      session_id: sessionId,
      story_package_id: storyPackageId,
      game_state: JSON.stringify(gameState),
      messages: JSON.stringify(messages),
      updated_at: new Date().toISOString(),
    });
  }

  /** Load all active sessions (for startup recovery) */
  loadAll(): LiveSession[] {
    const rows = this.db.prepare(
      `SELECT * FROM session_live_state ORDER BY updated_at DESC`
    ).all() as LiveSessionRow[];

    const sessions: LiveSession[] = [];
    for (const row of rows) {
      try {
        sessions.push({
          sessionId: row.session_id,
          storyPackageId: row.story_package_id,
          gameState: JSON.parse(row.game_state),
          messages: JSON.parse(row.messages),
          updatedAt: row.updated_at,
        });
      } catch (err) {
        logger.warn({ err, sessionId: row.session_id }, "failed to parse live session, skipping");
      }
    }
    return sessions;
  }

  /** Remove a session from live state (when completed or cleaned up) */
  delete(sessionId: string): void {
    if (!this.deleteStmt) {
      this.deleteStmt = this.db.prepare(`DELETE FROM session_live_state WHERE session_id = ?`);
    }
    this.deleteStmt.run(sessionId);
  }

  /** Count live sessions */
  count(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM session_live_state`).get() as { count: number };
    return row.count;
  }

  /** Delete all live sessions */
  deleteAll(): void {
    this.db.exec(`DELETE FROM session_live_state`);
  }
}
