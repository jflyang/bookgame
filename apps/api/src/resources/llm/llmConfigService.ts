import type { LlmConfig, LlmConfigView } from "@story-game/shared";

const defaultConfig: LlmConfig = {
  provider: "mock",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-v4-flash",
  temperature: 0.8,
  maxTokens: 800
};

export class LlmConfigService {
  private config: LlmConfig = {
    ...defaultConfig,
    provider: (process.env.LLM_PROVIDER as LlmConfig["provider"]) || defaultConfig.provider,
    apiKey: process.env.DEEPSEEK_API_KEY
  };

  getConfig() {
    return this.config;
  }

  getView(): LlmConfigView {
    const { apiKey: _apiKey, ...rest } = this.config;
    return {
      ...rest,
      hasApiKey: Boolean(this.config.apiKey)
    };
  }

  update(next: LlmConfig) {
    const hasApiKeyField = Object.prototype.hasOwnProperty.call(next, "apiKey");
    this.config = {
      ...next,
      apiKey: hasApiKeyField ? next.apiKey?.trim() || undefined : this.config.apiKey
    };
    return this.getView();
  }
}
