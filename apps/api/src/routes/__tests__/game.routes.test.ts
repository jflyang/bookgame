import { describe, it, expect, beforeEach, vi } from "vitest";

const mockServices = vi.hoisted(() => ({
  gameApplicationService: {
    createSession: vi.fn(),
    getSessionState: vi.fn(),
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
    sendMessageStream: vi.fn(),
    restoreSession: vi.fn(),
    updateScenario: vi.fn(),
  },
}));

vi.mock("../../modules/container.js", () => ({
  gameApplicationService: mockServices.gameApplicationService,
}));

import Fastify from "fastify";
import { gameRoutes } from "../game.routes.js";

describe("game routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });
    await app.register(gameRoutes, { prefix: "/api/game" });
    await app.ready();
  });

  it("POST /sessions creates session", async () => {
    mockServices.gameApplicationService.createSession.mockReturnValue({
      sessionId: "sess_1", gameState: { sessionId: "sess_1", round: 0, status: "active" },
      characters: [], skills: [], knowledgeDocuments: [],
    });
    const res = await app.inject({
      method: "POST", url: "/api/game/sessions",
      payload: { storyPackageId: "pkg1" },
      headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.payload).sessionId).toBe("sess_1");
  });

  it("GET /sessions/:id/state returns game state", async () => {
    mockServices.gameApplicationService.getSessionState.mockReturnValue({
      gameState: { sessionId: "sess_1", round: 5, status: "active" },
      characters: [], skills: [], knowledgeDocuments: [],
    });
    const res = await app.inject({ method: "GET", url: "/api/game/sessions/sess_1/state" });
    expect(res.statusCode).toBe(200);
  });

  it("GET /sessions/:id/messages returns messages", async () => {
    mockServices.gameApplicationService.getMessages.mockReturnValue({ messages: [] });
    const res = await app.inject({ method: "GET", url: "/api/game/sessions/sess_1/messages" });
    expect(res.statusCode).toBe(200);
  });

  it("POST /sessions/:id/messages sends message", async () => {
    mockServices.gameApplicationService.sendMessage.mockResolvedValue({
      message: { id: "msg_1", content: "Hi" }, gameState: {}, debug: {},
    });
    const res = await app.inject({
      method: "POST", url: "/api/game/sessions/sess_1/messages",
      payload: { text: "hello" },
      headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("POST /sessions/restore restores session", async () => {
    mockServices.gameApplicationService.restoreSession.mockReturnValue({
      sessionId: "sess_r", gameState: {}, messages: [],
      characters: [], skills: [], knowledgeDocuments: [],
    });
    const res = await app.inject({
      method: "POST", url: "/api/game/sessions/restore",
      payload: { storyPackageId: "pkg1", saveId: "save_1" },
      headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(200);
  });
});
