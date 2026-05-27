import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock container BEFORE importing routes
const mockServices = vi.hoisted(() => ({
  adminApplicationService: {
    listStoryPackages: vi.fn().mockReturnValue({ storyPackages: [] }),
    createStoryPackage: vi.fn().mockReturnValue({ storyPackage: { id: "new" }, storyPackages: [] }),
    updateStoryPackage: vi.fn().mockReturnValue({ storyPackage: { id: "p1" }, storyPackages: [] }),
    deleteStoryPackage: vi.fn().mockReturnValue({ storyPackages: [] }),
    exportStoryPackage: vi.fn().mockReturnValue({ buffer: Buffer.from("zip"), filename: "test.zip" }),
    getLlmConfig: vi.fn().mockReturnValue({ llmConfig: { provider: "mock", hasApiKey: false } }),
    updateLlmConfig: vi.fn().mockReturnValue({ llmConfig: { provider: "deepseek", hasApiKey: true } }),
    testLlmConnection: vi.fn().mockResolvedValue({ ok: true, latency: 100 }),
    getMedia: vi.fn().mockReturnValue(null),
    updateThumbnail: vi.fn().mockReturnValue({ thumbnail: "/api/admin/media/p1" }),
    deleteThumbnail: vi.fn().mockReturnValue({ ok: true }),
    updateCharacter: vi.fn(),
    getCharacters: vi.fn().mockReturnValue({ characters: [] }),
    importStoryPackage: vi.fn(),
    listSaves: vi.fn().mockReturnValue({ saves: [] }),
    getSave: vi.fn(),
    saveCurrentSession: vi.fn(),
    deleteSave: vi.fn(),
    listAuditLog: vi.fn().mockReturnValue({ entries: [] }),
  },
  runtimeStatsCollector: {
    listRecent: vi.fn().mockReturnValue([]),
    getAggregates: vi.fn().mockReturnValue({}),
    listSessionSummaries: vi.fn().mockReturnValue([]),
    findBySession: vi.fn().mockReturnValue([]),
    clear: vi.fn(),
  },
  sessionRepository: {
    listAll: vi.fn().mockReturnValue([]),
    getById: vi.fn().mockReturnValue(null),
    deleteAll: vi.fn(),
    findByPackage: vi.fn().mockReturnValue([]),
    findByStatus: vi.fn().mockReturnValue([]),
  },
  gameStateService: {
    get: vi.fn(),
  },
  memoryService: {
    list: vi.fn().mockReturnValue([]),
  },
  sessionCollector: {
    listAll: vi.fn().mockReturnValue([]),
    getById: vi.fn().mockReturnValue(null),
    deleteAll: vi.fn(),
    create: vi.fn(),
    markActive: vi.fn(),
    restore: vi.fn(),
  },
}));

vi.mock("../../modules/container.js", () => ({
  adminApplicationService: mockServices.adminApplicationService,
  runtimeStatsCollector: mockServices.runtimeStatsCollector,
  sessionCollector: mockServices.sessionCollector,
  sessionRepository: mockServices.sessionRepository,
  gameStateService: mockServices.gameStateService,
  memoryService: mockServices.memoryService,
}));

vi.mock("../../modules/runtime-stats/runtimeStatsRoutes.js", () => ({
  registerRuntimeStatsRoutes: vi.fn(),
}));

vi.mock("../../modules/sessions/sessionRoutes.js", () => ({
  registerSessionRoutes: vi.fn(),
}));

import Fastify from "fastify";
import { adminRoutes } from "../admin.routes.js";

describe("admin routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });
    await app.register(adminRoutes, { prefix: "/api/admin" });
    await app.ready();
  });

  it("GET /story-packages returns list", async () => {
    mockServices.adminApplicationService.listStoryPackages.mockReturnValue({ storyPackages: [{ id: "p1", title: "A" }] });
    const res = await app.inject({ method: "GET", url: "/api/admin/story-packages" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).storyPackages).toHaveLength(1);
  });

  it("POST /story-packages creates a package", async () => {
    mockServices.adminApplicationService.createStoryPackage.mockReturnValue({
      storyPackage: { id: "new_pkg" }, storyPackages: [{ id: "new_pkg" }],
    });
    const res = await app.inject({
      method: "POST", url: "/api/admin/story-packages",
      payload: { title: "New" }, headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(201);
  });

  it("GET /llm-config returns config view", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/llm-config" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).llmConfig.provider).toBe("mock");
  });

  it("POST /llm-config/test returns test result", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/admin/llm-config/test",
      payload: { provider: "deepseek", baseUrl: "https://api.deepseek.com", model: "v4", temperature: 0.8, maxTokens: 800 },
      headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("DELETE /story-packages/:id deletes", async () => {
    mockServices.adminApplicationService.deleteStoryPackage.mockReturnValue({ storyPackages: [] });
    const res = await app.inject({ method: "DELETE", url: "/api/admin/story-packages/p1" });
    expect(res.statusCode).toBe(200);
  });

  it("GET /media/:id returns 404 when not found", async () => {
    mockServices.adminApplicationService.getMedia.mockReturnValue(null);
    const res = await app.inject({ method: "GET", url: "/api/admin/media/unknown" });
    expect(res.statusCode).toBe(404);
  });

  it("GET /audit-log returns entries", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/audit-log" });
    expect(res.statusCode).toBe(200);
  });
});
