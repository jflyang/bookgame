import { llmStoryOutputSchema, type CharacterId, type LlmStoryOutput } from "@story-game/shared";
import { createModuleLogger } from "../utils/logger.js";

const logger = createModuleLogger("ruleChecker");

export class RuleChecker {
  validateOutput(speakerId: CharacterId, value: unknown, rosterIds?: CharacterId[]): LlmStoryOutput {
    try {
      const output = llmStoryOutputSchema.parse(value);
      if (output.speakerId !== speakerId) {
        if (rosterIds && rosterIds.includes(output.speakerId)) {
          logger.warn({ expected: speakerId, actual: output.speakerId }, "speaker mismatch but in roster — accepting LLM's choice");
        } else {
          throw new Error(`LLM speaker mismatch: expected ${speakerId}, got ${output.speakerId}`);
        }
      }
      return output;
    } catch (error) {
      if (error && typeof error === "object" && "issues" in error) {
        logger.warn({ speakerId, errors: (error as { issues: unknown }).issues }, "output validation failed");
      }
      throw error;
    }
  }
}
