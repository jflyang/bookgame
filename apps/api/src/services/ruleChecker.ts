import { llmStoryOutputSchema, type CharacterId, type LlmStoryOutput } from "@story-game/shared";
import { createModuleLogger } from "../utils/logger.js";

const logger = createModuleLogger("ruleChecker");

export class RuleChecker {
  validateOutput(speakerId: CharacterId, value: unknown): LlmStoryOutput {
    try {
      const output = llmStoryOutputSchema.parse(value);
      if (output.speakerId !== speakerId) {
        throw new Error(`LLM speaker mismatch: expected ${speakerId}, got ${output.speakerId}`);
      }
      return output;
    } catch (error) {
      if (error && typeof error === "object" && "issues" in error) {
        logger.warn({ speakerId, errors: (error as { issues: unknown }).issues }, "output validation failed");
      }
      throw;
    }
  }
}
