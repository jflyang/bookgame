import { describe, it, expect } from "vitest";
import { MockLlmProvider } from "../../resources/llm/mockLlmProvider.js";

describe("MockLlmProvider", () => {
  const provider = new MockLlmProvider();

  it("complete() returns expected format with speakerId, narration, dialogue, action", async () => {
    const result = await provider.complete({
      speakerId: "qiaofeng",
      prompt: "Hello",
    });

    expect(result.output).toHaveProperty("speakerId", "qiaofeng");
    expect(result.output).toHaveProperty("narration");
    expect(result.output).toHaveProperty("dialogue");
    expect(result.output).toHaveProperty("action");
    expect(result.output).toHaveProperty("stateDeltaSuggestion");
    expect(typeof result.output.narration).toBe("string");
    expect(result.output.narration.length).toBeGreaterThan(0);
    expect(typeof result.output.dialogue).toBe("string");
    expect(result.output.dialogue.length).toBeGreaterThan(0);
    expect(result.raw).toBe(JSON.stringify(result.output));
  });

  it("complete() returns character-specific samples by speakerId", async () => {
    const xuzhuResult = await provider.complete({
      speakerId: "xuzhu",
      prompt: "Hi",
    });
    expect(xuzhuResult.output.speakerId).toBe("xuzhu");
    expect(xuzhuResult.output.dialogue).toContain("小僧");

    const duanyuResult = await provider.complete({
      speakerId: "duanyu",
      prompt: "Hi",
    });
    expect(duanyuResult.output.speakerId).toBe("duanyu");
    expect(duanyuResult.output.dialogue).toContain("乔兄");

    const dingchunqiuResult = await provider.complete({
      speakerId: "dingchunqiu",
      prompt: "Hi",
    });
    expect(dingchunqiuResult.output.speakerId).toBe("dingchunqiu");
  });

  it("complete() falls back to duanyu for unknown speakerId", async () => {
    const result = await provider.complete({
      speakerId: "unknown_character",
      prompt: "Hello",
    });

    // The samples object doesn't have "unknown_character", so it falls back to duanyu
    // but the output speakerId is still set from the input
    expect(result.output.speakerId).toBe("unknown_character");
    expect(result.output.narration).toBeTruthy();
    expect(result.output.dialogue).toBeTruthy();
  });

  it("stream() yields concatenated narration and dialogue", async () => {
    const tokens: string[] = [];
    for await (const token of provider.stream({
      speakerId: "qiaofeng",
      prompt: "Hi",
    })) {
      tokens.push(token);
    }

    expect(tokens).toHaveLength(1);
    const content = tokens[0];
    expect(content).toContain("乔峰踏前半步");
    expect(content).toContain("虚竹，守住他退路");
  });

  it("stream() for different speaker returns different content", async () => {
    const tokens: string[] = [];
    for await (const token of provider.stream({
      speakerId: "xuzhu",
      prompt: "Hi",
    })) {
      tokens.push(token);
    }

    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toContain("虚竹合掌运气");
  });

  it("complete() returns default action for characters without explicit sample", async () => {
    // duanyu uses "observe" action type
    const result = await provider.complete({
      speakerId: "duanyu",
      prompt: "Hi",
    });

    expect(result.output.action.type).toBe("observe");
  });
});
