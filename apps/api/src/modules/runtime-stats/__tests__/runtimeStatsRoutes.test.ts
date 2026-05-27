import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import { registerRuntimeStatsRoutes } from "../runtimeStatsRoutes.js";

const mockRecord = {
  id: "rt_test",
  sessionId: "sess_001",
  round: 1,
  speakerId: "qiaofeng",
  speakerName: "乔峰",
  prompt: "prompt text",
  rawLlmResponse: "response text",
  parsedOutput: null,
  validationResult: "passed" as const,
  validationErrors: [],
  stateDelta: null,
  stageBefore: "start",
  stageAfter: "start",
  latencyMs: 150,
  tokenUsage: { promptTokens: 100, completionTokens: 50 },
  timestamp: "2026-05-27T00:00:00Z",
};

const mockAggregates = {
  totalTurns: 10,
  totalSessions: 2,
  avgLatencyMs: 200,
  maxLatencyMs: 500,
  minLatencyMs: 50,
  totalPromptTokens: 1000,
  totalCompletionTokens: 500,
  avgPromptTokens: 100,
  avgCompletionTokens: 50,
  validationPassCount: 8,
  validationFailCount: 2,
  stageChanges: 3,
  activeSpeakers: ["qiaofeng"],
};

const mockSessionSummary = {
  sessionId: "sess_001",
  startedAt: "2026-05-27T00:00:00Z",
  turnCount: 5,
  speakers: "乔峰",
};

function createMockCollector() {
  return {
    listRecent: vi.fn().mockReturnValue([]),
    getAggregates: vi.fn().mockReturnValue(mockAggregates),
    listSessionSummaries: vi.fn().mockReturnValue([]),
    findBySession: vi.fn().mockReturnValue([]),
    clear: vi.fn(),
  };
}

describe("runtime stats routes", () => {
  let app: ReturnType<typeof Fastify>;
  let collector: ReturnType<typeof createMockCollector>;

  beforeEach(async () => {
    vi.clearAllMocks();
    collector = createMockCollector();
    app = Fastify({ logger: false });
    registerRuntimeStatsRoutes(app, collector as any);
    await app.ready();
  });

  it("GET /runtime-stats returns records", async () => {
    collector.listRecent.mockReturnValue([mockRecord]);
    const res = await app.inject({ method: "GET", url: "/runtime-stats" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual({ records: [mockRecord] });
    expect(collector.listRecent).toHaveBeenCalledWith(50, undefined);
  });

  it("GET /runtime-stats passes limit and sessionId query params", async () => {
    collector.listRecent.mockReturnValue([mockRecord]);
    await app.inject({
      method: "GET",
      url: "/runtime-stats?limit=10&sessionId=sess_001",
    });
    expect(collector.listRecent).toHaveBeenCalledWith(10, "sess_001");
  });

  it("GET /runtime-stats/aggregates returns aggregates", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/runtime-stats/aggregates",
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual({ aggregates: mockAggregates });
  });

  it("GET /runtime-stats/sessions returns session summaries", async () => {
    collector.listSessionSummaries.mockReturnValue([mockSessionSummary]);
    const res = await app.inject({
      method: "GET",
      url: "/runtime-stats/sessions",
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual({
      sessions: [mockSessionSummary],
    });
  });

  it("GET /runtime-stats/sessions/:sessionId returns session records", async () => {
    collector.findBySession.mockReturnValue([mockRecord]);
    const res = await app.inject({
      method: "GET",
      url: "/runtime-stats/sessions/sess_001",
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual({ records: [mockRecord] });
  });

  it("DELETE /runtime-stats clears collector", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/runtime-stats",
    });
    expect(res.statusCode).toBe(200);
    expect(collector.clear).toHaveBeenCalled();
    expect(JSON.parse(res.payload)).toEqual({ ok: true });
  });
});
