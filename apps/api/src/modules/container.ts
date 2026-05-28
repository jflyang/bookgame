import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { AdminApplicationService } from "../application/adminApplicationService.js";
import { GameApplicationService } from "../application/gameApplicationService.js";
import { characters } from "../data/characters.js";
import { knowledgeDocuments } from "../data/knowledgeDocuments.js";
import { scenarios } from "../data/scenarios.js";
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
import { SessionSaveService } from "../services/sessionSaveService.js";
import { SpeakerSelector } from "../services/speakerSelector.js";
import { StoryPackageService } from "../services/storyPackageService.js";
import { SkillIndex } from "../services/skillIndex.js";
import { StoryPackageActivator } from "../services/storyPackageActivator.js";
import { TurnProcessor } from "../services/turnProcessor.js";
import { RuntimeStatsCollector } from "./runtime-stats/runtimeStatsCollector.js";
import { SessionRepository } from "./sessions/sessionRepository.js";
import { SessionCollector } from "./sessions/sessionCollector.js";

const auditLogService = new AuditLogService();
export { auditLogService };
const characterService = new CharacterService(characters);
const knowledgeBaseService = new KnowledgeBaseService(knowledgeDocuments);
const scenarioService = new ScenarioService(scenarios);
const skillIndex = new SkillIndex();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "../../..");
const dataDir = process.env.GAME_DATA_DIR ? resolve(process.env.GAME_DATA_DIR) : join(projectRoot, "data");
const storageDir = join(dataDir, "task-packages");
const savesRootDir = join(dataDir, "saves");
const legacyStoryPackagesDir = join(__dirname, "../../story-packages");

// Migrate saves from old location (task-packages/<id>/saves/) to new (saves/<id>/)
if (!existsSync(savesRootDir) && existsSync(storageDir)) {
  mkdirSync(savesRootDir, { recursive: true });
  try {
    for (const entry of readdirSync(storageDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const oldSavesDir = join(storageDir, entry.name, "saves");
      if (!existsSync(oldSavesDir)) continue;
      const newPkgSavesDir = join(savesRootDir, entry.name);
      mkdirSync(newPkgSavesDir, { recursive: true });
      for (const file of readdirSync(oldSavesDir)) {
        if (file.endsWith(".session.json")) {
          copyFileSync(join(oldSavesDir, file), join(newPkgSavesDir, file));
        }
      }
    }
  } catch (err) {
    // If migration fails, the new saves dir exists but may be empty — that's fine.
  }
}

const taskPackageRepository = new TaskPackageRepository(storageDir, { legacyDir: legacyStoryPackagesDir });
export { taskPackageRepository };
export const storyPackageService = new StoryPackageService(taskPackageRepository, { characters, scenarios, knowledgeDocuments });
export const sessionSaveService = new SessionSaveService(savesRootDir);
export const mediaService = new MediaService(taskPackageRepository);
export const memoryService = new MemoryService();
export const gameStateService = new GameStateService(scenarioService);
const sessionStoryPackageIds = new Map<string, string>();

// Coordinated session cleanup: when GameStateService evicts a session, also clean MemoryService and sessionStoryPackageIds
gameStateService.onSessionCleanup((sessionId) => {
  memoryService.cleanupSession(sessionId);
  sessionStoryPackageIds.delete(sessionId);
});
const agentService = new AgentService(characterService, knowledgeBaseService);
const promptService = new PromptService(characterService, agentService, skillIndex);
const ruleChecker = new RuleChecker();
export const llmConfigService = new LlmConfigService();
const llmProvider = new ConfigurableLlmProvider(llmConfigService, {
  mock: new MockLlmProvider(),
  deepseek: new DeepSeekLlmProvider(llmConfigService)
});
export const runtimeStatsCollector = new RuntimeStatsCollector();
export const sessionRepository = new SessionRepository();
export const sessionCollector = new SessionCollector(sessionRepository);
const speakerSelector = new SpeakerSelector(characterService, gameStateService);
const storyPackageActivator = new StoryPackageActivator(storyPackageService, characterService, knowledgeBaseService, scenarioService, skillIndex);
const turnProcessor = new TurnProcessor(
  characterService,
  memoryService,
  gameStateService,
  promptService,
  ruleChecker,
  llmProvider,
  auditLogService,
  speakerSelector,
  runtimeStatsCollector,
  skillIndex,
  (sessionId) => {
    const storyPackageId = sessionStoryPackageIds.get(sessionId);
    return storyPackageId ? storyPackageService.get(storyPackageId) : undefined;
  }
);

export const dialogueEngine = new DialogueEngine(
  characterService,
  scenarioService,
  memoryService,
  gameStateService,
  storyPackageService,
  knowledgeBaseService,
  auditLogService,
  storyPackageActivator,
  turnProcessor,
  sessionStoryPackageIds,
  sessionCollector
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
