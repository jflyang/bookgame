import { createRequire } from "node:module";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import dotenv from "dotenv";
import Fastify from "fastify";
import { registerRoutes } from "./routes/index.js";

dotenv.config();

const require = createRequire(import.meta.url);
const pinoPrettyPath = require.resolve("pino-pretty");

const level = process.env.LOG_LEVEL ?? "debug";
const app = Fastify({
  logger: {
    level,
    transport: { target: pinoPrettyPath, options: { colorize: true, translateTime: "SYS:HH:MM:ss" } }
  },
  bodyLimit: 10 * 1024 * 1024
});
const port = Number(process.env.PORT ?? 4000);

await app.register(cors, {
  origin: process.env.WEB_ORIGIN ?? "http://localhost:5173"
});

await app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024 } });

app.get("/health", async () => ({ ok: true }));
await registerRoutes(app);

await app.listen({ port, host: "0.0.0.0" });
