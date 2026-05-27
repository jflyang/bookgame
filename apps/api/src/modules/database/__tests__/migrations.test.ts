import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../migrations.js";

describe("migrations", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
  });

  it("creates _schema_version table", () => {
    runMigrations(db);
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='_schema_version'"
      )
      .get() as { name: string } | undefined;
    expect(tables).toBeDefined();
    expect(tables!.name).toBe("_schema_version");
  });

  it("applies all three versioned migrations", () => {
    runMigrations(db);
    const rows = db
      .prepare("SELECT version FROM _schema_version ORDER BY version")
      .all() as { version: number }[];
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.version)).toEqual([1, 2, 3]);
  });

  it("creates runtime_turn_records table with expected schema", () => {
    runMigrations(db);
    const cols = db
      .prepare("PRAGMA table_info(runtime_turn_records)")
      .all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("id");
    expect(names).toContain("session_id");
    expect(names).toContain("latency_ms");
    expect(names).toContain("validation_result");
  });

  it("creates sessions table with expected columns", () => {
    runMigrations(db);
    const cols = db
      .prepare("PRAGMA table_info(sessions)")
      .all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("story_package_id");
    expect(names).toContain("status");
    expect(names).toContain("round");
  });

  it("creates audit_logs table", () => {
    runMigrations(db);
    const cols = db
      .prepare("PRAGMA table_info(audit_logs)")
      .all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("type");
    expect(names).toContain("session_id");
    expect(names).toContain("summary");
  });

  it("is idempotent -- running twice does not duplicate versions", () => {
    runMigrations(db);
    runMigrations(db);
    const rows = db
      .prepare("SELECT version FROM _schema_version ORDER BY version")
      .all() as { version: number }[];
    expect(rows).toHaveLength(3);
  });
});
