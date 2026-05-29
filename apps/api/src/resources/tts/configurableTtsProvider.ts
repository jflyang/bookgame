import type { TtsProvider, TtsRequest, TtsSynthesisResult, VoiceInfo } from "./ttsProvider.js";
import type { TtsConfigService } from "./ttsConfigService.js";

/**
 * Configurable TTS provider that delegates to the active provider
 * based on runtime configuration. Mirrors ConfigurableLlmProvider pattern.
 */
export class ConfigurableTtsProvider implements TtsProvider {
  constructor(
    private readonly configService: TtsConfigService,
    private readonly providers: Record<string, TtsProvider>
  ) {}

  synthesize(input: TtsRequest): Promise<TtsSynthesisResult> {
    return this.currentProvider().synthesize(input);
  }

  streamSynthesize(input: TtsRequest): AsyncIterable<Buffer> {
    return this.currentProvider().streamSynthesize(input);
  }

  listVoices(): Promise<VoiceInfo[]> {
    return this.currentProvider().listVoices();
  }

  isAvailable(): Promise<boolean> {
    return this.currentProvider().isAvailable();
  }

  private currentProvider(): TtsProvider {
    const config = this.configService.getConfig();
    if (!config.enabled || config.provider === "disabled") {
      throw new Error("TTS service is disabled");
    }
    const provider = this.providers[config.provider];
    if (!provider) {
      throw new Error(`Unsupported TTS provider: ${config.provider}`);
    }
    return provider;
  }
}
