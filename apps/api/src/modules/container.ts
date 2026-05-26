import { characters } from "../data/characters.js";
import { knowledgeDocuments } from "../data/knowledgeDocuments.js";
import { scenarios } from "../data/scenarios.js";
import { skills } from "../data/skills.js";
import { ConfigurableLlmProvider } from "../resources/llm/configurableLlmProvider.js";
import { DeepSeekLlmProvider } from "../resources/llm/deepSeekLlmProvider.js";
import { LlmConfigService } from "../resources/llm/llmConfigService.js";
import { MockLlmProvider } from "../resources/llm/mockLlmProvider.js";
import { CharacterService } from "../services/characterService.js";
import { AgentService } from "../services/agentService.js";
import { DialogueEngine } from "../services/dialogueEngine.js";
import { GameStateService } from "../services/gameStateService.js";
import { MemoryService } from "../services/memoryService.js";
import { KnowledgeBaseService } from "../services/knowledgeBaseService.js";
import { PromptService } from "../services/promptService.js";
import { RuleChecker } from "../services/ruleChecker.js";
import { ScenarioService } from "../services/scenarioService.js";
import { SkillService } from "../services/skillService.js";
import { StoryPackageService } from "../services/storyPackageService.js";

const characterService = new CharacterService(characters);
const skillService = new SkillService(skills);
const knowledgeBaseService = new KnowledgeBaseService(knowledgeDocuments);
const scenarioService = new ScenarioService(scenarios);
const storyPackageService = new StoryPackageService(characters, skills, scenarios, knowledgeDocuments);
const memoryService = new MemoryService();
const gameStateService = new GameStateService(scenarioService);
const agentService = new AgentService(characterService, knowledgeBaseService);
const promptService = new PromptService(characterService, agentService);
const ruleChecker = new RuleChecker();
export const llmConfigService = new LlmConfigService();
const llmProvider = new ConfigurableLlmProvider(llmConfigService, {
  mock: new MockLlmProvider(),
  deepseek: new DeepSeekLlmProvider(llmConfigService)
});

export const dialogueEngine = new DialogueEngine(
  characterService,
  skillService,
  scenarioService,
  memoryService,
  gameStateService,
  promptService,
  ruleChecker,
  llmProvider,
  storyPackageService,
  knowledgeBaseService
);
