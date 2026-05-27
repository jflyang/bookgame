import type { LlmStoryOutput } from "@story-game/shared";

export interface LlmRequest {
  speakerId: string;
  prompt: string;
}

export interface LlmCompletionResult {
  output: LlmStoryOutput;
  raw: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface LlmProvider {
  complete(input: LlmRequest): Promise<LlmCompletionResult>;
  stream(input: LlmRequest): AsyncIterable<string>;
}
