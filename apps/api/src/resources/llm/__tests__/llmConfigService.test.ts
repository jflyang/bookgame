import { describe, it, expect, beforeEach } from "vitest";
import { LlmConfigService } from "../llmConfigService.js";

describe("LlmConfigService", () => {
  let svc: LlmConfigService;

  beforeEach(() => {
    svc = new LlmConfigService();
    // Wipe the apiKey that may be inherited from the environment
    // so we get a clean baseline for isolation
    (svc as any).config.apiKey = undefined;
  });

  it("getConfig returns default config with mock provider", () => {
    const config = svc.getConfig();
    expect(config.provider).toBe("mock");
    expect(config.baseUrl).toBe("https://api.deepseek.com");
    expect(config.model).toBe("deepseek-v4-flash");
    expect(config.temperature).toBe(0.8);
    expect(config.maxTokens).toBe(800);
  });

  it("getView strips apiKey and adds hasApiKey", () => {
    const view = svc.getView();
    expect(view).not.toHaveProperty("apiKey");
    expect(view).toHaveProperty("hasApiKey");
    expect(view.provider).toBe("mock");
  });

  it("getView hasApiKey reflects whether config has an apiKey", () => {
    // With no key, hasApiKey should be false
    expect(svc.getView().hasApiKey).toBe(false);

    // After setting a key, hasApiKey should be true
    svc.update({ provider: "mock", baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash", temperature: 0.8, maxTokens: 800, apiKey: "sk-secret" });
    expect(svc.getView().hasApiKey).toBe(true);
  });

  it("update preserves existing apiKey when new key is not provided", () => {
    // Start with a known key
    svc.update({ provider: "deepseek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat", temperature: 0.7, maxTokens: 1024, apiKey: "sk-existing" });
    // Update without apiKey — should preserve the previous key
    svc.update({ provider: "deepseek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat", temperature: 0.7, maxTokens: 1024 });
    const config = svc.getConfig();
    expect(config.apiKey).toBe("sk-existing");
    expect(config.model).toBe("deepseek-chat");
    expect(config.temperature).toBe(0.7);
  });

  it("update preserves existing apiKey when new key is whitespace-only", () => {
    svc.update({ provider: "deepseek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat", temperature: 0.7, maxTokens: 1024, apiKey: "sk-existing" });
    svc.update({ provider: "deepseek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat", temperature: 0.7, maxTokens: 1024, apiKey: "   " });
    const config = svc.getConfig();
    expect(config.apiKey).toBe("sk-existing");
  });

  it("update sets new apiKey when provided", () => {
    svc.update({ provider: "deepseek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat", temperature: 0.7, maxTokens: 1024, apiKey: "sk-new" });
    const config = svc.getConfig();
    expect(config.apiKey).toBe("sk-new");
    expect(config.provider).toBe("deepseek");
    expect(config.model).toBe("deepseek-chat");
  });

  it("update changes provider, model, and other fields", () => {
    svc.update({ provider: "deepseek", baseUrl: "https://custom.com", model: "gpt-4", temperature: 0.5, maxTokens: 2048, apiKey: "sk-new" });
    const config = svc.getConfig();
    expect(config.provider).toBe("deepseek");
    expect(config.baseUrl).toBe("https://custom.com");
    expect(config.model).toBe("gpt-4");
    expect(config.temperature).toBe(0.5);
    expect(config.maxTokens).toBe(2048);
  });

  it("update returns the view (without apiKey, with hasApiKey)", () => {
    const view = svc.update({ provider: "mock", baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash", temperature: 0.8, maxTokens: 800 });
    expect(view).not.toHaveProperty("apiKey");
    expect(view).toHaveProperty("hasApiKey");
    expect(view.provider).toBe("mock");
  });
});
