import type { CharacterId } from "@story-game/shared";
import { CharacterService } from "./characterService.js";
import { KnowledgeBaseService } from "./knowledgeBaseService.js";

export class AgentService {
  constructor(
    private readonly characters: CharacterService,
    private readonly knowledgeBase: KnowledgeBaseService
  ) {}

  buildAgentContext(characterId: CharacterId, query: string) {
    const character = this.characters.get(characterId);
    const knowledgeHits = this.knowledgeBase.retrieve(characterId, character.knowledgeBaseIds, query);

    return {
      character,
      knowledgeHits
    };
  }
}
