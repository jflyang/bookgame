import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { LlmConfig, LlmConfigView } from "@story-game/shared";

const defaultConfig: LlmConfig = {
  provider: "mock",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-v4-flash",
  temperature: 0.8,
  maxTokens: 800,
};

function resolveConfigPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const apiRoot = resolve(__dirname, "../../..");
  const dataDir = join(apiRoot, "data");
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  return join(dataDir, "llm-config.json");
}

function loadFromFile(): LlmConfig | null {
  try {
    const path = resolveConfigPath();
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as LlmConfig;
  } catch {
    return null;
  }
}

function saveToFile(config: LlmConfig): void {
  const path = resolveConfigPath();
  writeFileSync(path, JSON.stringify(config, null, 2), "utf-8");
}

function buildInitialConfig(): LlmConfig {
  const fromFile = loadFromFile();
  if (fromFile) return fromFile;

  return {
    ...defaultConfig,
    provider: (process.env.LLM_PROVIDER as LlmConfig["provider"]) || defaultConfig.provider,
    apiKey: process.env.DEEPSEEK_API_KEY || undefined,
  };
}

export class LlmConfigService {
  private config: LlmConfig = buildInitialConfig();

  getConfig() {
    return this.config;
  }

  getView(): LlmConfigView {
    const { apiKey: _apiKey, ...rest } = this.config;
    return {
      ...rest,
      hasApiKey: Boolean(this.config.apiKey),
    };
  }

  update(next: LlmConfig) {
    this.config = {
      ...next,
      apiKey: next.apiKey?.trim() || this.config.apiKey,
    };
    saveToFile(this.config);
    return this.getView();
  }
}
