import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AdminApplicationService } from "../application/adminApplicationService.js";
import { GameApplicationService } from "../application/gameApplicationService.js";
import { characters } from "../data/characters.js";
import { knowledgeDocuments } from "../data/knowledgeDocuments.js";
import { scenarios } from "../data/scenarios.js";
import { skills } from "../data/skills.js";
import { TaskPackageRepository } from "../data/taskPackageRepository.js";
import { ConfigurableLlmProvider } from "../resources/llm/configurableLlmProvider.js";
import { DeepSeekLlmProvider } from "../resources/llm/deepSeekLlmProvider.js";
import { LlmConfigService } from "../resources/llm/llmConfigService.js";
import { MockLlmProvider } from "../resources/llm/mockLlmProvider.js";
import { AuditLogService } from "../services/auditLogService.js";
import { CharacterService } from "../services/characterService.js";
import { AgentService } from "../services/agentService.js";
import { DialogueEngine } from "../services/dialogueEngine.js";
import { GameStateService } from "../services/gameStateService.js";
import { MemoryService } from "../services/memoryService.js";
import { KnowledgeBaseService } from "../services/knowledgeBaseService.js";
import { MediaService } from "../services/mediaService.js";
import { PromptService } from "../services/promptService.js";
import { RuleChecker } from "../services/ruleChecker.js";
import { ScenarioService } from "../services/scenarioService.js";
import { SkillService } from "../services/skillService.js";
import { SessionSaveService } from "../services/sessionSaveService.js";
import { SpeakerSelector } from "../services/speakerSelector.js";
import { StoryPackageService } from "../services/storyPackageService.js";
import { StoryPackageActivator } from "../services/storyPackageActivator.js";
import { TurnProcessor } from "../services/turnProcessor.js";

const auditLogService = new AuditLogService();
export { auditLogService };
const characterService = new CharacterService(characters);
const skillService = new SkillService(skills);
const knowledgeBaseService = new KnowledgeBaseService(knowledgeDocuments);
const scenarioService = new ScenarioService(scenarios);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "../../..");
const dataDir = process.env.GAME_DATA_DIR ? resolve(process.env.GAME_DATA_DIR) : join(projectRoot, "data");
const storageDir = join(dataDir, "task-packages");
const legacyStoryPackagesDir = join(__dirname, "../../story-packages");
const taskPackageRepository = new TaskPackageRepository(storageDir, { legacyDir: legacyStoryPackagesDir });
export const storyPackageService = new StoryPackageService(taskPackageRepository, { characters, skills, scenarios, knowledgeDocuments });
export const sessionSaveService = new SessionSaveService(taskPackageRepository);
export const mediaService = new MediaService(taskPackageRepository);
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
const sessionStoryPackageIds = new Map<string, string>();
const storyPackageActivator = new StoryPackageActivator(storyPackageService, characterService, skillService, knowledgeBaseService, scenarioService);
const speakerSelector = new SpeakerSelector(characterService, gameStateService);
const turnProcessor = new TurnProcessor(
  characterService,
  skillService,
  memoryService,
  gameStateService,
  promptService,
  ruleChecker,
  llmProvider,
  auditLogService,
  speakerSelector,
  (sessionId) => {
    const storyPackageId = sessionStoryPackageIds.get(sessionId);
    return storyPackageId ? storyPackageService.get(storyPackageId) : undefined;
  }
);

export const dialogueEngine = new DialogueEngine(
  characterService,
  skillService,
  scenarioService,
  memoryService,
  gameStateService,
  storyPackageService,
  knowledgeBaseService,
  auditLogService,
  storyPackageActivator,
  turnProcessor,
  sessionStoryPackageIds
);

export const adminApplicationService = new AdminApplicationService(
  dialogueEngine,
  storyPackageService,
  sessionSaveService,
  mediaService,
  llmConfigService,
  auditLogService
);

export const gameApplicationService = new GameApplicationService(dialogueEngine, sessionSaveService);
