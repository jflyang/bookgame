import { Readable } from "node:stream";
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
  createReadStream: vi.fn(),
}));

vi.mock("node:fs", () => mockFs);

const mockRepo = vi.hoisted(() => ({
  packageDir: vi.fn().mockReturnValue("/mock/packages/testPkg"),
}));

vi.mock("../../modules/container.js", () => ({
  taskPackageRepository: mockRepo,
}));

import Fastify from "fastify";
import { storyAssetsRoutes } from "../storyAssets.routes.js";

describe("story assets routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });
    await app.register(storyAssetsRoutes, { prefix: "/api" });
    await app.ready();
  });

  it("returns 404 when asset file does not exist", async () => {
    mockFs.existsSync.mockReturnValue(false);
    const res = await app.inject({
      method: "GET", url: "/api/story-assets/testPkg/manifest",
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.payload)).toEqual({ error: "Asset not found" });
    expect(mockRepo.packageDir).toHaveBeenCalledWith("testPkg");
  });

  it("returns 404 when path is a directory", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.statSync.mockReturnValue({ isFile: () => false } as any);
    const res = await app.inject({
      method: "GET", url: "/api/story-assets/testPkg/subdir",
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 200 with correct content type for existing asset", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.statSync.mockReturnValue({ isFile: () => true } as any);
    mockFs.createReadStream.mockReturnValue(Readable.from(Buffer.from("test")));

    const res = await app.inject({
      method: "GET", url: "/api/story-assets/testPkg/audio/bgm.mp3",
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("audio/mpeg");
    expect(res.headers["cache-control"]).toBe("public, max-age=3600");
  });

  it("rejects invalid package ID", async () => {
    const res = await app.inject({
      method: "GET", url: "/api/story-assets/%2E%2E%2F/evil.exe",
    });
    expect(res.statusCode).toBe(500);
  });
});
