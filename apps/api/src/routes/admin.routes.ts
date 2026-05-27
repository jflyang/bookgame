import type { FastifyInstance } from "fastify";
import {
  createStoryPackageRequestSchema,
  updateLlmConfigRequestSchema,
  updateCharacterRequestSchema,
  updateStoryPackageRequestSchema
} from "@story-game/shared";
import { adminApplicationService, runtimeStatsCollector, sessionCollector, sessionRepository } from "../modules/container.js";
import { registerRuntimeStatsRoutes } from "../modules/runtime-stats/runtimeStatsRoutes.js";
import { registerSessionRoutes } from "../modules/sessions/sessionRoutes.js";
import { gameStateService, memoryService } from "../modules/container.js";

export async function adminRoutes(app: FastifyInstance) {
  app.get("/story-packages/:id/export", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { buffer, filename } = adminApplicationService.exportStoryPackage(id);
    reply.header("Content-Type", "application/zip");
    reply.header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return reply.send(buffer);
  });

  app.get("/characters", async (_request, reply) => {
    return reply.send(adminApplicationService.getCharacters());
  });

  app.put("/characters/:id", async (request, reply) => {
    const input = updateCharacterRequestSchema.parse(request.body);
    return reply.send(adminApplicationService.updateCharacter(input));
  });

  app.get("/story-packages", async (request, reply) => {
    const { includeHidden } = request.query as { includeHidden?: string };
    return reply.send(adminApplicationService.listStoryPackages(includeHidden === "true"));
  });

  app.post("/story-packages", async (request, reply) => {
    const input = createStoryPackageRequestSchema.parse(request.body);
    return reply.code(201).send(adminApplicationService.createStoryPackage(input.title, input.sourcePackageId));
  });

  app.post("/story-packages/import", async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.code(400).send({ error: "No file uploaded" });
    const buffer = await data.toBuffer();
    const title = (request.query as Record<string, string>).title;
    return reply.code(201).send(adminApplicationService.importStoryPackage(buffer, title));
  });

  app.put("/story-packages/:id", async (request, reply) => {
    const input = updateStoryPackageRequestSchema.parse(request.body);
    return reply.send(adminApplicationService.updateStoryPackage(input));
  });

  app.delete("/story-packages/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    return reply.send(adminApplicationService.deleteStoryPackage(id));
  });

  app.get("/llm-config", async (_request, reply) => {
    return reply.send(adminApplicationService.getLlmConfig());
  });

  app.put("/llm-config", async (request, reply) => {
    const input = updateLlmConfigRequestSchema.parse(request.body);
    return reply.send(adminApplicationService.updateLlmConfig(input));
  });

  app.post("/llm-config/test", async (request, reply) => {
    const input = updateLlmConfigRequestSchema.parse(request.body);
    const result = await adminApplicationService.testLlmConnection(input);
    return reply.send(result);
  });

  app.post("/story-packages/:id/thumbnail", async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await request.file();
    if (!data) return reply.code(400).send({ error: "No file uploaded" });
    const buffer = await data.toBuffer();
    return reply.send(adminApplicationService.updateThumbnail(id, buffer, data.filename));
  });

  app.get("/media/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const media = adminApplicationService.getMedia(id);
    if (!media) return reply.code(404).send({ error: "Not found" });
    reply.header("Content-Type", media.mime);
    reply.header("Cache-Control", "no-cache");
    return reply.send(media.stream);
  });

  app.delete("/story-packages/:id/thumbnail", async (request, reply) => {
    const { id } = request.params as { id: string };
    return reply.send(adminApplicationService.deleteThumbnail(id));
  });

  app.post("/story-packages/:id/performance-audio", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { performanceId } = request.query as { performanceId?: string };
    if (!performanceId) return reply.code(400).send({ error: "performanceId is required" });
    const data = await request.file();
    if (!data) return reply.code(400).send({ error: "No file uploaded" });
    const buffer = await data.toBuffer();
    return reply.send(adminApplicationService.uploadPerformanceAudio(id, performanceId, buffer, data.filename));
  });

  app.post("/story-packages/:id/performance-image", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { performanceId } = request.query as { performanceId?: string };
    if (!performanceId) return reply.code(400).send({ error: "performanceId is required" });
    const data = await request.file();
    if (!data) return reply.code(400).send({ error: "No file uploaded" });
    const buffer = await data.toBuffer();
    return reply.send(adminApplicationService.uploadPerformanceImage(id, performanceId, buffer, data.filename));
  });

  // Session saves -- nested under story-packages
  app.get("/story-packages/:pkgId/saves", async (request, reply) => {
    const { pkgId } = request.params as { pkgId: string };
    return reply.send(adminApplicationService.listSaves(pkgId));
  });

  app.get("/story-packages/:pkgId/saves/:saveId", async (request, reply) => {
    const { pkgId, saveId } = request.params as { pkgId: string; saveId: string };
    return reply.send(adminApplicationService.getSave(pkgId, saveId));
  });

  app.post("/story-packages/:pkgId/saves", async (request, reply) => {
    const { pkgId } = request.params as { pkgId: string };
    const { sessionId, label } = request.body as { sessionId: string; label: string };
    return reply.code(201).send(adminApplicationService.saveCurrentSession(pkgId, sessionId, label));
  });

  app.delete("/story-packages/:pkgId/saves/:saveId", async (request, reply) => {
    const { pkgId, saveId } = request.params as { pkgId: string; saveId: string };
    return reply.send(adminApplicationService.deleteSave(pkgId, saveId));
  });

  app.get("/audit-log", async (request, reply) => {
    const { type, sessionId } = request.query as { type?: string; sessionId?: string };
    return reply.send(adminApplicationService.listAuditLog(type, sessionId));
  });

  registerRuntimeStatsRoutes(app, runtimeStatsCollector);
  registerSessionRoutes(app, sessionRepository, gameStateService, memoryService);
}
