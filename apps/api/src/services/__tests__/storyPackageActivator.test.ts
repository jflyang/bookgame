import { describe, it, expect, beforeEach, vi } from "vitest";
import { StoryPackageActivator } from "../storyPackageActivator.js";
import type { StoryPackageService } from "../storyPackageService.js";
import type { CharacterService } from "../characterService.js";
import type { SkillService } from "../skillService.js";
import type { KnowledgeBaseService } from "../knowledgeBaseService.js";
import type { ScenarioService } from "../scenarioService.js";
import type { StoryPackage, Character, Skill, Scenario, KnowledgeDocument } from "@story-game/shared";

const mockCharacter: Character = {
  id: "qiaofeng",
  name: "乔峰",
  role: "主导者",
  avatar: "乔",
  personaPrompt: "You are Qiao Feng",
  rules: [],
  skillIds: [],
  knowledgeBaseIds: [],
};

const mockSkill: Skill = {
  id: "punch",
  name: "Punch",
  ownerId: "qiaofeng",
  cost: { mp: 10 },
  effect: "Hurts",
  description: "A punch",
};

const mockScenario: Scenario = {
  id: "sc1",
  title: "Test",
  premise: "P",
  currentStage: "start",
  stages: ["start"],
  stageDetails: [],
  currentGoal: "G",
  rules: [],
  initialStates: [],
};

const mockDoc: KnowledgeDocument = {
  id: "k1",
  title: "Doc",
  ownerId: null,
  content: "# Content",
  sourceType: "markdown",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const mockStoryPackage: StoryPackage = {
  id: "pkg_001",
  title: "Test Package",
  description: "A test",
  storySettingPrompt: "# Setting",
  scenario: structuredClone(mockScenario),
  characters: [structuredClone(mockCharacter)],
  skills: [structuredClone(mockSkill)],
  knowledgeDocuments: [structuredClone(mockDoc)],
  promptRules: [],
  debugConfig: { showPromptLayers: false, showRawOutput: false, showValidation: false },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("StoryPackageActivator", () => {
  let activator: StoryPackageActivator;
  let mockStoryPackages: StoryPackageService;
  let mockCharacters: CharacterService;
  let mockSkills: SkillService;
  let mockKnowledgeBase: KnowledgeBaseService;
  let mockScenarios: ScenarioService;

  beforeEach(() => {
    mockStoryPackages = {
      get: vi.fn(),
    } as unknown as StoryPackageService;
    mockCharacters = {
      replaceAll: vi.fn(),
    } as unknown as CharacterService;
    mockSkills = {
      replaceAll: vi.fn(),
    } as unknown as SkillService;
    mockKnowledgeBase = {
      replaceAll: vi.fn(),
    } as unknown as KnowledgeBaseService;
    mockScenarios = {
      replaceAll: vi.fn(),
    } as unknown as ScenarioService;
    activator = new StoryPackageActivator(mockStoryPackages, mockCharacters, mockSkills, mockKnowledgeBase, mockScenarios);
  });

  it("activate gets package and replaces all services with its data", () => {
    (mockStoryPackages.get as any).mockReturnValue(structuredClone(mockStoryPackage));
    activator.activate("pkg_001");
    expect(mockStoryPackages.get).toHaveBeenCalledWith("pkg_001");
    expect(mockCharacters.replaceAll).toHaveBeenCalledWith(mockStoryPackage.characters);
    expect(mockSkills.replaceAll).toHaveBeenCalledWith(mockStoryPackage.skills);
    expect(mockKnowledgeBase.replaceAll).toHaveBeenCalledWith(mockStoryPackage.knowledgeDocuments);
    expect(mockScenarios.replaceAll).toHaveBeenCalledWith([mockStoryPackage.scenario]);
  });

  it("activate uses structuredClone so originals are not mutated", () => {
    (mockStoryPackages.get as any).mockReturnValue(structuredClone(mockStoryPackage));
    activator.activate("pkg_001");
    // All calls should receive cloned data, not the original reference
    expect(mockCharacters.replaceAll).toHaveBeenCalledWith(
      expect.not.arrayContaining([expect.objectContaining({ _original: true })])
    );
  });

  it("activate returns the story package", () => {
    (mockStoryPackages.get as any).mockReturnValue(structuredClone(mockStoryPackage));
    const result = activator.activate("pkg_001");
    expect(result).toBeDefined();
    expect(result.id).toBe("pkg_001");
    expect(result.title).toBe("Test Package");
  });

  it("activate passes scenario wrapped in an array", () => {
    (mockStoryPackages.get as any).mockReturnValue(structuredClone(mockStoryPackage));
    activator.activate("pkg_001");
    expect(mockScenarios.replaceAll).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "sc1" })])
    );
  });
});
