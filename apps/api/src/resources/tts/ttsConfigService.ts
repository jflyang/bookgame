import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createModuleLogger } from "../../utils/logger.js";

const logger = createModuleLogger("ttsConfig");

export interface TtsConfig {
  enabled: boolean;
  provider: "cosyvoice" | "mock" | "disabled";
  serviceUrl: string;
  defaultInstruct: string;
  autoSynthesize: boolean;
  cacheEnabled: boolean;
  maxTextLength: number;
  defaultFormat: "mp3" | "ogg" | "wav";
  sampleRate: number;
}

export interface TtsConfigView {
  enabled: boolean;
  provider: string;
  serviceUrl: string;
  defaultInstruct: string;
  autoSynthesize: boolean;
  cacheEnabled: boolean;
  maxTextLength: number;
  defaultFormat: string;
  sampleRate: number;
  serviceAvailable?: boolean;
}

const defaultConfig: TtsConfig = {
  enabled: false,
  provider: "disabled",
  serviceUrl: "http://localhost:50001",
  defaultInstruct: "",
  autoSynthesize: false,
  cacheEnabled: true,
  maxTextLength: 500,
  defaultFormat: "mp3",
  sampleRate: 22050,
};

function resolveConfigPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const apiRoot = resolve(__dirname, "../../..");
  const dataDir = join(apiRoot, "data");
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  return join(dataDir, "tts-config.json");
}

function loadFromFile(): TtsConfig | null {
  try {
    const path = resolveConfigPath();
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return { ...defaultConfig, ...parsed };
  } catch (err) {
    logger.warn({ err }, "failed to load TTS config from file");
    return null;
  }
}

function saveToFile(config: TtsConfig): TtsConfig {
  const path = resolveConfigPath();
  writeFileSync(path, JSON.stringify(config, null, 2), "utf-8");
  return config;
}

function buildInitialConfig(): TtsConfig {
  const fromFile = loadFromFile();

  const envEnabled = process.env.TTS_ENABLED;
  const envProvider = process.env.TTS_PROVIDER as TtsConfig["provider"] | undefined;
  const envServiceUrl = process.env.TTS_SERVICE_URL;

  if (fromFile) {
    if (envEnabled !== undefined) fromFile.enabled = envEnabled === "true";
    if (envProvider) fromFile.provider = envProvider;
    if (envServiceUrl) fromFile.serviceUrl = envServiceUrl;
    return fromFile;
  }

  return {
    ...defaultConfig,
    enabled: envEnabled === "true",
    provider: envProvider || defaultConfig.provider,
    serviceUrl: envServiceUrl || defaultConfig.serviceUrl,
  };
}

export class TtsConfigService {
  private config: TtsConfig = buildInitialConfig();

  getConfig(): TtsConfig {
    return this.config;
  }

  getView(): TtsConfigView {
    return { ...this.config };
  }

  update(next: Partial<TtsConfig>): TtsConfigView {
    this.config = saveToFile({ ...this.config, ...next });
    logger.info({ provider: this.config.provider, enabled: this.config.enabled }, "TTS config updated");
    return this.getView();
  }
}
