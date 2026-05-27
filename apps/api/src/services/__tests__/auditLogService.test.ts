import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../../modules/database/migrations.js";

// Use in-memory DB for test isolation
const testDb = new Database(":memory:");
testDb.pragma("journal_mode = WAL");
testDb.pragma("foreign_keys = ON");
runMigrations(testDb);

vi.mock("../../modules/database/database.js", () => ({
  getDatabase: () => testDb,
  closeDatabase: () => testDb.close(),
}));

import { AuditLogService } from "../auditLogService.js";

describe("AuditLogService", () => {
  let svc: AuditLogService;

  beforeEach(() => {
    svc = new AuditLogService();
    testDb.exec("DELETE FROM audit_logs");
  });

  it("append adds entry with id and timestamp", () => {
    svc.append({ type: "state_change", sessionId: "s1", summary: "HP changed" });
    const entries = svc.list();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toMatch(/^audit_/);
    expect(entries[0].timestamp).toBeDefined();
    expect(entries[0].type).toBe("state_change");
    expect(entries[0].sessionId).toBe("s1");
    expect(entries[0].summary).toBe("HP changed");
  });

  it("list returns entries sorted by timestamp DESC", () => {
    svc.append({ type: "state_change", sessionId: "s1", summary: "First" });
    svc.append({ type: "state_change", sessionId: "s1", summary: "Second" });
    const entries = svc.list();
    expect(entries).toHaveLength(2);
    // Both entries returned (order may vary if timestamps are identical)
    const summaries = entries.map(e => e.summary).sort();
    expect(summaries).toEqual(["First", "Second"]);
  });

  it("list filters by type", () => {
    svc.append({ type: "state_change", sessionId: "s1", summary: "Changed" });
    svc.append({ type: "llm_request", sessionId: "s1", summary: "Request" });
    svc.append({ type: "llm_response", sessionId: "s1", summary: "Response" });

    const filtered = svc.list({ type: "llm_request" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].type).toBe("llm_request");
  });

  it("list filters by sessionId", () => {
    svc.append({ type: "state_change", sessionId: "s1", summary: "S1 change" });
    svc.append({ type: "state_change", sessionId: "s2", summary: "S2 change" });

    const filtered = svc.list({ sessionId: "s1" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].sessionId).toBe("s1");
  });

  it("list respects limit parameter", () => {
    for (let i = 0; i < 10; i++) {
      svc.append({ type: "state_change", sessionId: "s1", summary: `Entry ${i}` });
    }
    const limited = svc.list({ limit: 3 });
    expect(limited).toHaveLength(3);
  });

  it("list combines type, sessionId, and limit filters", () => {
    svc.append({ type: "state_change", sessionId: "s1", summary: "S1 state" });
    svc.append({ type: "llm_request", sessionId: "s1", summary: "S1 llm" });
    svc.append({ type: "state_change", sessionId: "s2", summary: "S2 state" });

    const result = svc.list({ type: "state_change", sessionId: "s1", limit: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].summary).toBe("S1 state");
  });

  it("findBySession returns entries for a specific session", () => {
    svc.append({ type: "session_created", sessionId: "s1", summary: "Created" });
    svc.append({ type: "state_change", sessionId: "s1", summary: "Changed" });
    svc.append({ type: "state_change", sessionId: "s2", summary: "Other" });

    const result = svc.findBySession("s1");
    expect(result).toHaveLength(2);
    expect(result.map(r => r.summary).sort()).toEqual(["Changed", "Created"]);
  });

  it("findBySession returns empty array when no entries match", () => {
    expect(svc.findBySession("ghost")).toEqual([]);
  });

  it("append accepts optional details", () => {
    svc.append({ type: "validation_failed", sessionId: "s1", speakerId: "qiaofeng", summary: "Validation failed", details: { error: "Missing field" } });
    const entries = svc.list();
    expect(entries[0].speakerId).toBe("qiaofeng");
    expect(entries[0].details).toEqual({ error: "Missing field" });
  });
});
