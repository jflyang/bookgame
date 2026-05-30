import { CharacterService } from "./characterService.js";
import { KnowledgeBaseService } from "./knowledgeBaseService.js";
import { ScenarioService } from "./scenarioService.js";
import { SkillIndex, type ParsedSkill, type ParsedAction, type ParsedReaction } from "./skillIndex.js";
import { parseAttackTargetsFromKnowledgeDocs, parseSkillsFromKnowledgeDocs, parseActionsFromKnowledgeDocs, parseReactionsFromKnowledgeDocs } from "./skillParser.js";
import { StoryPackageService } from "./storyPackageService.js";

export class StoryPackageActivator {
  constructor(
    private readonly storyPackages: StoryPackageService,
    private readonly characters: CharacterService,
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly scenarios: ScenarioService,
    private readonly skills: SkillIndex
  ) {}

  activate(storyPackageId: string) {
    const storyPackage = this.storyPackages.get(storyPackageId);
    const clonedCharacters = structuredClone(storyPackage.characters);

    // Merge attack targets from knowledge docs into character definitions
    const attackTargets = parseAttackTargetsFromKnowledgeDocs(storyPackage.knowledgeDocuments, clonedCharacters);
    for (const [characterId, targetIds] of attackTargets) {
      const character = clonedCharacters.find((c) => c.id === characterId);
      if (character) {
        const existing = new Set(character.attackableTargetIds ?? []);
        for (const tid of targetIds) existing.add(tid);
        character.attackableTargetIds = [...existing];
      }
    }

    this.characters.replaceAll(clonedCharacters);
    this.knowledgeBase.replaceAll(structuredClone(storyPackage.knowledgeDocuments));
    this.scenarios.replaceAll([structuredClone(storyPackage.scenario)]);

    // Legacy skills
    const fromDocs = parseSkillsFromKnowledgeDocs(storyPackage.knowledgeDocuments);
    const fromStructured: ParsedSkill[] = (storyPackage.skills ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      ownerId: s.ownerId,
      cost: s.cost,
      damage: s.damage,
      effect: s.effect,
    }));
    const merged = new Map<string, ParsedSkill>();
    for (const s of fromStructured) merged.set(s.id, s);
    for (const s of fromDocs) merged.set(s.id, s);
    this.skills.replaceAllSkills([...merged.values()]);

    // v2 Actions — from structured data + knowledge docs
    const actionsFromDocs = parseActionsFromKnowledgeDocs(storyPackage.knowledgeDocuments);
    const pkg = storyPackage as any;
    const actionsFromStructured: ParsedAction[] = (pkg.actions ?? []).map((a: any) => ({
      id: a.id,
      name: a.name,
      ownerId: a.ownerId,
      description: a.description,
    }));
    const mergedActions = new Map<string, ParsedAction>();
    for (const a of actionsFromStructured) mergedActions.set(a.id, a);
    for (const a of actionsFromDocs) mergedActions.set(a.id, a);
    this.skills.replaceAllActions([...mergedActions.values()]);

    // v2 Reactions — from structured data + knowledge docs
    const reactionsFromDocs = parseReactionsFromKnowledgeDocs(storyPackage.knowledgeDocuments);
    const reactionsFromStructured: ParsedReaction[] = (pkg.reactions ?? []).map((r: any) => ({
      id: r.id,
      ownerId: r.ownerId,
      name: r.name,
      trigger: r.trigger,
      description: r.description,
    }));
    const mergedReactions = new Map<string, ParsedReaction>();
    for (const r of reactionsFromStructured) mergedReactions.set(r.id, r);
    for (const r of reactionsFromDocs) mergedReactions.set(r.id, r);
    this.skills.replaceAllReactions([...mergedReactions.values()]);

    return storyPackage;
  }
}
