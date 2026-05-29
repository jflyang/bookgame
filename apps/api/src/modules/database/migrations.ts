import type Database from "better-sqlite3";

const MIGRATIONS: Array<{ version: number; sql: string[] }> = [
  {
    version: 1,
    sql: [
      `CREATE TABLE IF NOT EXISTS runtime_turn_records (
        id                  TEXT PRIMARY KEY,
        session_id          TEXT NOT NULL,
        round               INTEGER NOT NULL CHECK(round >= 0),
        speaker_id          TEXT NOT NULL,
        speaker_name        TEXT NOT NULL,
        prompt              TEXT NOT NULL,
        raw_llm_response    TEXT NOT NULL,
        parsed_output       TEXT,
        validation_result   TEXT NOT NULL CHECK(validation_result IN ('passed', 'failed')),
        validation_errors   TEXT NOT NULL DEFAULT '[]',
        state_delta         TEXT,
        stage_before        TEXT NOT NULL,
        stage_after         TEXT NOT NULL,
        latency_ms          INTEGER NOT NULL CHECK(latency_ms >= 0),
        token_usage         TEXT,
        timestamp           TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_rtr_session_timestamp
       ON runtime_turn_records(session_id, timestamp DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_rtr_session_round
       ON runtime_turn_records(session_id, round DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_rtr_validation
       ON runtime_turn_records(validation_result)`,
    ],
  },
  {
    version: 2,
    sql: [
      `CREATE TABLE IF NOT EXISTS sessions (
        id                    TEXT PRIMARY KEY,
        story_package_id      TEXT NOT NULL,
        story_package_title   TEXT NOT NULL DEFAULT '',
        round                 INTEGER NOT NULL DEFAULT 0,
        status                TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle','active','completed')),
        current_stage         TEXT NOT NULL DEFAULT '',
        character_states      TEXT NOT NULL DEFAULT '[]',
        message_count         INTEGER NOT NULL DEFAULT 0,
        created_at            TEXT NOT NULL,
        updated_at            TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_package ON sessions(story_package_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC)`,
    ],
  },
  {
    version: 3,
    sql: [
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id          TEXT PRIMARY KEY,
        timestamp   TEXT NOT NULL,
        type        TEXT NOT NULL CHECK(type IN ('llm_request','llm_response','validation_failed','state_change','session_created','session_completed')),
        session_id  TEXT,
        speaker_id  TEXT,
        summary     TEXT NOT NULL,
        details     TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_logs(type)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_logs(session_id)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC)`,
    ],
  },
  {
    version: 4,
    sql: [
      `CREATE TABLE IF NOT EXISTS session_live_state (
        session_id          TEXT PRIMARY KEY,
        story_package_id    TEXT NOT NULL,
        game_state          TEXT NOT NULL,
        messages            TEXT NOT NULL,
        updated_at          TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sls_updated ON session_live_state(updated_at DESC)`,
    ],
  },
];

export function runMigrations(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS _schema_version (version INTEGER PRIMARY KEY)`);
  const row = db.prepare(`SELECT MAX(version) as version FROM _schema_version`).get() as
    | { version: number | null }
    | undefined;
  const currentVersion = row?.version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      const runAll = db.transaction(() => {
        for (const sql of migration.sql) {
          db.exec(sql);
        }
        db.prepare(`INSERT INTO _schema_version (version) VALUES (?)`).run(migration.version);
      });
      runAll();
    }
  }
}
