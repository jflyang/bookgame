import type { FastifyInstance } from "fastify";
import type { RuntimeStatsCollector } from "./runtimeStatsCollector.js";

export function registerRuntimeStatsRoutes(app: FastifyInstance, collector: RuntimeStatsCollector) {
  app.get("/runtime-stats", async (request, reply) => {
    const { limit, sessionId } = request.query as { limit?: string; sessionId?: string };
    const records = collector.listRecent(limit ? parseInt(limit, 10) : 50, sessionId);
    return reply.send({ records });
  });

  app.get("/runtime-stats/aggregates", async (request, reply) => {
    const { sessionId } = request.query as { sessionId?: string };
    return reply.send({ aggregates: collector.getAggregates(sessionId) });
  });

  app.get("/runtime-stats/sessions", async (_request, reply) => {
    return reply.send({ sessions: collector.listSessionSummaries() });
  });

  app.get("/runtime-stats/sessions/:sessionId", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    return reply.send({ records: collector.findBySession(sessionId) });
  });

  app.delete("/runtime-stats", async (_request, reply) => {
    collector.clear();
    return reply.send({ ok: true });
  });
}
