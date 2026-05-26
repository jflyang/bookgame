import type { LlmStoryOutput } from "@story-game/shared";

export interface LlmRequest {
  speakerId: string;
  prompt: string;
}

export interface LlmProvider {
  complete(input: LlmRequest): Promise<LlmStoryOutput>;
  stream(input: LlmRequest): AsyncIterable<string>;
}
