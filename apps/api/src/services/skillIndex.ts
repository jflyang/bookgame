export interface ParsedSkill {
  id: string;
  name: string;
  ownerId: string;
  cost: { mp: number };
  damage?: { min: number; max: number };
  effect?: string;
}

// ─── v2: Action & Reaction types ───

export interface ParsedAction {
  id: string;
  name: string;
  ownerId: string;
  description: string;
}

export interface ParsedReaction {
  id: string;
  ownerId: string;
  name: string;
  trigger: string;
  description: string;
}

export class SkillIndex {
  // Legacy
  private skills = new Map<string, ParsedSkill>();
  // v2
  private actions = new Map<string, ParsedAction>();
  private reactions = new Map<string, ParsedReaction>();
  // reactions by ownerId
  private reactionsByOwner = new Map<string, ParsedReaction[]>();

  // ─── Legacy skills ───

  replaceAllSkills(skills: ParsedSkill[]) {
    this.skills.clear();
    for (const s of skills) this.skills.set(s.id, s);
  }

  getSkill(id: string): ParsedSkill | undefined {
    return this.skills.get(id);
  }

  listSkills(): ParsedSkill[] {
    return [...this.skills.values()];
  }

  // ─── v2 Actions ───

  replaceAllActions(actions: ParsedAction[]) {
    this.actions.clear();
    for (const a of actions) this.actions.set(a.id, a);
  }

  getAction(id: string): ParsedAction | undefined {
    return this.actions.get(id);
  }

  listActions(): ParsedAction[] {
    return [...this.actions.values()];
  }

  listActionsByOwner(ownerId: string): ParsedAction[] {
    return this.listActions().filter((a) => a.ownerId === ownerId);
  }

  // ─── v2 Reactions ───

  replaceAllReactions(reactions: ParsedReaction[]) {
    this.reactions.clear();
    this.reactionsByOwner.clear();
    for (const r of reactions) {
      this.reactions.set(r.id, r);
      const byOwner = this.reactionsByOwner.get(r.ownerId) || [];
      byOwner.push(r);
      this.reactionsByOwner.set(r.ownerId, byOwner);
    }
  }

  getReaction(id: string): ParsedReaction | undefined {
    return this.reactions.get(id);
  }

  listReactions(): ParsedReaction[] {
    return [...this.reactions.values()];
  }

  listReactionsByOwner(ownerId: string): ParsedReaction[] {
    return this.reactionsByOwner.get(ownerId) || [];
  }

  /** Find reactions triggered by a given action name, for a specific target character */
  findReactions(triggerActionName: string, targetOwnerId: string): ParsedReaction[] {
    return this.listReactionsByOwner(targetOwnerId)
      .filter((r) => r.trigger === triggerActionName);
  }

  // ─── Convenience: all actions/reactions ───

  // Legacy compat
  get(id: string): ParsedSkill | undefined { return this.getSkill(id); }
  list(): ParsedSkill[] { return this.listSkills(); }
  replaceAll(skills: ParsedSkill[]) { this.replaceAllSkills(skills); }

  clear() {
    this.skills.clear();
    this.actions.clear();
    this.reactions.clear();
    this.reactionsByOwner.clear();
  }
}
