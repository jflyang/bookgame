import { CharacterService } from "./characterService.js";
import { KnowledgeBaseService } from "./knowledgeBaseService.js";
import { ScenarioService } from "./scenarioService.js";
import { SkillService } from "./skillService.js";
import { StoryPackageService } from "./storyPackageService.js";

export class StoryPackageActivator {
  constructor(
    private readonly storyPackages: StoryPackageService,
    private readonly characters: CharacterService,
    private readonly skills: SkillService,
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly scenarios: ScenarioService
  ) {}

  activate(storyPackageId: string) {
    const storyPackage = this.storyPackages.get(storyPackageId);
    this.characters.replaceAll(structuredClone(storyPackage.characters));
    this.skills.replaceAll(structuredClone(storyPackage.skills));
    this.knowledgeBase.replaceAll(structuredClone(storyPackage.knowledgeDocuments));
    this.scenarios.replaceAll([structuredClone(storyPackage.scenario)]);
    return storyPackage;
  }
}
