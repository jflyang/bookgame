import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import dotenv from "dotenv";
import Fastify from "fastify";
import { registerRoutes } from "./routes/index.js";

dotenv.config();

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pinoPrettyPath = require.resolve("pino-pretty");

const level = process.env.LOG_LEVEL ?? "debug";
const app = Fastify({
  logger: {
    level,
    transport: { target: pinoPrettyPath, options: { colorize: true, translateTime: "SYS:HH:MM:ss" } }
  },
  bodyLimit: 25 * 1024 * 1024
});
const port = Number(process.env.PORT ?? 4000);
const defaultWebOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const webOrigins = process.env.WEB_ORIGIN
  ? process.env.WEB_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
  : defaultWebOrigins;

await app.register(cors, {
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  origin: webOrigins
});

await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } });

// Global error handler — catch unhandled route errors
app.setErrorHandler((error, request, reply) => {
  const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
  app.log.error({ err: error, url: request.url, method: request.method }, "unhandled route error");
  const message = error instanceof Error ? error.message : "Internal Server Error";
  reply.code(statusCode).send({
    error: statusCode >= 500 ? "Internal Server Error" : message,
    statusCode
  });
});

app.get("/health", async () => ({ ok: true }));
await registerRoutes(app);

// Serve frontend static files in production (Electron desktop mode)
if (process.env.NODE_ENV === "production") {
  const fastifyStatic = await import("@fastify/static");
  // Try multiple possible locations for the web dist
  const webDistCandidates = [
    join(__dirname, "../../web/dist"),       // monorepo layout
    join(__dirname, "../web"),               // electron resources layout
    resolve(process.cwd(), "../web/dist"),   // relative to cwd
  ];
  const webDist = webDistCandidates.find((p) => existsSync(p));
  if (webDist) {
    await app.register(fastifyStatic.default, {
      root: webDist,
      prefix: "/",
      wildcard: false,
    });
    // SPA fallback: serve index.html for non-API routes
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.code(404).send({ error: "Not Found" });
      }
      return reply.sendFile("index.html");
    });
    app.log.info({ webDist }, "serving frontend static files");
  }
}

// Retry listen with backoff — handles port still held by previous process during hot-reload
async function listenWithRetry(maxRetries = 8, delayMs = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await app.listen({ port, host: "0.0.0.0" });
      return;
    } catch (err: unknown) {
      const isAddrInUse = err instanceof Error && "code" in err && (err as { code: string }).code === "EADDRINUSE";
      if (!isAddrInUse || attempt === maxRetries) throw err;
      app.log.warn({ port, attempt, maxRetries }, "port in use, retrying...");
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
}

await listenWithRetry();

// Graceful shutdown
async function shutdown(signal: string) {
  app.log.info({ signal }, "shutting down gracefully");
  try {
    await app.close();
  } catch (err) {
    app.log.error({ err }, "error during shutdown");
  }
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
