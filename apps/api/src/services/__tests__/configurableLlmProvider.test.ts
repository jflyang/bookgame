import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConfigurableLlmProvider } from "../../resources/llm/configurableLlmProvider.js";
import type { LlmConfigService } from "../../resources/llm/llmConfigService.js";
import type { LlmProvider, LlmCompletionResult } from "../../resources/llm/llmProvider.js";
import type { LlmConfig } from "@story-game/shared";

function makeConfig(overrides: Partial<LlmConfig> = {}): LlmConfig {
  return {
    provider: "mock",
    baseUrl: "https://api.example.com",
    model: "test-model",
    temperature: 0.5,
    maxTokens: 500,
    ...overrides,
  };
}

const completionResult: LlmCompletionResult = {
  output: {
    speakerId: "qiaofeng",
    narration: "Test",
    dialogue: "Hi",
    action: { type: "observe", targetIds: [] },
    stateDeltaSuggestion: {},
  },
  raw: '{"narration":"Test"}',
};

describe("ConfigurableLlmProvider", () => {
  let provider: ConfigurableLlmProvider;
  let mockConfigService: LlmConfigService;
  let mockProviderA: LlmProvider;
  let mockProviderB: LlmProvider;
  let providers: Record<string, LlmProvider>;

  beforeEach(() => {
    mockConfigService = {
      getConfig: vi.fn().mockReturnValue(makeConfig({ provider: "providerA" })),
      getView: vi.fn(),
      update: vi.fn(),
    } as unknown as LlmConfigService;

    mockProviderA = {
      complete: vi.fn().mockResolvedValue(completionResult),
      stream: vi.fn().mockImplementation(async function* () {
        yield "tokenA";
      }),
    };

    mockProviderB = {
      complete: vi.fn().mockResolvedValue(completionResult),
      stream: vi.fn().mockImplementation(async function* () {
        yield "tokenB";
      }),
    };

    providers = { providerA: mockProviderA, providerB: mockProviderB };
    provider = new ConfigurableLlmProvider(mockConfigService, providers);
  });

  it("delegates complete() to the current provider", async () => {
    const result = await provider.complete({
      speakerId: "qiaofeng",
      prompt: "Hi",
    });

    expect(mockProviderA.complete).toHaveBeenCalledWith({
      speakerId: "qiaofeng",
      prompt: "Hi",
    });
    expect(result).toBe(completionResult);
  });

  it("delegates stream() to the current provider", async () => {
    const tokens: string[] = [];
    for await (const token of provider.stream({
      speakerId: "qiaofeng",
      prompt: "Hi",
    })) {
      tokens.push(token);
    }

    expect(mockProviderA.stream).toHaveBeenCalledWith({
      speakerId: "qiaofeng",
      prompt: "Hi",
    });
    expect(tokens).toEqual(["tokenA"]);
  });

  it("switches provider when config changes", async () => {
    (mockConfigService.getConfig as ReturnType<typeof vi.fn>).mockReturnValue(
      makeConfig({ provider: "providerB" })
    );

    const result = await provider.complete({
      speakerId: "xuzhu",
      prompt: "Hello",
    });

    expect(mockProviderB.complete).toHaveBeenCalled();
    expect(mockProviderA.complete).not.toHaveBeenCalled();
    expect(result).toBe(completionResult);
  });

  it("throws for unknown provider", async () => {
    (mockConfigService.getConfig as ReturnType<typeof vi.fn>).mockReturnValue(
      makeConfig({ provider: "nonexistent" })
    );

    await expect(async () => {
      await provider.complete({ speakerId: "qiaofeng", prompt: "Hi" });
    }).rejects.toThrow("Unsupported LLM provider: nonexistent");
  });

  it("reads config on every call for dynamic switching", async () => {
    await provider.complete({ speakerId: "qiaofeng", prompt: "A" });

    (mockConfigService.getConfig as ReturnType<typeof vi.fn>).mockReturnValue(
      makeConfig({ provider: "providerB" })
    );

    await provider.complete({ speakerId: "xuzhu", prompt: "B" });

    expect(mockProviderA.complete).toHaveBeenCalledTimes(1);
    expect(mockProviderB.complete).toHaveBeenCalledTimes(1);
  });
});
