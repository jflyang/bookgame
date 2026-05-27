import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock repository – shared instance used by the mocked class constructor
// ---------------------------------------------------------------------------
const mockRepo = {
  insert: vi.fn(),
  listRecent: vi.fn().mockReturnValue([] as unknown[]),
  findBySession: vi.fn(),
  getAggregates: vi.fn(),
  listSessionSummaries: vi.fn(),
  deleteAll: vi.fn(),
  count: vi.fn().mockReturnValue(0),
};

vi.mock("../../database/runtimeStatsRepository.js", () => ({
  RuntimeStatsRepository: vi.fn(function () { return mockRepo; }),
}));

import { RuntimeStatsCollector } from "../runtimeStatsCollector.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTurnData(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: "sess_001",
    round: 1,
    speakerId: "qiaofeng",
    speakerName: "乔峰",
    prompt: "test prompt",
    rawLlmResponse: "test response",
    parsedOutput: null,
    validationResult: "passed" as const,
    validationErrors: [],
    stateDelta: null,
    stageBefore: "start",
    stageAfter: "start",
    latencyMs: 100,
    tokenUsage: { promptTokens: 100, completionTokens: 50 },
    timestamp: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("RuntimeStatsCollector", () => {
  let collector: RuntimeStatsCollector;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock repo listRecent to return empty (avoids cross-test pollution)
    mockRepo.listRecent.mockReturnValue([]);
    collector = new RuntimeStatsCollector();
  });

  // ── 1 ─────────────────────────────────────────────────────────────
  it("recordCompleteTurn inserts into repo and caches in-memory", () => {
    const data = makeTurnData();

    collector.recordCompleteTurn(data);

    // Repo.insert should have been called with a record containing the data plus an id
    expect(mockRepo.insert).toHaveBeenCalledTimes(1);
    const inserted = mockRepo.insert.mock.calls[0][0];
    expect(inserted.id).toMatch(/^rt_/); // nanoid prefix
    expect(inserted.sessionId).toBe("sess_001");
    expect(inserted.round).toBe(1);
    expect(inserted.speakerId).toBe("qiaofeng");
    expect(inserted.validationResult).toBe("passed");

    // Verify the record is in the internal cache
    const records = (collector as unknown as { records: unknown[] }).records;
    expect(records).toHaveLength(1);
    expect(records[0]).toBe(inserted);
  });

  // ── 2 ─────────────────────────────────────────────────────────────
  it("listRecent delegates to repo.listRecent", () => {
    const fakeRecords = [makeTurnData({ sessionId: "sess_002", round: 2 })];
    mockRepo.listRecent.mockReturnValue(fakeRecords);

    const result = collector.listRecent(10, "sess_002");

    expect(mockRepo.listRecent).toHaveBeenCalledWith(10, "sess_002");
    expect(result).toBe(fakeRecords);
  });

  // ── 3 ─────────────────────────────────────────────────────────────
  it("getAggregates delegates to repo.getAggregates", () => {
    const fakeAgg = {
      totalTurns: 10,
      totalSessions: 1,
      avgLatencyMs: 200,
      maxLatencyMs: 500,
      minLatencyMs: 50,
      totalPromptTokens: 1000,
      totalCompletionTokens: 500,
      avgPromptTokens: 100,
      avgCompletionTokens: 50,
      validationPassCount: 9,
      validationFailCount: 1,
      stageChanges: 2,
      activeSpeakers: ["qiaofeng"],
    };
    mockRepo.getAggregates.mockReturnValue(fakeAgg);

    const result = collector.getAggregates("sess_001");

    expect(mockRepo.getAggregates).toHaveBeenCalledWith("sess_001");
    expect(result).toBe(fakeAgg);
  });

  // ── 4 ─────────────────────────────────────────────────────────────
  it("listSessionSummaries delegates to repo.listSessionSummaries", () => {
    const fakeSummaries = [
      { sessionId: "sess_001", startedAt: "2026-01-01T00:00:00Z", turnCount: 5, speakers: "乔峰,虚竹" },
    ];
    mockRepo.listSessionSummaries.mockReturnValue(fakeSummaries);

    const result = collector.listSessionSummaries();

    expect(mockRepo.listSessionSummaries).toHaveBeenCalled();
    expect(result).toBe(fakeSummaries);
  });

  // ── 5 ─────────────────────────────────────────────────────────────
  it("findBySession delegates to repo.findBySession", () => {
    const fakeRecords = [makeTurnData({ sessionId: "sess_003" })];
    mockRepo.findBySession.mockReturnValue(fakeRecords);

    const result = collector.findBySession("sess_003");

    expect(mockRepo.findBySession).toHaveBeenCalledWith("sess_003");
    expect(result).toBe(fakeRecords);
  });

  // ── 6 ─────────────────────────────────────────────────────────────
  it("clear empties the in-memory cache and calls repo.deleteAll", () => {
    // Pre-populate cache
    collector.recordCompleteTurn(makeTurnData());
    collector.recordCompleteTurn(makeTurnData({ sessionId: "sess_002" }));
    expect((collector as unknown as { records: unknown[] }).records).toHaveLength(2);

    collector.clear();

    expect(mockRepo.deleteAll).toHaveBeenCalledTimes(1);
    expect((collector as unknown as { records: unknown[] }).records).toHaveLength(0);
  });

  // ── 7 ─────────────────────────────────────────────────────────────
  it("cache respects the maximum size of 1000 records", () => {
    // Insert 1001 records – the cache should trim to the last 1000
    const inserts = 1001;
    for (let i = 0; i < inserts; i++) {
      collector.recordCompleteTurn(makeTurnData({ sessionId: `sess_${i}`, round: i }));
    }

    expect(mockRepo.insert).toHaveBeenCalledTimes(1001);
    const records = (collector as unknown as { records: unknown[] }).records;
    expect(records).toHaveLength(1000);
    // The first record (index 0) should be sess_1 (because sess_0 was sliced off)
    expect((records[0] as { sessionId: string }).sessionId).toBe("sess_1");
    // The last record should be sess_1000
    expect((records[records.length - 1] as { sessionId: string }).sessionId).toBe("sess_1000");
  });

  // ── 8 ─────────────────────────────────────────────────────────────
  it("constructor loads recent records from repo into cache", () => {
    const existing = [
      makeTurnData({ sessionId: "sess_prev", round: 1 }),
      makeTurnData({ sessionId: "sess_prev", round: 2 }),
    ];
    mockRepo.listRecent.mockReturnValue(existing);

    const newCollector = new RuntimeStatsCollector();

    expect(mockRepo.listRecent).toHaveBeenCalledWith(1000);
    const records = (newCollector as unknown as { records: unknown[] }).records;
    expect(records).toEqual(existing);
  });

  // ── 9 ─────────────────────────────────────────────────────────────
  it("recordCompleteTurn handles nullable fields (parsedOutput, stateDelta)", () => {
    const dataWithNullables = makeTurnData({
      parsedOutput: null,
      stateDelta: null,
    });

    collector.recordCompleteTurn(dataWithNullables);

    const inserted = mockRepo.insert.mock.calls[0][0];
    expect(inserted.parsedOutput).toBeNull();
    expect(inserted.stateDelta).toBeNull();
  });
});
