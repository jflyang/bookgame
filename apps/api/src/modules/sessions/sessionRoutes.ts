import type { FastifyInstance } from "fastify";
import type { SessionRepository } from "./sessionRepository.js";
import type { GameStateService } from "../../services/gameStateService.js";
import type { MemoryService } from "../../services/memoryService.js";

export function registerSessionRoutes(
  app: FastifyInstance,
  repo: SessionRepository,
  gameStateService: GameStateService,
  memoryService: MemoryService
) {
  app.get("/sessions", async (request, reply) => {
    const { storyPackageId, status } = request.query as { storyPackageId?: string; status?: string };

    let sessions;
    if (storyPackageId) {
      sessions = repo.findByPackage(storyPackageId);
    } else if (status) {
      sessions = repo.findByStatus(status);
    } else {
      sessions = repo.listAll();
    }

    return reply.send({ sessions });
  });

  app.get("/sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = repo.getById(id);
    if (!session) return reply.code(404).send({ error: "Session not found" });

    let gameState = null;
    let messages = null;
    try {
      const stateResult = gameStateService.get(id);
      gameState = stateResult;
    } catch {
      // session not in memory (server restart)
    }
    try {
      messages = memoryService.list(id);
    } catch {
      // no messages
    }

    return reply.send({ session, gameState, messages });
  });

  app.delete("/sessions", async (_request, reply) => {
    repo.deleteAll();
    return reply.send({ ok: true });
  });
}
