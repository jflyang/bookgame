import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ttsConfigService, ttsProvider, voiceRegistry, ttsProcessManager } from "../modules/container.js";
import { createModuleLogger } from "../utils/logger.js";

const logger = createModuleLogger("tts:routes");

const synthesizeRequestSchema = z.object({
  text: z.string().min(1).max(2000),
  characterId: z.string().min(1),
  emotion: z.string().optional(),
  format: z.enum(["mp3", "ogg", "wav"]).optional(),
});

const ttsConfigUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(["cosyvoice", "elevenlabs", "mock", "disabled"]).optional(),
  serviceUrl: z.string().optional(),
  defaultInstruct: z.string().optional(),
  autoSynthesize: z.boolean().optional(),
  cacheEnabled: z.boolean().optional(),
  maxTextLength: z.number().int().positive().optional(),
  defaultFormat: z.enum(["mp3", "ogg", "wav"]).optional(),
  sampleRate: z.number().int().positive().optional(),
  elevenLabsApiKey: z.string().optional(),
  elevenLabsModel: z.string().optional(),
});

export async function ttsRoutes(app: FastifyInstance) {
  // Synthesize speech for a message
  app.post("/synthesize", async (request, reply) => {
    const config = ttsConfigService.getConfig();
    if (!config.enabled || config.provider === "disabled") {
      return reply.code(503).send({ error: "TTS service is disabled" });
    }

    try {
      let { text, characterId, emotion, format } = synthesizeRequestSchema.parse(request.body);

      // Trim long text for faster synthesis — keep first ~150 chars ending at sentence boundary
      if (text.length > 150) {
        const cutoff = text.slice(0, 200);
        const sentenceEnd = cutoff.search(/[。！？；\n]/);
        text = sentenceEnd > 50 ? cutoff.slice(0, sentenceEnd + 1) : cutoff.slice(0, 150);
      }

      const voiceId = voiceRegistry.getVoiceId(characterId);
      const instruct = voiceRegistry.getInstruct(characterId, emotion);

      const result = await ttsProvider.synthesize({
        text,
        voiceId,
        instruct,
        format: format || config.defaultFormat,
        sampleRate: config.sampleRate,
      });

      return reply.send(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: "请求参数无效", details: err.errors });
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error({ err }, "TTS synthesize failed");
      return reply.code(500).send({ error: message });
    }
  });

  // Stream synthesized audio
  app.post("/stream", async (request, reply) => {
    const config = ttsConfigService.getConfig();
    if (!config.enabled || config.provider === "disabled") {
      return reply.code(503).send({ error: "TTS service is disabled" });
    }

    try {
      const { text, characterId, emotion, format } = synthesizeRequestSchema.parse(request.body);

      const voiceId = voiceRegistry.getVoiceId(characterId);
      const instruct = voiceRegistry.getInstruct(characterId, emotion);
      const outputFormat = format || config.defaultFormat;

      const mimeTypes: Record<string, string> = {
        mp3: "audio/mpeg",
        ogg: "audio/ogg",
        wav: "audio/wav",
      };

      const raw = reply.raw;
      raw.writeHead(200, {
        "Content-Type": mimeTypes[outputFormat] || "audio/mpeg",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      });

      for await (const chunk of ttsProvider.streamSynthesize({
        text,
        voiceId,
        instruct,
        format: outputFormat,
        sampleRate: config.sampleRate,
      })) {
        raw.write(chunk);
      }

      raw.end();
      return reply.hijack();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: "请求参数无效" });
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error({ err }, "TTS stream failed");
      return reply.code(500).send({ error: message });
    }
  });

  // Proxy cached audio from CosyVoice service or serve local cache
  app.get("/audio/:filename", async (request, reply) => {
    const { filename } = request.params as { filename: string };

    // Validate filename to prevent path traversal
    if (!/^[\w\-]+\.(mp3|ogg|wav)$/.test(filename)) {
      return reply.code(400).send({ error: "Invalid filename" });
    }

    const config = ttsConfigService.getConfig();

    // Try local cache first (used by ElevenLabs provider)
    const { existsSync, createReadStream } = await import("node:fs");
    const { join, resolve, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const localCachePath = resolve(__dirname, "../..", "data", "tts-cache", filename);

    if (existsSync(localCachePath)) {
      const mimeTypes: Record<string, string> = { mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav" };
      const ext = filename.split(".").pop() || "mp3";
      const raw = reply.raw;
      raw.writeHead(200, {
        "Content-Type": mimeTypes[ext] || "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      });
      const stream = createReadStream(localCachePath);
      stream.pipe(raw);
      return reply.hijack();
    }

    // Fallback: proxy from CosyVoice service
    try {
      const upstream = await fetch(`${config.serviceUrl}/v1/tts/audio/${filename}`, {
        signal: AbortSignal.timeout(10_000),
      });

      if (!upstream.ok) {
        return reply.code(upstream.status).send({ error: "Audio not found" });
      }

      const mimeTypes: Record<string, string> = {
        mp3: "audio/mpeg",
        ogg: "audio/ogg",
        wav: "audio/wav",
      };
      const ext = filename.split(".").pop() || "mp3";

      const raw = reply.raw;
      raw.writeHead(200, {
        "Content-Type": mimeTypes[ext] || "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      });

      const reader = upstream.body?.getReader();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          raw.write(Buffer.from(value));
        }
        reader.releaseLock();
      }

      raw.end();
      return reply.hijack();
    } catch (err) {
      logger.error({ err, filename }, "failed to proxy TTS audio");
      return reply.code(404).send({ error: "Audio not found" });
    }
  });

  // Get TTS configuration
  app.get("/config", async (_request, reply) => {
    const view = ttsConfigService.getView();
    // Check service availability
    try {
      const available = await ttsProvider.isAvailable();
      return reply.send({ ...view, serviceAvailable: available });
    } catch {
      return reply.send({ ...view, serviceAvailable: false });
    }
  });

  // Update TTS configuration
  app.put("/config", async (request, reply) => {
    try {
      const updates = ttsConfigUpdateSchema.parse(request.body);
      const updated = ttsConfigService.update(updates);
      return reply.send(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: "配置参数无效", details: err.errors });
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      return reply.code(500).send({ error: message });
    }
  });

  // List available voices
  app.get("/voices", async (_request, reply) => {
    const config = ttsConfigService.getConfig();
    if (!config.enabled || config.provider === "disabled") {
      // Return registered voice profiles even when service is disabled
      const profiles = voiceRegistry.listProfiles();
      return reply.send({
        voices: profiles.map((p) => ({
          id: p.voiceId,
          name: p.name,
          characterId: p.characterId,
          language: p.language,
          instruct: p.instruct,
        })),
        source: "registry",
      });
    }

    try {
      const serviceVoices = await ttsProvider.listVoices();
      const profiles = voiceRegistry.listProfiles();
      return reply.send({
        voices: serviceVoices,
        registeredProfiles: profiles.map((p) => ({
          characterId: p.characterId,
          voiceId: p.voiceId,
          name: p.name,
          instruct: p.instruct,
        })),
        source: "service",
      });
    } catch (err) {
      const profiles = voiceRegistry.listProfiles();
      return reply.send({
        voices: profiles.map((p) => ({
          id: p.voiceId,
          name: p.name,
          characterId: p.characterId,
          language: p.language,
          instruct: p.instruct,
        })),
        source: "registry_fallback",
      });
    }
  });

  // Register a voice profile for a character
  app.post("/voices/register", async (request, reply) => {
    const schema = z.object({
      characterId: z.string().min(1),
      voiceId: z.string().min(1),
      name: z.string().min(1),
      instruct: z.string().default(""),
      referenceAudio: z.string().default(""),
      language: z.string().default("zh"),
      emotions: z.record(z.string(), z.string()).optional(),
    });

    try {
      const profile = schema.parse(request.body);
      voiceRegistry.register(profile);
      return reply.code(201).send({ ok: true, profile });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: "参数无效", details: err.errors });
      }
      return reply.code(500).send({ error: "注册失败" });
    }
  });

  // Health check for TTS service
  app.get("/health", async (_request, reply) => {
    const config = ttsConfigService.getConfig();
    if (!config.enabled || config.provider === "disabled") {
      return reply.send({ status: "disabled", provider: config.provider });
    }

    try {
      const available = await ttsProvider.isAvailable();
      return reply.send({
        status: available ? "ok" : "unavailable",
        provider: config.provider,
        serviceUrl: config.serviceUrl,
      });
    } catch {
      return reply.send({ status: "error", provider: config.provider });
    }
  });

  // ===== Service Process Control =====

  // Get service process status
  app.get("/service/status", async (_request, reply) => {
    return reply.send(ttsProcessManager.getStatus());
  });

  // Start the TTS service process
  app.post("/service/start", async (request, reply) => {
    const { port, pythonPath } = (request.body as { port?: number; pythonPath?: string }) || {};
    const result = await ttsProcessManager.start({ port, pythonPath });
    if (result.ok) {
      // Auto-enable TTS config when service starts
      ttsConfigService.update({ enabled: true, provider: "cosyvoice" });
      return reply.send({ ok: true, status: ttsProcessManager.getStatus() });
    }
    return reply.code(500).send(result);
  });

  // Stop the TTS service process
  app.post("/service/stop", async (_request, reply) => {
    const result = ttsProcessManager.stop();
    if (result.ok) {
      return reply.send({ ok: true, status: ttsProcessManager.getStatus() });
    }
    return reply.code(500).send(result);
  });

  // Get service logs
  app.get("/service/logs", async (request, reply) => {
    const { lines } = request.query as { lines?: string };
    const logLines = ttsProcessManager.getLogs(lines ? parseInt(lines, 10) : undefined);
    return reply.send({ logs: logLines });
  });
}
