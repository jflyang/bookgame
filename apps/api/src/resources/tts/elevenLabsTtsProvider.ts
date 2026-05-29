import type { TtsProvider, TtsRequest, TtsSynthesisResult, VoiceInfo } from "./ttsProvider.js";
import type { TtsConfigService } from "./ttsConfigService.js";
import { createModuleLogger } from "../../utils/logger.js";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { request as httpsRequest } from "node:https";

const logger = createModuleLogger("tts:elevenlabs");

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
/** Default ElevenLabs voice — "Roger" (deep male, good for Chinese) */
const DEFAULT_VOICE_ID = "CwhRBWXzGAHq8TQ4Fs17";

/** Voice settings for game characters — expressive with good stability */
const GAME_VOICE_SETTINGS = {
  stability: 0.4,
  similarity_boost: 0.75,
  style: 0.45,
  use_speaker_boost: true,
};

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  labels?: Record<string, string>;
  language?: string;
}

export class ElevenLabsTtsProvider implements TtsProvider {
  private readonly cacheDir: string;

  constructor(private readonly configService: TtsConfigService) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    this.cacheDir = resolve(__dirname, "../../..", "data", "tts-cache");
    if (!existsSync(this.cacheDir)) mkdirSync(this.cacheDir, { recursive: true });
  }

  async synthesize(input: TtsRequest): Promise<TtsSynthesisResult> {
    const config = this.configService.getConfig();
    const apiKey = config.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ElevenLabs API key is not configured");

    const modelId = config.elevenLabsModel || DEFAULT_MODEL_ID;
    const voiceId = this.resolveVoiceId(input.voiceId);
    const format = input.format || config.defaultFormat || "mp3";

    // Check cache
    const cacheKey = this.getCacheKey(input.text, voiceId, modelId);
    const cacheFile = `${cacheKey}.${format}`;
    const cachePath = join(this.cacheDir, cacheFile);

    if (config.cacheEnabled && existsSync(cachePath)) {
      logger.debug({ voiceId, cacheKey }, "cache hit");
      return {
        audioUrl: `/api/tts/audio/${cacheFile}`,
        durationMs: this.estimateDuration(input.text),
        cached: true,
      };
    }

    // Map format to ElevenLabs output_format parameter
    const outputFormat = this.mapOutputFormat(format);

    const start = Date.now();

    const audioBuffer = await this.callElevenLabs(voiceId, input.text, modelId, outputFormat, apiKey);

    const latency = Date.now() - start;
    logger.info({ voiceId, modelId, latency, size: audioBuffer.length }, "elevenlabs synthesize");

    // Save to cache
    writeFileSync(cachePath, audioBuffer);

    return {
      audioUrl: `/api/tts/audio/${cacheFile}`,
      durationMs: this.estimateDuration(input.text),
      cached: false,
    };
  }

  private callElevenLabs(voiceId: string, text: string, modelId: string, outputFormat: string, apiKey: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: GAME_VOICE_SETTINGS,
      });
      const payloadBuffer = Buffer.from(payload, "utf-8");

      const url = new URL(`${ELEVENLABS_BASE_URL}/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`);

      const req = httpsRequest(
        {
          hostname: url.hostname,
          port: 443,
          path: `${url.pathname}${url.search}`,
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            "Content-Length": payloadBuffer.length,
          },
          timeout: 60000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            const body = Buffer.concat(chunks);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              if (body.length === 0) {
                reject(new Error("ElevenLabs returned empty audio"));
              } else {
                resolve(body);
              }
            } else {
              const errText = body.toString("utf-8").slice(0, 300);
              if (res.statusCode === 401) reject(new Error("ElevenLabs API key invalid"));
              else if (res.statusCode === 429) reject(new Error("ElevenLabs quota exceeded"));
              else if (res.statusCode === 404) reject(new Error(`ElevenLabs voice_id not found: ${voiceId}`));
              else reject(new Error(`ElevenLabs API error (${res.statusCode}): ${errText}`));
            }
          });
        }
      );

      req.on("error", (err) => reject(new Error(`ElevenLabs network error: ${err.message}`)));
      req.on("timeout", () => { req.destroy(); reject(new Error("ElevenLabs request timeout")); });
      req.write(payloadBuffer);
      req.end();
    });
  }

  async *streamSynthesize(input: TtsRequest): AsyncIterable<Buffer> {
    const config = this.configService.getConfig();
    const apiKey = config.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ElevenLabs API key is not configured");

    const modelId = config.elevenLabsModel || DEFAULT_MODEL_ID;
    const voiceId = this.resolveVoiceId(input.voiceId);
    const format = input.format || config.defaultFormat || "mp3";
    const outputFormat = this.mapOutputFormat(format);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    let response: Response;
    try {
      response = await fetch(
        `${ELEVENLABS_BASE_URL}/v1/text-to-speech/${voiceId}/stream?output_format=${outputFormat}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: input.text,
            model_id: modelId,
            voice_settings: GAME_VOICE_SETTINGS,
          }),
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      let errText = "";
      try {
        const buf = Buffer.from(await response.arrayBuffer());
        errText = buf.toString("utf-8");
      } catch {
        errText = `HTTP ${response.status}`;
      }
      throw new Error(`ElevenLabs stream error (${response.status}): ${errText.slice(0, 200)}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body from ElevenLabs stream");

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield Buffer.from(value);
      }
    } finally {
      reader.releaseLock();
    }
  }

  async listVoices(): Promise<VoiceInfo[]> {
    const config = this.configService.getConfig();
    const apiKey = config.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return [];

    try {
      const response = await fetch(`${ELEVENLABS_BASE_URL}/v1/voices`, {
        headers: { "xi-api-key": apiKey },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return [];

      const data = (await response.json()) as { voices: ElevenLabsVoice[] };
      return data.voices.map((v) => ({
        id: v.voice_id,
        name: v.name,
        language: v.labels?.language || "en",
        defaultInstruct: v.labels?.description,
      }));
    } catch (err) {
      logger.warn({ err }, "failed to list ElevenLabs voices");
      return [];
    }
  }

  async isAvailable(): Promise<boolean> {
    const config = this.configService.getConfig();
    const apiKey = config.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return false;

    try {
      const response = await fetch(`${ELEVENLABS_BASE_URL}/v1/user/subscription`, {
        headers: { "xi-api-key": apiKey },
        signal: AbortSignal.timeout(8000),
      });
      return response.ok;
    } catch {
      // Network issues don't mean the key is invalid — return true if key exists
      // The actual synthesis call will fail with a clear error if there's a real problem
      return true;
    }
  }

  private getCacheKey(text: string, voiceId: string, modelId: string): string {
    return createHash("md5").update(`${text}|${voiceId}|${modelId}`).digest("hex");
  }

  /**
   * ElevenLabs voice IDs are 20-char alphanumeric strings.
   * If the voiceId looks like a game character ID (Chinese/short), use a default voice.
   */
  private resolveVoiceId(voiceId: string): string {
    // ElevenLabs IDs are typically 20 chars, alphanumeric
    if (/^[a-zA-Z0-9]{15,30}$/.test(voiceId)) return voiceId;
    // Not a valid ElevenLabs ID — use default multilingual voice
    // "Roger" - a good default male voice for Chinese content
    return DEFAULT_VOICE_ID;
  }

  private mapOutputFormat(format: string): string {
    switch (format) {
      case "mp3": return "mp3_44100_128";
      case "ogg": return "mp3_44100_128"; // ElevenLabs doesn't support ogg, fallback to mp3
      case "wav": return "pcm_44100";
      default: return "mp3_44100_128";
    }
  }

  private estimateDuration(text: string): number {
    // Rough estimate: ~120ms per Chinese character, ~80ms per English word
    const charCount = text.length;
    return Math.max(500, charCount * 100);
  }
}
