import type { FastifyInstance } from "fastify";
import { adminRoutes } from "./admin.routes.js";
import { gameRoutes } from "./game.routes.js";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(gameRoutes, { prefix: "/api/game" });
  await app.register(adminRoutes, { prefix: "/api/admin" });
}
