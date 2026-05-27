import type Database from "better-sqlite3";
import type { RuntimeTurnRecord, RuntimeStatsAggregate } from "@story-game/shared";
import { getDatabase } from "./database.js";

interface DbRow {
  id: string;
  session_id: string;
  round: number;
  speaker_id: string;
  speaker_name: string;
  prompt: string;
  raw_llm_response: string;
  parsed_output: string | null;
  validation_result: "passed" | "failed";
  validation_errors: string;
  state_delta: string | null;
  stage_before: string;
  stage_after: string;
  latency_ms: number;
  token_usage: string | null;
  timestamp: string;
}

interface AggregateQueryResult {
  total_turns: number;
  total_sessions: number;
  avg_latency_ms: number;
  max_latency_ms: number;
  min_latency_ms: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  validation_pass_count: number;
  validation_fail_count: number;
  stage_changes: number;
}

function toDb(record: RuntimeTurnRecord): DbRow {
  return {
    id: record.id,
    session_id: record.sessionId,
    round: record.round,
    speaker_id: record.speakerId,
    speaker_name: record.speakerName,
    prompt: record.prompt,
    raw_llm_response: record.rawLlmResponse,
    parsed_output: record.parsedOutput !== null ? JSON.stringify(record.parsedOutput) : null,
    validation_result: record.validationResult,
    validation_errors: JSON.stringify(record.validationErrors),
    state_delta: record.stateDelta !== null ? JSON.stringify(record.stateDelta) : null,
    stage_before: record.stageBefore,
    stage_after: record.stageAfter,
    latency_ms: record.latencyMs,
    token_usage: record.tokenUsage !== null ? JSON.stringify(record.tokenUsage) : null,
    timestamp: record.timestamp,
  };
}

function fromDb(row: DbRow): RuntimeTurnRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    round: row.round,
    speakerId: row.speaker_id,
    speakerName: row.speaker_name,
    prompt: row.prompt,
    rawLlmResponse: row.raw_llm_response,
    parsedOutput: row.parsed_output !== null ? JSON.parse(row.parsed_output) : null,
    validationResult: row.validation_result,
    validationErrors: JSON.parse(row.validation_errors),
    stateDelta: row.state_delta !== null ? JSON.parse(row.state_delta) : null,
    stageBefore: row.stage_before,
    stageAfter: row.stage_after,
    latencyMs: row.latency_ms,
    tokenUsage: row.token_usage !== null ? JSON.parse(row.token_usage) : null,
    timestamp: row.timestamp,
  };
}

export class RuntimeStatsRepository {
  private db: Database.Database;
  private insertStmt: Database.Statement;

  constructor(db?: Database.Database) {
    this.db = db ?? getDatabase();
    this.insertStmt = this.db.prepare(`
      INSERT INTO runtime_turn_records
        (id, session_id, round, speaker_id, speaker_name, prompt,
         raw_llm_response, parsed_output, validation_result, validation_errors,
         state_delta, stage_before, stage_after, latency_ms, token_usage, timestamp)
      VALUES
        (@id, @session_id, @round, @speaker_id, @speaker_name, @prompt,
         @raw_llm_response, @parsed_output, @validation_result, @validation_errors,
         @state_delta, @stage_before, @stage_after, @latency_ms, @token_usage, @timestamp)
    `);
  }

  insert(record: RuntimeTurnRecord): void {
    this.insertStmt.run(toDb(record));
  }

  listRecent(limit: number, sessionId?: string): RuntimeTurnRecord[] {
    if (sessionId) {
      const rows = this.db.prepare(`
        SELECT * FROM runtime_turn_records
        WHERE session_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(sessionId, limit) as DbRow[];
      return rows.map(fromDb);
    }
    const rows = this.db.prepare(`
      SELECT * FROM runtime_turn_records
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit) as DbRow[];
    return rows.map(fromDb);
  }

  findBySession(sessionId: string): RuntimeTurnRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM runtime_turn_records
      WHERE session_id = ?
      ORDER BY round DESC
    `).all(sessionId) as DbRow[];
    return rows.map(fromDb);
  }

  getAggregates(sessionId?: string): RuntimeStatsAggregate {
    const where = sessionId ? "WHERE session_id = ?" : "";
    const params: string[] = sessionId ? [sessionId] : [];

    const row = this.db.prepare(`
      SELECT
        COUNT(*)                                              AS total_turns,
        COUNT(DISTINCT session_id)                            AS total_sessions,
        COALESCE(ROUND(AVG(latency_ms)), 0)                   AS avg_latency_ms,
        COALESCE(MAX(latency_ms), 0)                          AS max_latency_ms,
        COALESCE(MIN(latency_ms), 0)                          AS min_latency_ms,
        COALESCE(SUM(json_extract(token_usage, '$.promptTokens')), 0)     AS total_prompt_tokens,
        COALESCE(SUM(json_extract(token_usage, '$.completionTokens')), 0) AS total_completion_tokens,
        COUNT(*) FILTER (WHERE validation_result = 'passed')  AS validation_pass_count,
        COUNT(*) FILTER (WHERE validation_result = 'failed')  AS validation_fail_count,
        COUNT(*) FILTER (WHERE stage_before != stage_after)   AS stage_changes
      FROM runtime_turn_records
      ${where}
    `).get(...params) as AggregateQueryResult;

    const speakers = this.db.prepare(`
      SELECT DISTINCT speaker_id FROM runtime_turn_records ${where}
    `).all(...params) as { speaker_id: string }[];

    return {
      totalTurns: row.total_turns,
      totalSessions: row.total_sessions,
      avgLatencyMs: row.avg_latency_ms,
      maxLatencyMs: row.max_latency_ms,
      minLatencyMs: row.min_latency_ms,
      totalPromptTokens: row.total_prompt_tokens,
      totalCompletionTokens: row.total_completion_tokens,
      avgPromptTokens: safeDiv(row.total_prompt_tokens, row.total_turns),
      avgCompletionTokens: safeDiv(row.total_completion_tokens, row.total_turns),
      validationPassCount: row.validation_pass_count,
      validationFailCount: row.validation_fail_count,
      stageChanges: row.stage_changes,
      activeSpeakers: speakers.map((s) => s.speaker_id),
    };
  }

  count(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM runtime_turn_records`).get() as { count: number };
    return row.count;
  }

  listSessionSummaries(): SessionSummary[] {
    const rows = this.db.prepare(`
      SELECT
        session_id,
        MIN(timestamp) AS started_at,
        COUNT(*) AS turn_count,
        GROUP_CONCAT(DISTINCT speaker_name) AS speakers
      FROM runtime_turn_records
      GROUP BY session_id
      ORDER BY started_at DESC
    `).all() as { session_id: string; started_at: string; turn_count: number; speakers: string }[];
    return rows.map((r) => ({
      sessionId: r.session_id,
      startedAt: r.started_at,
      turnCount: r.turn_count,
      speakers: r.speakers,
    }));
  }

  deleteAll(): void {
    this.db.exec(`DELETE FROM runtime_turn_records`);
  }
}

interface SessionSummary {
  sessionId: string;
  startedAt: string;
  turnCount: number;
  speakers: string;
}

function safeDiv(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round(numerator / denominator);
}
