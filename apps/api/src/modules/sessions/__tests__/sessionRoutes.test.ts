import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import { registerSessionRoutes } from "../sessionRoutes.js";

const mockSession = {
  id: "sess_001",
  storyPackageId: "pkg_1",
  storyPackageTitle: "测试故事",
  round: 5,
  status: "active" as const,
  currentStage: "climax",
  characterStates: [],
  messageCount: 12,
  createdAt: "2026-05-27T00:00:00Z",
  updatedAt: "2026-05-27T01:00:00Z",
};

function createMocks() {
  return {
    repo: {
      listAll: vi.fn().mockReturnValue([]),
      findByPackage: vi.fn().mockReturnValue([]),
      findByStatus: vi.fn().mockReturnValue([]),
      getById: vi.fn().mockReturnValue(null),
      deleteAll: vi.fn(),
    },
    gameStateService: {
      get: vi.fn().mockReturnValue(null),
    },
    memoryService: {
      list: vi.fn().mockReturnValue([]),
    },
  };
}

describe("session routes", () => {
  let app: ReturnType<typeof Fastify>;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks = createMocks();
    app = Fastify({ logger: false });
    registerSessionRoutes(
      app,
      mocks.repo as any,
      mocks.gameStateService as any,
      mocks.memoryService as any
    );
    await app.ready();
  });

  it("GET /sessions returns session list", async () => {
    mocks.repo.listAll.mockReturnValue([mockSession]);
    const res = await app.inject({ method: "GET", url: "/sessions" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual({ sessions: [mockSession] });
  });

  it("GET /sessions filters by storyPackageId", async () => {
    mocks.repo.findByPackage.mockReturnValue([mockSession]);
    const res = await app.inject({
      method: "GET",
      url: "/sessions?storyPackageId=pkg_1",
    });
    expect(res.statusCode).toBe(200);
    expect(mocks.repo.findByPackage).toHaveBeenCalledWith("pkg_1", undefined);
  });

  it("GET /sessions filters by status", async () => {
    mocks.repo.findByStatus.mockReturnValue([mockSession]);
    const res = await app.inject({
      method: "GET",
      url: "/sessions?status=active",
    });
    expect(res.statusCode).toBe(200);
    expect(mocks.repo.findByStatus).toHaveBeenCalledWith("active", undefined);
  });

  it("GET /sessions/:id returns 404 when session not found", async () => {
    mocks.repo.getById.mockReturnValue(null);
    const res = await app.inject({
      method: "GET",
      url: "/sessions/nonexistent",
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.payload)).toEqual({ error: "Session not found" });
  });

  it("GET /sessions/:id returns session detail with game state and messages", async () => {
    mocks.repo.getById.mockReturnValue(mockSession);
    mocks.gameStateService.get.mockReturnValue({
      sessionId: "sess_001",
      round: 5,
      status: "active",
    });
    mocks.memoryService.list.mockReturnValue([{ id: "msg_1", content: "Hi" }]);

    const res = await app.inject({
      method: "GET",
      url: "/sessions/sess_001",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.session).toEqual(mockSession);
    expect(body.gameState).toBeDefined();
    expect(body.messages).toHaveLength(1);
  });

  it("DELETE /sessions clears all sessions", async () => {
    const res = await app.inject({ method: "DELETE", url: "/sessions" });
    expect(res.statusCode).toBe(200);
    expect(mocks.repo.deleteAll).toHaveBeenCalled();
    expect(JSON.parse(res.payload)).toEqual({ ok: true });
  });
});
