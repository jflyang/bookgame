import type Database from "better-sqlite3";
import { getDatabase } from "../database/database.js";

export interface SessionRow {
  id: string;
  story_package_id: string;
  story_package_title: string;
  round: number;
  status: "idle" | "active" | "completed";
  current_stage: string;
  character_states: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface CharacterStateSnapshot {
  name: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
}

export interface SessionSummary {
  id: string;
  storyPackageId: string;
  storyPackageTitle: string;
  round: number;
  status: "idle" | "active" | "completed";
  currentStage: string;
  characterStates: CharacterStateSnapshot[];
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SessionUpsertInput {
  id: string;
  storyPackageId: string;
  storyPackageTitle: string;
  round: number;
  status: "idle" | "active" | "completed";
  currentStage: string;
  characterStates: CharacterStateSnapshot[];
  messageCount: number;
}

function toDb(input: SessionUpsertInput, now: string): SessionRow {
  return {
    id: input.id,
    story_package_id: input.storyPackageId,
    story_package_title: input.storyPackageTitle,
    round: input.round,
    status: input.status,
    current_stage: input.currentStage,
    character_states: JSON.stringify(input.characterStates),
    message_count: input.messageCount,
    created_at: now,
    updated_at: now,
  };
}

function fromDb(row: SessionRow): SessionSummary {
  return {
    id: row.id,
    storyPackageId: row.story_package_id,
    storyPackageTitle: row.story_package_title,
    round: row.round,
    status: row.status,
    currentStage: row.current_stage,
    characterStates: JSON.parse(row.character_states) as CharacterStateSnapshot[],
    messageCount: row.message_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SessionRepository {
  private db: Database.Database;
  private upsertStmt?: Database.Statement;

  constructor() {
    this.db = getDatabase();
  }

  upsert(input: SessionUpsertInput): void {
    if (!this.upsertStmt) {
      this.upsertStmt = this.db.prepare(`
        INSERT INTO sessions
          (id, story_package_id, story_package_title, round, status,
           current_stage, character_states, message_count, created_at, updated_at)
        VALUES
          (@id, @story_package_id, @story_package_title, @round, @status,
           @current_stage, @character_states, @message_count, @created_at, @updated_at)
        ON CONFLICT(id) DO UPDATE SET
          story_package_id = excluded.story_package_id,
          story_package_title = excluded.story_package_title,
          round = excluded.round,
          status = excluded.status,
          current_stage = excluded.current_stage,
          character_states = excluded.character_states,
          message_count = excluded.message_count,
          updated_at = excluded.updated_at
      `);
    }
    this.upsertStmt.run(toDb(input, new Date().toISOString()));
  }

  // Remove old insertStmt/updateStmt — they're replaced by upsertStmt

  listAll(limit?: number): SessionSummary[] {
    const rows = this.db.prepare(`
      SELECT * FROM sessions ORDER BY updated_at DESC ${limit ? "LIMIT ?" : ""}
    `).all(...(limit ? [limit] : [])) as SessionRow[];
    return rows.map(fromDb);
  }

  findByPackage(storyPackageId: string, limit?: number): SessionSummary[] {
    const rows = this.db.prepare(`
      SELECT * FROM sessions WHERE story_package_id = ? ORDER BY updated_at DESC ${limit ? "LIMIT ?" : ""}
    `).all(...(limit ? [storyPackageId, limit] : [storyPackageId])) as SessionRow[];
    return rows.map(fromDb);
  }

  findByStatus(status: string, limit?: number): SessionSummary[] {
    const rows = this.db.prepare(`
      SELECT * FROM sessions WHERE status = ? ORDER BY updated_at DESC ${limit ? "LIMIT ?" : ""}
    `).all(...(limit ? [status, limit] : [status])) as SessionRow[];
    return rows.map(fromDb);
  }

  getById(id: string): SessionSummary | null {
    const row = this.db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as SessionRow | undefined;
    return row ? fromDb(row) : null;
  }

  deleteAll(): void {
    this.db.exec(`DELETE FROM sessions`);
  }

  count(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM sessions`).get() as { count: number };
    return row.count;
  }

  deleteById(id: string): void {
    this.db.prepare(`DELETE FROM sessions WHERE id = ?`).run(id);
  }
}
