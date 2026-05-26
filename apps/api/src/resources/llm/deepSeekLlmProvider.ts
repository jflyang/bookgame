import { llmStoryOutputSchema, type LlmStoryOutput } from "@story-game/shared";
import type { LlmConfigService } from "./llmConfigService.js";
import type { LlmProvider, LlmRequest } from "./llmProvider.js";
import { createModuleLogger } from "../../utils/logger.js";

const logger = createModuleLogger("llm:deepseek");

interface DeepSeekChoice {
  message?: {
    content?: string;
  };
}

interface DeepSeekResponse {
  choices?: DeepSeekChoice[];
}

export class DeepSeekLlmProvider implements LlmProvider {
  constructor(private readonly configService: LlmConfigService) {}

  async complete(input: LlmRequest): Promise<LlmStoryOutput> {
    const config = this.configService.getConfig();
    if (!config.apiKey) {
      throw new Error("DeepSeek API key is not configured");
    }

    const start = Date.now();
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "你是互动故事游戏的单角色叙事引擎。必须只输出严格 JSON，不要输出 Markdown。"
          },
          {
            role: "user",
            content: input.prompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek request failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as DeepSeekResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("DeepSeek response did not include message content");

    logger.info({ model: config.model, latency: Date.now() - start }, "llm complete");
    return llmStoryOutputSchema.parse(JSON.parse(content));
  }

  async *stream(input: LlmRequest): AsyncIterable<string> {
    const config = this.configService.getConfig();
    if (!config.apiKey) {
      throw new Error("DeepSeek API key is not configured");
    }

    const start = Date.now();
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: true,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "你是互动故事游戏的单角色叙事引擎。必须只输出严格 JSON，不要输出 Markdown。"
          },
          {
            role: "user",
            content: input.prompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek stream request failed: ${response.status} ${await response.text()}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("DeepSeek stream response missing body");

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;

          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") return;

          try {
            const parsed = JSON.parse(payload);
            const content = parsed?.choices?.[0]?.delta?.content as string | undefined;
            if (content) yield content;
          } catch {
            // skip unparseable lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    logger.info({ model: config.model, latency: Date.now() - start }, "llm stream complete");
  }
}
