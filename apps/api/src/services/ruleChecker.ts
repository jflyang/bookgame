import { llmStoryOutputSchema, type CharacterId, type LlmStoryOutput } from "@story-game/shared";

export class RuleChecker {
  validateOutput(speakerId: CharacterId, value: unknown): LlmStoryOutput {
    const output = llmStoryOutputSchema.parse(value);
    if (output.speakerId !== speakerId) {
      throw new Error(`LLM speaker mismatch: expected ${speakerId}, got ${output.speakerId}`);
    }
    return output;
  }
}
