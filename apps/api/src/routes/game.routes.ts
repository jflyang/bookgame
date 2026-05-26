import type { FastifyInstance } from "fastify";
import {
  createSessionRequestSchema,
  scenarioSchema,
  sendMessageRequestSchema
} from "@story-game/shared";
import { gameApplicationService } from "../modules/container.js";

export async function gameRoutes(app: FastifyInstance) {
  app.post("/sessions", async (request, reply) => {
    const input = createSessionRequestSchema.parse(request.body ?? {});
    const result = gameApplicationService.createSession(input);
    return reply.code(201).send(result);
  });

  app.get("/sessions/:id/state", async (request, reply) => {
    const { id } = request.params as { id: string };
    return reply.send(gameApplicationService.getSessionState(id));
  });

  app.get("/sessions/:id/messages", async (request, reply) => {
    const { id } = request.params as { id: string };
    return reply.send(gameApplicationService.getMessages(id));
  });

  app.post("/sessions/:id/messages", async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = sendMessageRequestSchema.parse(request.body);
    return reply.send(await gameApplicationService.sendMessage(id, input));
  });

  app.put("/sessions/:id/scenario", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scenario = scenarioSchema.parse(request.body);
    return reply.send(gameApplicationService.updateScenario(id, scenario));
  });

  app.post("/sessions/:id/messages/stream", async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = sendMessageRequestSchema.parse(request.body);

    const raw = reply.raw;
    raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });

    let closed = false;
    raw.on("close", () => { closed = true; });

    try {
      for await (const event of gameApplicationService.sendMessageStream(id, input)) {
        if (closed) break;
        raw.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      if (!closed) {
        const message = err instanceof Error ? err.message : "Unknown error";
        raw.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
      }
    }

    raw.end();
    return reply.hijack();
  });

  app.post("/sessions/restore", async (request, reply) => {
    const { storyPackageId, saveId } = request.body as { storyPackageId: string; saveId: string };
    const result = gameApplicationService.restoreSession(storyPackageId, saveId);
    return reply.send(result);
  });
}
