import type { FastifyInstance } from "fastify";
import {
  createSessionRequestSchema,
  scenarioSchema,
  sendMessageRequestSchema
} from "@story-game/shared";
import { dialogueEngine } from "../modules/container.js";

export async function gameRoutes(app: FastifyInstance) {
  app.post("/sessions", async (request, reply) => {
    const input = createSessionRequestSchema.parse(request.body ?? {});
    const result = dialogueEngine.createSession(input);
    return reply.code(201).send(result);
  });

  app.get("/sessions/:id/state", async (request, reply) => {
    const { id } = request.params as { id: string };
    return reply.send(dialogueEngine.getSessionState(id));
  });

  app.get("/sessions/:id/messages", async (request, reply) => {
    const { id } = request.params as { id: string };
    return reply.send({ messages: dialogueEngine.getMessages(id) });
  });

  app.post("/sessions/:id/messages", async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = sendMessageRequestSchema.parse(request.body);
    return reply.send(await dialogueEngine.sendMessage(id, input));
  });

  app.put("/sessions/:id/scenario", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scenario = scenarioSchema.parse(request.body);
    return reply.send(dialogueEngine.updateScenario(id, scenario));
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
      for await (const event of dialogueEngine.sendMessageStream(id, input)) {
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
}
