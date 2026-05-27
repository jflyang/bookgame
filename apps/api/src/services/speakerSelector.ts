import type { CharacterId, SendMessageRequest } from "@story-game/shared";
import type { CharacterService } from "./characterService.js";
import type { GameStateService } from "./gameStateService.js";
import { createModuleLogger } from "../utils/logger.js";

const logger = createModuleLogger("speakerSelector");
const continueTexts = new Set(["继续", "接着", "然后呢", "continue", "go on"]);

export class SpeakerSelector {
  constructor(
    private readonly characters: CharacterService,
    private readonly states: GameStateService
  ) {}

  select(sessionId: string, input: SendMessageRequest, defaultSpeakerId?: string): CharacterId {
    if (input.targetCharacterId) {
      logger.debug({ reason: "targetCharacterId", speakerId: input.targetCharacterId }, "speaker selected");
      return input.targetCharacterId;
    }

    const mention = this.characters.list().find((character) => input.text.includes(`@${character.name}`));
    if (mention) {
      logger.debug({ reason: "@mention", speakerId: mention.id }, "speaker selected");
      return mention.id;
    }

    if (continueTexts.has(input.text.trim().toLowerCase())) {
      const chosen = this.randomSpeakerExcept(this.states.get(sessionId).lastSpeakerId);
      logger.debug({ reason: "continue", speakerId: chosen, lastSpeakerId: this.states.get(sessionId).lastSpeakerId }, "speaker selected");
      return chosen;
    }

    const fallback = defaultSpeakerId ?? this.characters.list()[0]?.id ?? "qiaofeng";
    logger.debug({ reason: "default", speakerId: fallback }, "speaker selected");
    return fallback;
  }

  private randomSpeakerExcept(lastSpeakerId: CharacterId | null): CharacterId {
    const roster = this.characters.list().map((character) => character.id);
    const candidates = roster.filter((id) => id !== lastSpeakerId);
    const pool = candidates.length > 0 ? candidates : roster;
    return pool[Math.floor(Math.random() * pool.length)] ?? "qiaofeng";
  }
}
