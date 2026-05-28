import { llmStoryOutputSchema } from "@story-game/shared";
import type { LlmConfigService } from "./llmConfigService.js";
import type { LlmCompletionResult, LlmProvider, LlmRequest } from "./llmProvider.js";
import { createModuleLogger } from "../../utils/logger.js";

const logger = createModuleLogger("llm:deepseek");

interface DeepSeekChoice {
  message?: {
    content?: string;
    reasoning_content?: string;
  };
  finish_reason?: string;
}

interface DeepSeekUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface DeepSeekResponse {
  choices?: DeepSeekChoice[];
  usage?: DeepSeekUsage;
}

export class DeepSeekLlmProvider implements LlmProvider {
  constructor(private readonly configService: LlmConfigService) {}

  async complete(input: LlmRequest): Promise<LlmCompletionResult> {
    const config = this.configService.getConfig();
    if (!config.apiKey) {
      throw new Error("DeepSeek API key is not configured");
    }

    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    let response: Response;
    try {
      response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
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
              content: "你是互动故事游戏的单角色叙事引擎。必须只输出严格 JSON，不要输出 Markdown。输出格式：{\"speakerId\":\"角色id\",\"narration\":\"旁白叙述\",\"dialogue\":\"角色对话\",\"action\":{\"type\":\"skill|observe|command|defend|escape\",\"skillId\":\"技能中文名(仅type=skill时填写,从可用技能列表中选,非skill类型省略此字段)\",\"targetIds\":[\"英文角色ID\"]},\"stateDeltaSuggestion\":{\"角色ID_hp\":-35,\"角色ID_mp\":-20},\"stageSuggestion\":\"阶段名(可选)\"}"
            },
            {
              role: "user",
              content: input.prompt
            }
          ]
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`DeepSeek request failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as DeepSeekResponse;
    const msg = data.choices?.[0]?.message;
    const content = msg?.content;
    if (!content) {
      const finishReason = data.choices?.[0]?.finish_reason;
      const usage = data.usage;
      const hasReasoning = !!msg?.reasoning_content;
      throw new Error(
        `DeepSeek 返回空内容（finish_reason: ${finishReason ?? "N/A"}, ` +
        `prompt_tokens: ${usage?.prompt_tokens ?? "?"}, completion_tokens: ${usage?.completion_tokens ?? "?"}` +
        `${hasReasoning ? ", has reasoning_content but no content" : ""}）。` +
        `可能是 max_tokens 不够或模型不支持 response_format。`
      );
    }

    const latency = Date.now() - start;
    logger.info({ model: config.model, latency }, "llm complete");

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new Error(`DeepSeek 返回了非 JSON 内容（前 200 字符）: ${content.slice(0, 200)}`, { cause: err });
    }

    // Fallback: ensure action is a valid object with required type field
    if (parsed && typeof parsed === "object" && "action" in parsed) {
      const action = (parsed as Record<string, unknown>).action;
      // If action is a string (e.g. "observe") or array, replace with default object
      if (typeof action === "string" || Array.isArray(action)) {
        (parsed as Record<string, unknown>).action = { type: "observe", targetIds: [] };
      } else if (action && typeof action === "object" && !("type" in action)) {
        (action as Record<string, unknown>).type = "observe";
        (action as Record<string, unknown>).targetIds = (action as Record<string, unknown>).targetIds ?? [];
      }
    }

    const output = llmStoryOutputSchema.parse(parsed);
    return {
      output,
      raw: content,
      usage: data.usage ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens } : undefined
    };
  }

  async *stream(input: LlmRequest): AsyncIterable<string> {
    const config = this.configService.getConfig();
    if (!config.apiKey) {
      throw new Error("DeepSeek API key is not configured");
    }

    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    let response: Response;
    try {
      response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
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
              content: "你是互动故事游戏的单角色叙事引擎。必须只输出严格 JSON，不要输出 Markdown。输出格式：{\"speakerId\":\"角色id\",\"narration\":\"旁白叙述\",\"dialogue\":\"角色对话\",\"action\":{\"type\":\"skill|observe|command|defend|escape\",\"skillId\":\"技能中文名(仅type=skill时填写,从可用技能列表中选,非skill类型省略此字段)\",\"targetIds\":[\"英文角色ID\"]},\"stateDeltaSuggestion\":{\"角色ID_hp\":-35,\"角色ID_mp\":-20},\"stageSuggestion\":\"阶段名(可选)\"}"
            },
            {
              role: "user",
              content: input.prompt
            }
          ]
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

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
            const delta = parsed?.choices?.[0]?.delta;
            // Only yield actual content, ignore reasoning_content (model's internal thinking)
            const content = delta?.content as string | undefined;
            if (content) yield content;
          } catch (err) {
            logger.warn({ err, payload: payload.slice(0, 120) }, "unparseable SSE data line");
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    logger.info({ model: config.model, latency: Date.now() - start }, "llm stream complete");
  }
}
