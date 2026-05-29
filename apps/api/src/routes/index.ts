import type { FastifyInstance } from "fastify";
import { adminRoutes } from "./admin.routes.js";
import { gameRoutes } from "./game.routes.js";
import { storyAssetsRoutes } from "./storyAssets.routes.js";
import { ttsRoutes } from "./tts.routes.js";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(gameRoutes, { prefix: "/api/game" });
  await app.register(adminRoutes, { prefix: "/api/admin" });
  await app.register(ttsRoutes, { prefix: "/api/tts" });
  await app.register(storyAssetsRoutes, { prefix: "/api" });
}
