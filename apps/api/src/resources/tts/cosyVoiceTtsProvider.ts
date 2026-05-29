import type { TtsProvider, TtsRequest, TtsSynthesisResult, VoiceInfo } from "./ttsProvider.js";
import type { TtsConfigService } from "./ttsConfigService.js";
import { createModuleLogger } from "../../utils/logger.js";

const logger = createModuleLogger("tts:cosyvoice");

interface CosyVoiceSynthResponse {
  audio_url: string;
  duration_ms: number;
  sample_rate: number;
  cached: boolean;
}

interface CosyVoiceVoicesResponse {
  voices: Array<{
    id: string;
    name: string;
    language: string;
    default_instruct?: string;
  }>;
}

interface CosyVoiceHealthResponse {
  status: string;
  model: string;
  gpu: boolean;
}

export class CosyVoiceTtsProvider implements TtsProvider {
  constructor(private readonly configService: TtsConfigService) {}

  async synthesize(input: TtsRequest): Promise<TtsSynthesisResult> {
    const config = this.configService.getConfig();
    const start = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    let response: Response;
    try {
      response = await fetch(`${config.serviceUrl}/v1/tts/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: input.text,
          voice_id: input.voiceId,
          voice_config: {
            mode: "zero_shot",
            instruct: input.instruct || config.defaultInstruct,
          },
          output_format: input.format || config.defaultFormat,
          sample_rate: input.sampleRate || config.sampleRate,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown");
      throw new Error(`CosyVoice synthesis failed: ${response.status} ${errText}`);
    }

    const data = (await response.json()) as CosyVoiceSynthResponse;
    const latency = Date.now() - start;
    logger.info({ voiceId: input.voiceId, latency, cached: data.cached }, "tts synthesize");

    // Extract filename from the internal URL for proxying
    const filename = data.audio_url.split("/").pop() || "";

    return {
      audioUrl: `/api/tts/audio/${filename}`,
      durationMs: data.duration_ms,
      cached: data.cached,
    };
  }

  async *streamSynthesize(input: TtsRequest): AsyncIterable<Buffer> {
    const config = this.configService.getConfig();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    let response: Response;
    try {
      response = await fetch(`${config.serviceUrl}/v1/tts/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: input.text,
          voice_id: input.voiceId,
          voice_config: {
            mode: "zero_shot",
            instruct: input.instruct || config.defaultInstruct,
          },
          output_format: input.format || config.defaultFormat,
          sample_rate: input.sampleRate || config.sampleRate,
          stream: true,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown");
      throw new Error(`CosyVoice stream failed: ${response.status} ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("CosyVoice stream response missing body");

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
    try {
      const response = await fetch(`${config.serviceUrl}/v1/tts/voices`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return [];
      const data = (await response.json()) as CosyVoiceVoicesResponse;
      return data.voices.map((v) => ({
        id: v.id,
        name: v.name,
        language: v.language,
        defaultInstruct: v.default_instruct,
      }));
    } catch (err) {
      logger.warn({ err }, "failed to list voices from CosyVoice service");
      return [];
    }
  }

  async isAvailable(): Promise<boolean> {
    const config = this.configService.getConfig();
    try {
      const response = await fetch(`${config.serviceUrl}/v1/tts/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return false;
      const data = (await response.json()) as CosyVoiceHealthResponse;
      return data.status === "ok";
    } catch {
      return false;
    }
  }
}
