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
    const reasoningContent = msg?.reasoning_content;
    if (!content && !reasoningContent) {
      const finishReason = data.choices?.[0]?.finish_reason;
      const usage = data.usage;
      throw new Error(
        `DeepSeek 返回空内容（finish_reason: ${finishReason ?? "N/A"}, ` +
        `prompt_tokens: ${usage?.prompt_tokens ?? "?"}, completion_tokens: ${usage?.completion_tokens ?? "?"}）。` +
        `可能是 max_tokens 不够或模型不支持 response_format。`
      );
    }

    const latency = Date.now() - start;
    logger.info({ model: config.model, latency }, "llm complete");

    // Prefer content; if content is empty or has empty narration/dialogue, try extracting JSON from reasoning_content
    let parsed: unknown;
    const rawContent = content || "";
    if (rawContent) {
      try {
        parsed = JSON.parse(rawContent);
      } catch (err) {
        // If content is not valid JSON, try to extract JSON from it
        const jsonMatch = rawContent.match(/\{[\s\S]*"speakerId"[\s\S]*\}/);
        if (jsonMatch) {
          try { parsed = JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
        }
        if (!parsed) {
          throw new Error(`DeepSeek 返回了非 JSON 内容（前 200 字符）: ${rawContent.slice(0, 200)}`, { cause: err });
        }
      }
    }

    // If parsed JSON has empty narration/dialogue but reasoning_content has useful text, extract from reasoning
    if (parsed && typeof parsed === "object" && reasoningContent) {
      const obj = parsed as Record<string, unknown>;
      if (!obj.narration || (typeof obj.narration === "string" && obj.narration.trim() === "")) {
        const extracted = extractJsonFromText(reasoningContent);
        if (extracted && extracted.narration && extracted.dialogue) {
          parsed = extracted;
          logger.info("extracted valid output from reasoning_content (empty narration fallback)");
        }
      }
    }

    // If still no parsed content and we only have reasoning, try to extract JSON from reasoning
    if (!parsed && reasoningContent) {
      const extracted = extractJsonFromText(reasoningContent);
      if (extracted) {
        parsed = extracted;
        logger.info("extracted valid output from reasoning_content (no content fallback)");
      }
      if (!parsed) {
        throw new Error(`DeepSeek content 为空，reasoning_content 中未找到有效 JSON`);
      }
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
      raw: rawContent || reasoningContent || "",
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
    let contentBuffer = "";
    let reasoningBuffer = "";

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
          if (payload === "[DONE]") {
            // If content is empty but reasoning has JSON, extract and yield it
            if (!contentBuffer && reasoningBuffer) {
              const extracted = extractJsonFromText(reasoningBuffer);
              if (extracted) {
                const fallbackJson = JSON.stringify(extracted);
                logger.info("stream: extracted JSON from reasoning_content (empty content fallback)");
                yield fallbackJson;
              }
            }
            return;
          }

          try {
            const parsed = JSON.parse(payload);
            const delta = parsed?.choices?.[0]?.delta;
            const content = delta?.content as string | undefined;
            const reasoning = delta?.reasoning_content as string | undefined;

            // Collect reasoning_content as fallback
            if (reasoning) {
              reasoningBuffer += reasoning;
            }

            // Only yield content (the actual JSON output)
            if (content) {
              contentBuffer += content;
              yield content;
            }
          } catch (err) {
            logger.warn({ err, payload: payload.slice(0, 120) }, "unparseable SSE data line");
          }
        }
      }
      // Stream ended without [DONE] — try fallback from reasoning if content is empty
      if (!contentBuffer && reasoningBuffer) {
        const extracted = extractJsonFromText(reasoningBuffer);
        if (extracted) {
          const fallbackJson = JSON.stringify(extracted);
          logger.info("stream: extracted JSON from reasoning_content (stream ended without DONE)");
          yield fallbackJson;
        }
      }
    } finally {
      reader.releaseLock();
    }
    logger.info({ model: config.model, latency: Date.now() - start }, "llm stream complete");
  }
}

/** Extract a valid JSON object containing speakerId/narration/dialogue from mixed text.
 *  Handles reasoning_content that contains the model's thinking + a JSON block. */
function extractJsonFromText(text: string): Record<string, unknown> | null {
  // Strategy 1: Find JSON blocks delimited by ```json ... ``` or ``` ... ```
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      if (parsed.speakerId && parsed.narration) return parsed;
    } catch { /* continue */ }
  }

  // Strategy 2: Find balanced braces starting from each { that precedes "speakerId"
  const indices: number[] = [];
  let searchFrom = 0;
  while (true) {
    const idx = text.indexOf('"speakerId"', searchFrom);
    if (idx === -1) break;
    // Walk back to find the opening {
    let braceStart = text.lastIndexOf("{", idx);
    if (braceStart !== -1) indices.push(braceStart);
    searchFrom = idx + 1;
  }

  for (const start of indices) {
    // Find matching closing brace
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(start, i + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (parsed.speakerId && parsed.narration) return parsed;
          } catch { /* try next */ }
          break;
        }
      }
    }
  }

  return null;
}