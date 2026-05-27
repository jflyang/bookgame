import { createReadStream, existsSync, statSync } from "node:fs";
import { extname } from "node:path";
import type { FastifyInstance } from "fastify";
import { taskPackageRepository } from "../modules/container.js";
import { assertSafeId, resolveInside } from "../data/pathGuards.js";

const MIME_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".css": "text/css",
};

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

export async function storyAssetsRoutes(app: FastifyInstance) {
  app.get("/story-assets/:packageId/*", async (request, reply) => {
    const { packageId } = request.params as { packageId: string };
    const wildcard = (request.params as Record<string, string>)["*"];

    assertSafeId(packageId);
    const packageDir = taskPackageRepository.packageDir(packageId);
    const filePath = resolveInside(packageDir, wildcard);

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      return reply.code(404).send({ error: "Asset not found" });
    }

    reply.header("Content-Type", getMimeType(filePath));
    reply.header("Cache-Control", "public, max-age=3600");
    return reply.send(createReadStream(filePath));
  });
}
