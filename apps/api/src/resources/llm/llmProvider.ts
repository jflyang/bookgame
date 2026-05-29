import type { LlmStoryOutput } from "@story-game/shared";

export interface LlmRequest {
  speakerId: string;
  prompt: string;
  /** Stable system-level prompt (character persona, rules, skills, stage info).
   *  Separated from dynamic `prompt` to enable DeepSeek prefix caching. */
  systemPrompt?: string;
}

export interface LlmCompletionResult {
  output: LlmStoryOutput;
  raw: string;
  usage?: { promptTokens: number; completionTokens: number };
}

/** Returned by LlmProvider.stream() — yields tokens + exposes final usage after completion. */
export interface LlmStreamResult {
  tokens: AsyncIterable<string>;
  /** Returns the token usage reported by the LLM API after the stream completes.
   *  Returns null if usage data is not available (e.g., stream error or provider doesn't report). */
  getUsage(): { promptTokens: number; completionTokens: number } | null;
}

export interface LlmProvider {
  complete(input: LlmRequest): Promise<LlmCompletionResult>;
  stream(input: LlmRequest): LlmStreamResult;
}
