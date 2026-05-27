import { nanoid } from "nanoid";
import type Database from "better-sqlite3";
import { getDatabase } from "../modules/database/database.js";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  type: "llm_request" | "llm_response" | "validation_failed" | "state_change" | "session_created" | "session_completed";
  sessionId?: string;
  speakerId?: string;
  summary: string;
  details?: Record<string, unknown>;
}

interface DbRow {
  id: string;
  timestamp: string;
  type: string;
  session_id: string | null;
  speaker_id: string | null;
  summary: string;
  details: string | null;
}

function fromDb(row: DbRow): AuditLogEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    type: row.type as AuditLogEntry["type"],
    sessionId: row.session_id ?? undefined,
    speakerId: row.speaker_id ?? undefined,
    summary: row.summary,
    details: row.details ? JSON.parse(row.details) : undefined,
  };
}

export class AuditLogService {
  private db: Database.Database;
  private insertStmt: Database.Statement;

  constructor() {
    this.db = getDatabase();
    this.insertStmt = this.db.prepare(`
      INSERT INTO audit_logs (id, timestamp, type, session_id, speaker_id, summary, details)
      VALUES (@id, @timestamp, @type, @session_id, @speaker_id, @summary, @details)
    `);
  }

  append(entry: Omit<AuditLogEntry, "id" | "timestamp">) {
    const id = `audit_${nanoid(10)}`;
    const timestamp = new Date().toISOString();
    this.insertStmt.run({
      id,
      timestamp,
      type: entry.type,
      session_id: entry.sessionId ?? null,
      speaker_id: entry.speakerId ?? null,
      summary: entry.summary,
      details: entry.details ? JSON.stringify(entry.details) : null,
    });
  }

  list(filter?: { type?: AuditLogEntry["type"]; sessionId?: string; limit?: number }) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.type) {
      conditions.push("type = ?");
      params.push(filter.type);
    }
    if (filter?.sessionId) {
      conditions.push("session_id = ?");
      params.push(filter.sessionId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filter?.limit ?? 200;

    const rows = this.db.prepare(`
      SELECT * FROM audit_logs ${where} ORDER BY timestamp DESC LIMIT ?
    `).all(...params, limit) as DbRow[];

    return rows.map(fromDb);
  }

  findBySession(sessionId: string) {
    const rows = this.db.prepare(`
      SELECT * FROM audit_logs WHERE session_id = ? ORDER BY timestamp DESC
    `).all(sessionId) as DbRow[];
    return rows.map(fromDb);
  }
}
