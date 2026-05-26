import type { CharacterId, Skill } from "@story-game/shared";

export class SkillService {
  constructor(private readonly skills: Skill[]) {}

  list() {
    return this.skills;
  }

  listByOwner(ownerId: CharacterId) {
    return this.skills.filter((skill) => skill.ownerId === ownerId);
  }

  get(id: string) {
    return this.skills.find((skill) => skill.id === id);
  }

  replaceAll(next: Skill[]) {
    this.skills.splice(0, this.skills.length, ...next);
  }
}
