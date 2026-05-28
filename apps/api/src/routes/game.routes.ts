import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  choiceRequestSchema,
  createSessionRequestSchema,
  scenarioSchema,
  sendMessageRequestSchema
} from "@story-game/shared";
import { gameApplicationService } from "../modules/container.js";

export async function gameRoutes(app: FastifyInstance) {
  app.post("/sessions", async (request, reply) => {
    try {
      const input = createSessionRequestSchema.parse(request.body ?? {});
      const result = gameApplicationService.createSession(input);
      return reply.code(201).send(result);
    } catch (err) {
      if (err instanceof z.ZodError) return reply.code(400).send({ error: "请求参数无效" });
      const message = err instanceof Error ? err.message : "Unknown error";
      return reply.code(500).send({ error: message });
    }
  });

  app.get("/sessions/:id/state", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return reply.send(gameApplicationService.getSessionState(id));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return reply.code(404).send({ error: message });
    }
  });

  app.get("/sessions/:id/messages", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return reply.send(gameApplicationService.getMessages(id));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return reply.code(404).send({ error: message });
    }
  });

  app.post("/sessions/:id/messages", async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = sendMessageRequestSchema.parse(request.body);
    try {
      return reply.send(await gameApplicationService.sendMessage(id, input));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return reply.code(500).send({ error: message });
    }
  });

  app.put("/sessions/:id/scenario", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const scenario = scenarioSchema.parse(request.body);
      return reply.send(gameApplicationService.updateScenario(id, scenario));
    } catch (err) {
      if (err instanceof z.ZodError) return reply.code(400).send({ error: "请求参数无效" });
      const message = err instanceof Error ? err.message : "Unknown error";
      return reply.code(500).send({ error: message });
    }
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

    // SSE timeout: abort if no data flows for 90 seconds (LLM hang protection)
    const SSE_TIMEOUT_MS = 90_000;
    let timeoutHandle = setTimeout(() => {
      if (!closed) {
        raw.write(`data: ${JSON.stringify({ type: "error", message: "Stream timeout — LLM did not respond in time" })}\n\n`);
        raw.end();
        closed = true;
      }
    }, SSE_TIMEOUT_MS);

    const resetTimeout = () => {
      clearTimeout(timeoutHandle);
      if (!closed) {
        timeoutHandle = setTimeout(() => {
          if (!closed) {
            raw.write(`data: ${JSON.stringify({ type: "error", message: "Stream timeout" })}\n\n`);
            raw.end();
            closed = true;
          }
        }, SSE_TIMEOUT_MS);
      }
    };

    try {
      for await (const event of gameApplicationService.sendMessageStream(id, input)) {
        if (closed) break;
        raw.write(`data: ${JSON.stringify(event)}\n\n`);
        resetTimeout();
      }
    } catch (err) {
      if (!closed) {
        const message = err instanceof Error ? err.message : "Unknown error";
        raw.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
      }
    } finally {
      clearTimeout(timeoutHandle);
    }

    raw.end();
    return reply.hijack();
  });

  app.post("/sessions/:id/choose", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const { branchIndex } = choiceRequestSchema.parse(request.body);
      return reply.send(gameApplicationService.applyChoice(id, branchIndex));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: "无效的选择请求" });
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      return reply.code(400).send({ error: message });
    }
  });

  app.post("/sessions/restore", async (request, reply) => {
    try {
      const { storyPackageId, saveId, slot } = z.object({
        storyPackageId: z.string(),
        saveId: z.string().optional(),
        slot: z.number().int().min(1).max(3).optional()
      }).parse(request.body);
      const result = gameApplicationService.restoreSession(storyPackageId, saveId, slot);
      return reply.send(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: "请求参数无效" });
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      return reply.code(500).send({ error: message });
    }
  });
}
