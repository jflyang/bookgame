export interface ParsedSkill {
  id: string;
  name: string;
  ownerId: string;
  cost: { mp: number };
  damage?: { min: number; max: number };
  effect?: string;
}

export class SkillIndex {
  private skills = new Map<string, ParsedSkill>();

  replaceAll(skills: ParsedSkill[]) {
    this.skills.clear();
    for (const s of skills) this.skills.set(s.id, s);
  }

  get(id: string): ParsedSkill | undefined {
    return this.skills.get(id);
  }

  list(): ParsedSkill[] {
    return [...this.skills.values()];
  }

  clear() {
    this.skills.clear();
  }
}
