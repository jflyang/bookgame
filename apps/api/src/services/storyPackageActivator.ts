import { CharacterService } from "./characterService.js";
import { KnowledgeBaseService } from "./knowledgeBaseService.js";
import { ScenarioService } from "./scenarioService.js";
import { SkillIndex, type ParsedSkill } from "./skillIndex.js";
import { parseAttackTargetsFromKnowledgeDocs, parseSkillsFromKnowledgeDocs } from "./skillParser.js";
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
    this.skills.replaceAll([...merged.values()]);
    return storyPackage;
  }
}
