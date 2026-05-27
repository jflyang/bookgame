import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { DeepSeekLlmProvider } from "../../resources/llm/deepSeekLlmProvider.js";
import type { LlmConfigService } from "../../resources/llm/llmConfigService.js";
import type { LlmConfig } from "@story-game/shared";

function makeConfig(overrides: Partial<LlmConfig> = {}): LlmConfig {
  return {
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    temperature: 0.8,
    maxTokens: 800,
    apiKey: "sk-test-key",
    ...overrides,
  };
}

const validJsonOutput = JSON.stringify({
  speakerId: "qiaofeng",
  narration: "He strikes",
  dialogue: "Take this!",
  action: { type: "skill", skillId: "test", targetIds: ["xuzhu"] },
  stateDeltaSuggestion: {},
});

describe("DeepSeekLlmProvider", () => {
  let provider: DeepSeekLlmProvider;
  let mockConfigService: LlmConfigService;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockConfigService = {
      getConfig: vi.fn().mockReturnValue(makeConfig()),
      getView: vi.fn(),
      update: vi.fn(),
    } as unknown as LlmConfigService;

    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    provider = new DeepSeekLlmProvider(mockConfigService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ---------------------------------------------------------------------------
  // complete()
  // ---------------------------------------------------------------------------

  it("complete() throws if no API key configured", async () => {
    (mockConfigService.getConfig as ReturnType<typeof vi.fn>).mockReturnValue(
      makeConfig({ apiKey: undefined })
    );

    await expect(
      provider.complete({ speakerId: "qiaofeng", prompt: "Hello" })
    ).rejects.toThrow("DeepSeek API key is not configured");
  });

  it("complete() returns parsed result on success", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: { content: validJsonOutput },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 },
        }),
    });

    const result = await provider.complete({
      speakerId: "qiaofeng",
      prompt: "Hello",
    });

    expect(result.output.speakerId).toBe("qiaofeng");
    expect(result.output.narration).toBe("He strikes");
    expect(result.output.dialogue).toBe("Take this!");
    expect(result.raw).toBe(validJsonOutput);
    expect(result.usage).toEqual({ promptTokens: 50, completionTokens: 100 });
  });

  it("complete() sends correct request body", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: validJsonOutput } }],
        }),
    });

    await provider.complete({ speakerId: "qiaofeng", prompt: "Hello" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, options] = fetchSpy.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({
      Authorization: "Bearer sk-test-key",
      "Content-Type": "application/json",
    });

    const body = JSON.parse(options.body);
    expect(body.model).toBe("deepseek-v4-flash");
    expect(body.temperature).toBe(0.8);
    expect(body.max_tokens).toBe(800);
    expect(body.stream).toBeUndefined();
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].role).toBe("user");
    expect(body.messages[1].content).toBe("Hello");
  });

  it("complete() throws on non-ok response", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    await expect(
      provider.complete({ speakerId: "qiaofeng", prompt: "Hello" })
    ).rejects.toThrow("DeepSeek request failed: 401 Unauthorized");
  });

  it("complete() throws on empty content with finish_reason", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: { content: null, reasoning_content: null },
              finish_reason: "length",
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 0, total_tokens: 100 },
        }),
    });

    await expect(
      provider.complete({ speakerId: "qiaofeng", prompt: "Test" })
    ).rejects.toThrow("DeepSeek 返回空内容（finish_reason: length");
  });

  it("complete() uses reasoning_content when content is absent", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: null,
                reasoning_content: validJsonOutput,
              },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 },
        }),
    });

    const result = await provider.complete({
      speakerId: "qiaofeng",
      prompt: "Think step by step",
    });

    expect(result.output.speakerId).toBe("qiaofeng");
    expect(result.raw).toBe(validJsonOutput);
  });

  // ---------------------------------------------------------------------------
  // stream()
  // ---------------------------------------------------------------------------

  it("stream() throws if no API key configured", async () => {
    (mockConfigService.getConfig as ReturnType<typeof vi.fn>).mockReturnValue(
      makeConfig({ apiKey: undefined })
    );

    const iter = provider.stream({ speakerId: "qiaofeng", prompt: "Hi" });
    await expect(iter.next()).rejects.toThrow("DeepSeek API key is not configured");
  });

  it("stream() yields content chunks from SSE", async () => {
    const encoder = new TextEncoder();
    const chunks = [
      encoder.encode(
        'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n'
      ),
      encoder.encode(
        'data: {"choices":[{"delta":{"content":"World"}}]}\n\n'
      ),
      encoder.encode("data: [DONE]\n\n"),
    ];

    let readIndex = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (readIndex < chunks.length) {
          return Promise.resolve({
            done: false,
            value: chunks[readIndex++],
          });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
      releaseLock: vi.fn(),
    };

    fetchSpy.mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    });

    const tokens: string[] = [];
    for await (const token of provider.stream({
      speakerId: "qiaofeng",
      prompt: "Hi",
    })) {
      tokens.push(token);
    }

    expect(tokens).toEqual(["Hello ", "World"]);
    expect(mockReader.releaseLock).toHaveBeenCalled();
  });

  it("stream() handles delta.reasoning_content", async () => {
    const encoder = new TextEncoder();
    const chunks = [
      encoder.encode(
        'data: {"choices":[{"delta":{"reasoning_content":"思考中..."}}]}\n\n'
      ),
      encoder.encode(
        'data: {"choices":[{"delta":{"content":"结果"}}]}\n\n'
      ),
      encoder.encode("data: [DONE]\n\n"),
    ];

    let readIndex = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (readIndex < chunks.length) {
          return Promise.resolve({
            done: false,
            value: chunks[readIndex++],
          });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
      releaseLock: vi.fn(),
    };

    fetchSpy.mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    });

    const tokens: string[] = [];
    for await (const token of provider.stream({
      speakerId: "qiaofeng",
      prompt: "Think",
    })) {
      tokens.push(token);
    }

    expect(tokens).toEqual(["思考中...", "结果"]);
  });

  it("stream() throws on non-ok response", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve("Rate limited"),
    });

    const iter = provider.stream({ speakerId: "qiaofeng", prompt: "Hi" });
    await expect(iter.next()).rejects.toThrow(
      "DeepSeek stream request failed: 429 Rate limited"
    );
  });

  it("stream() sends stream: true in request body", async () => {
    const mockReader = {
      read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
      releaseLock: vi.fn(),
    };
    fetchSpy.mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    });

    const iter = provider.stream({ speakerId: "qiaofeng", prompt: "Hi" });
    await iter.next();

    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.stream).toBe(true);
  });

  it("stream() skips unparseable SSE lines gracefully", async () => {
    const encoder = new TextEncoder();
    const chunks = [
      encoder.encode("data: invalid json\n\n"),
      encoder.encode(
        'data: {"choices":[{"delta":{"content":"OK"}}]}\n\n'
      ),
      encoder.encode("data: [DONE]\n\n"),
    ];

    let readIndex = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (readIndex < chunks.length) {
          return Promise.resolve({
            done: false,
            value: chunks[readIndex++],
          });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
      releaseLock: vi.fn(),
    };

    fetchSpy.mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    });

    const tokens: string[] = [];
    for await (const token of provider.stream({
      speakerId: "qiaofeng",
      prompt: "Hi",
    })) {
      tokens.push(token);
    }

    expect(tokens).toEqual(["OK"]);
  });
});
