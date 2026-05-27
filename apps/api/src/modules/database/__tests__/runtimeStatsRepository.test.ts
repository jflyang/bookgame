import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../migrations.js";
import { RuntimeStatsRepository } from "../runtimeStatsRepository.js";
import type { RuntimeTurnRecord } from "@story-game/shared";

function makeRecord(overrides: Partial<RuntimeTurnRecord> = {}): RuntimeTurnRecord {
  return {
    id: "rt_test001",
    sessionId: "session_abc",
    round: 1,
    speakerId: "qiaofeng",
    speakerName: "乔峰",
    prompt: "test prompt",
    rawLlmResponse: '{"speakerId":"qiaofeng"}',
    parsedOutput: { speakerId: "qiaofeng", narration: "test", dialogue: "test", action: { type: "observe", targetIds: [] } },
    validationResult: "passed",
    validationErrors: [],
    stateDelta: { "qiaofeng.mp": -20, "dingchunqiu.hp": -35 },
    stageBefore: "origin",
    stageAfter: "encounter",
    latencyMs: 856,
    tokenUsage: { promptTokens: 3200, completionTokens: 450 },
    timestamp: "2026-05-27T10:00:00.000Z",
    ...overrides,
  };
}

describe("RuntimeStatsRepository", () => {
  let db: Database.Database;
  let repo: RuntimeStatsRepository;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    repo = new RuntimeStatsRepository(db);
  });

  it("inserts and counts records", () => {
    expect(repo.count()).toBe(0);
    repo.insert(makeRecord({ id: "rt_1" }));
    expect(repo.count()).toBe(1);
  });

  it("lists recent records ordered by timestamp desc", () => {
    repo.insert(makeRecord({ id: "rt_1", timestamp: "2026-05-27T10:00:00.000Z" }));
    repo.insert(makeRecord({ id: "rt_2", timestamp: "2026-05-27T11:00:00.000Z" }));
    const records = repo.listRecent(50);
    expect(records).toHaveLength(2);
    expect(records[0].id).toBe("rt_2"); // newer first
    expect(records[1].id).toBe("rt_1");
  });

  it("filters listRecent by sessionId", () => {
    repo.insert(makeRecord({ id: "rt_1", sessionId: "session_a" }));
    repo.insert(makeRecord({ id: "rt_2", sessionId: "session_b" }));
    const records = repo.listRecent(50, "session_a");
    expect(records).toHaveLength(1);
    expect(records[0].sessionId).toBe("session_a");
  });

  it("respects limit in listRecent", () => {
    for (let i = 0; i < 10; i++) {
      repo.insert(makeRecord({ id: `rt_${i}`, timestamp: `2026-05-27T0${i}:00:00.000Z` }));
    }
    expect(repo.listRecent(3)).toHaveLength(3);
  });

  it("findBySession returns records ordered by round desc", () => {
    repo.insert(makeRecord({ id: "rt_1", sessionId: "s1", round: 1 }));
    repo.insert(makeRecord({ id: "rt_2", sessionId: "s1", round: 2 }));
    repo.insert(makeRecord({ id: "rt_3", sessionId: "s2", round: 1 }));
    const records = repo.findBySession("s1");
    expect(records).toHaveLength(2);
    expect(records[0].round).toBe(2);
  });

  it("getAggregates computes correct stats", () => {
    repo.insert(makeRecord({
      id: "rt_1", sessionId: "s1", round: 1, validationResult: "passed",
      latencyMs: 800, tokenUsage: { promptTokens: 1000, completionTokens: 200 },
      stageBefore: "origin", stageAfter: "origin",
    }));
    repo.insert(makeRecord({
      id: "rt_2", sessionId: "s1", round: 2, validationResult: "passed",
      latencyMs: 1200, tokenUsage: { promptTokens: 2000, completionTokens: 300 },
      stageBefore: "origin", stageAfter: "encounter",
    }));
    repo.insert(makeRecord({
      id: "rt_3", sessionId: "s2", round: 1, validationResult: "failed",
      latencyMs: 500, tokenUsage: null,
      stageBefore: "origin", stageAfter: "origin",
    }));

    const agg = repo.getAggregates();
    expect(agg.totalTurns).toBe(3);
    expect(agg.totalSessions).toBe(2);
    expect(agg.avgLatencyMs).toBe(833); // (800+1200+500)/3 ≈ 833
    expect(agg.maxLatencyMs).toBe(1200);
    expect(agg.minLatencyMs).toBe(500);
    expect(agg.totalPromptTokens).toBe(3000);
    expect(agg.totalCompletionTokens).toBe(500);
    expect(agg.validationPassCount).toBe(2);
    expect(agg.validationFailCount).toBe(1);
    expect(agg.stageChanges).toBe(1);
    expect(agg.activeSpeakers).toEqual(["qiaofeng"]);
  });

  it("getAggregates filters by sessionId", () => {
    repo.insert(makeRecord({ id: "rt_1", sessionId: "s1" }));
    repo.insert(makeRecord({ id: "rt_2", sessionId: "s2" }));
    const agg = repo.getAggregates("s1");
    expect(agg.totalTurns).toBe(1);
    expect(agg.totalSessions).toBe(1);
  });

  it("getAggregates handles empty dataset", () => {
    const agg = repo.getAggregates();
    expect(agg.totalTurns).toBe(0);
    expect(agg.totalSessions).toBe(0);
    expect(agg.avgLatencyMs).toBe(0);
  });

  it("deleteAll clears all records", () => {
    repo.insert(makeRecord({ id: "rt_1" }));
    repo.insert(makeRecord({ id: "rt_2" }));
    expect(repo.count()).toBe(2);
    repo.deleteAll();
    expect(repo.count()).toBe(0);
  });

  it("serializes and deserializes JSON fields correctly", () => {
    const stateDelta = { "xuzhu.mp": -20, "dingchunqiu.hp": -35 };
    repo.insert(makeRecord({ id: "rt_json", stateDelta }));

    const records = repo.listRecent(1);
    expect(records[0].stateDelta).toEqual(stateDelta);
  });

  it("handles null tokenUsage", () => {
    repo.insert(makeRecord({ id: "rt_null", tokenUsage: null }));
    const records = repo.listRecent(1);
    expect(records[0].tokenUsage).toBeNull();
  });

  it("handles null parsedOutput", () => {
    repo.insert(makeRecord({ id: "rt_fail", parsedOutput: null, validationResult: "failed" }));
    const records = repo.listRecent(1);
    expect(records[0].parsedOutput).toBeNull();
    expect(records[0].validationResult).toBe("failed");
  });

  it("listSessionSummaries groups by session", () => {
    repo.insert(makeRecord({ id: "rt_1", sessionId: "s1", round: 1, speakerName: "乔峰", timestamp: "2026-05-27T10:00:00.000Z" }));
    repo.insert(makeRecord({ id: "rt_2", sessionId: "s1", round: 2, speakerName: "虚竹", timestamp: "2026-05-27T10:01:00.000Z" }));
    repo.insert(makeRecord({ id: "rt_3", sessionId: "s2", round: 1, speakerName: "段誉", timestamp: "2026-05-27T11:00:00.000Z" }));

    const summaries = repo.listSessionSummaries();
    expect(summaries).toHaveLength(2);

    const s1 = summaries.find(s => s.sessionId === "s1")!;
    expect(s1.turnCount).toBe(2);
    expect(s1.startedAt).toBe("2026-05-27T10:00:00.000Z");
    expect(s1.speakers).toContain("乔峰");
    expect(s1.speakers).toContain("虚竹");

    const s2 = summaries.find(s => s.sessionId === "s2")!;
    expect(s2.turnCount).toBe(1);
  });
});
