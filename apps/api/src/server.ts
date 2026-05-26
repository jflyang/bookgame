import cors from "@fastify/cors";
import dotenv from "dotenv";
import Fastify from "fastify";
import { registerRoutes } from "./routes/index.js";

dotenv.config();

const app = Fastify({ logger: true });
const port = Number(process.env.PORT ?? 4000);

await app.register(cors, {
  origin: process.env.WEB_ORIGIN ?? "http://localhost:5173"
});

app.get("/health", async () => ({ ok: true }));
await registerRoutes(app);

await app.listen({ port, host: "0.0.0.0" });
