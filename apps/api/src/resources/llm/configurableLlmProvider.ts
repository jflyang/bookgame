import type { LlmProvider, LlmRequest, LlmStreamResult } from "./llmProvider.js";
import type { LlmConfigService } from "./llmConfigService.js";

export class ConfigurableLlmProvider implements LlmProvider {
  constructor(
    private readonly configService: LlmConfigService,
    private readonly providers: Record<string, LlmProvider>
  ) {}

  complete(input: LlmRequest) {
    return this.currentProvider().complete(input);
  }

  stream(input: LlmRequest): LlmStreamResult {
    return this.currentProvider().stream(input);
  }

  private currentProvider() {
    const provider = this.providers[this.configService.getConfig().provider];
    if (!provider) throw new Error(`Unsupported LLM provider: ${this.configService.getConfig().provider}`);
    return provider;
  }
}
