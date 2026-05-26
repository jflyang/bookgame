import type { Character, CharacterId } from "@story-game/shared";

export class CharacterService {
  constructor(private readonly characters: Character[]) {}

  list() {
    return this.characters;
  }

  get(id: CharacterId) {
    const character = this.characters.find((item) => item.id === id);
    if (!character) throw new Error(`Character not found: ${id}`);
    return character;
  }

  update(id: CharacterId, next: Character) {
    if (next.id !== id) throw new Error("Character id cannot be changed");
    const index = this.characters.findIndex((item) => item.id === id);
    if (index < 0) throw new Error(`Character not found: ${id}`);
    this.characters[index] = next;
    return next;
  }

  replaceAll(next: Character[]) {
    this.characters.splice(0, this.characters.length, ...next);
  }
}
