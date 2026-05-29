import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { LlmConfig, LlmConfigView } from "@story-game/shared";
import { createModuleLogger } from "../../utils/logger.js";

const logger = createModuleLogger("llmConfig");

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
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return { ...defaultConfig, ...parsed };
  } catch (err) {
    console.warn("[llm-config] failed to load config from file, falling back to env/defaults:", (err as Error).message);
    return null;
  }
}

function saveToFile(config: LlmConfig): LlmConfig {
  const path = resolveConfigPath();
  // Never degrade: if file already has apiKey and we don't, keep the file's key
  const existing = loadFromFile();
  if (existing?.apiKey && !config.apiKey) {
    config = { ...config, apiKey: existing.apiKey };
  }
  if (existing && existing.provider !== "mock" && config.provider === "mock") {
    config = { ...config, provider: existing.provider };
  }
  const tmpPath = path + ".tmp";
  writeFileSync(tmpPath, JSON.stringify(config, null, 2), "utf-8");
  writeFileSync(path, JSON.stringify(config, null, 2), "utf-8");
  try { require("fs").unlinkSync(tmpPath); } catch (err) { logger.warn({ err, path: tmpPath }, "failed to clean up tmp config file"); }
  return config;
}

function buildInitialConfig(): LlmConfig {
  const fromFile = loadFromFile();

  // Env vars always take priority as safety net
  const envProvider = process.env.LLM_PROVIDER as LlmConfig["provider"] | undefined;
  const envApiKey = process.env.DEEPSEEK_API_KEY || undefined;

  if (fromFile) {
    // Env overrides file provider to prevent "stuck on mock"
    if (envProvider) fromFile.provider = envProvider;
    // Env API key overrides placeholder/suspect file keys
    if (envApiKey && (!fromFile.apiKey || fromFile.apiKey.length < 20)) {
      fromFile.apiKey = envApiKey;
    }
    return fromFile;
  }

  return {
    ...defaultConfig,
    provider: envProvider || defaultConfig.provider,
    apiKey: envApiKey,
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
    const explicitApiKey = next.apiKey?.trim();
    const merged: LlmConfig = {
      ...this.config,
      ...next,
      apiKey: explicitApiKey !== undefined && explicitApiKey !== "" ? explicitApiKey : this.config.apiKey,
    };
    // Guard in-memory state against downgrading to mock (saveToFile also guards disk)
    if (this.config.provider !== "mock" && merged.provider === "mock") {
      merged.provider = this.config.provider;
    }
    this.config = saveToFile(merged);
    return this.getView();
  }
}
