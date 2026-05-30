import { z } from "zod";

export const characterIds = ["qiaofeng", "xuzhu", "duanyu", "dingchunqiu"] as const;
export type CharacterId = string;
export const safeIdSchema = z.string().regex(/^[\p{L}0-9][\p{L}0-9_\-]{0,63}$/u, "Invalid id");

export const messageRoleSchema = z.enum(["user", "assistant", "system"]);
export type MessageRole = z.infer<typeof messageRoleSchema>;

export const characterSchema = z.object({
  id: safeIdSchema,
  name: z.string(),
  role: z.string(),
  avatar: z.string(),
  personaPrompt: z.string(),
  rules: z.array(z.string()).default([]),
  knowledgeBaseIds: z.array(safeIdSchema).default([]),
  attackableTargetIds: z.array(z.string()).default([]),
  sourceNote: z.string().optional(),
  /** TTS voice ID (e.g. ElevenLabs voice_id). If empty, uses default voice. */
  voiceId: z.string().optional(),
}).passthrough();
export type Character = z.infer<typeof characterSchema>;

export const skillSchema = z.object({
  id: safeIdSchema,
  name: z.string(),
  ownerId: safeIdSchema,
  cost: z.object({ mp: z.number().int().nonnegative() }),
  damage: z.object({ min: z.number().int().nonnegative(), max: z.number().int().nonnegative() }).optional(),
  effect: z.string(),
  description: z.string(),
  sampleLine: z.string().optional()
});
export type Skill = z.infer<typeof skillSchema>;

// v2: Narrative actions — what a character can DO (replaces combat skills)
export const actionSchema = z.object({
  id: safeIdSchema,
  name: z.string(),
  ownerId: safeIdSchema,
  description: z.string(),
});
export type Action = z.infer<typeof actionSchema>;

// v2: Passive reactions — what happens TO a character when a specific action targets them
export const reactionSchema = z.object({
  id: safeIdSchema,
  ownerId: safeIdSchema,
  name: z.string(),
  trigger: z.string(),       // matches action.name (e.g. "亲吻")
  description: z.string(),   // how this character reacts when triggered
});
export type Reaction = z.infer<typeof reactionSchema>;

export const knowledgeDocumentSchema = z.object({
  id: safeIdSchema,
  title: z.string(),
  ownerId: safeIdSchema.nullable(),
  content: z.string(),
  sourceType: z.enum(["markdown", "manual"]).default("markdown"),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});
export type KnowledgeDocument = z.infer<typeof knowledgeDocumentSchema>;

export const initialCharacterStateSchema = z.object({
  characterId: safeIdSchema,
  hp: z.number().int().positive(),
  mp: z.number().int().nonnegative(),
  attack: z.string().optional(),
  defense: z.string().optional(),
  speed: z.string().optional()
});
export type InitialCharacterState = z.infer<typeof initialCharacterStateSchema>;

export const stageBranchSchema = z.object({
  targetStage: z.string(),
  choiceText: z.string().optional(),
  condition: z.string().optional(),
  description: z.string().optional()
});
export type StageBranch = z.infer<typeof stageBranchSchema>;

export const scenarioStageDetailSchema = z.object({
  id: safeIdSchema,
  title: z.string().default(""),
  description: z.string().default(""),
  enterWhen: z.string().default(""),
  guidance: z.string().default(""),
  directive: z.string().optional().default(""),
  branches: z.array(stageBranchSchema).optional(),
  isChoicePoint: z.boolean().optional(),
  sortKey: z.number().int().nonnegative().optional(),
  stageType: z.enum(["training", "serving", "punishment", "daily", "finale", "choice", "event", "combat"]).optional(),
});
export type ScenarioStageDetail = z.infer<typeof scenarioStageDetailSchema>;

export const scenarioSchema = z.object({
  id: safeIdSchema,
  title: z.string(),
  premise: z.string(),
  currentStage: z.string(),
  stages: z.array(z.string()),
  stageDetails: z.array(scenarioStageDetailSchema).optional().default([]),
  currentGoal: z.string(),
  rules: z.array(z.string()),
  initialStates: z.array(initialCharacterStateSchema),
  defaultSpeakerId: safeIdSchema.optional()
});
export type Scenario = z.infer<typeof scenarioSchema>;

// ===== Module-Flow Architecture (v2) =====

export const moduleTypeSchema = z.enum(["training", "serving", "punishment", "daily", "finale", "choice", "event", "combat"]);
export type ModuleType = z.infer<typeof moduleTypeSchema>;

export const storyModuleSchema = z.object({
  id: safeIdSchema,
  sourceStage: z.string().optional(),
  title: z.string(),
  type: moduleTypeSchema,
  reusable: z.boolean().default(false),
  description: z.string().default(""),
  guidance: z.string().default(""),
  enterWhen: z.string().default(""),
  exitCondition: z.string().default(""),
  requiredCharacters: z.array(z.string()).optional(),
  consumesSkills: z.array(z.string()).optional(),
});
export type StoryModule = z.infer<typeof storyModuleSchema>;

export const flowJudgmentRouteSchema = z.object({
  condition: z.string(),
  target: z.string(),
  targetModule: z.string().optional(),
});

export const flowJudgmentNodeSchema = z.object({
  id: z.string(),
  type: z.literal("judgment"),
  judge: z.string(),
  description: z.string().default(""),
  scoringMethods: z.record(z.string(), z.any()).default({}),
  routes: z.record(z.string(), flowJudgmentRouteSchema).default({}),
});

export const flowLinearPhaseSchema = z.object({
  title: z.string(),
  sequence: z.array(z.string()),
  afterAll: z.string().optional(),
});

export type FlowServingLoop = z.infer<typeof flowServingLoopSchema>;
export const flowServingLoopSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(""),
  initialCycle: z.number().int().positive().default(1),
  maxCycles: z.number().int().positive().nullable().default(null),
  serveModuleByCycle: z.record(z.string(), z.string()).default({}),
  punishModuleByCycle: z.record(z.string(), z.string()).default({}),
  judgmentNode: flowJudgmentNodeSchema,
  punishThenReServe: z.object({
    description: z.string(),
    steps: z.array(z.object({
      action: z.string(),
      moduleRef: z.string().optional(),
      target: z.string().optional(),
      note: z.string().optional(),
    })),
  }).optional(),
});

export const flowPunishmentMenuSchema = z.object({
  title: z.string(),
  description: z.string().default(""),
  allPunishmentModules: z.record(z.string(), z.object({
    id: z.string(),
    title: z.string(),
    severity: z.number().int().positive(),
    subOptions: z.array(z.object({
      id: z.string(),
      title: z.string(),
      moduleRef: z.string(),
      skillRef: z.string(),
    })).optional(),
  })).default({}),
});

export const flowDailySystemSchema = z.object({
  title: z.string(),
  description: z.string().default(""),
  availableModules: z.array(z.string()).default([]),
  triggerRules: z.array(z.object({
    module: z.string(),
    trigger: z.string(),
  })).default([]),
});

export const flowDefinitionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(""),
  linearPhases: z.record(z.string(), flowLinearPhaseSchema).default({}),
  servingLoop: flowServingLoopSchema.optional(),
  finaleSequence: z.object({
    title: z.string().default(""),
    sequence: z.array(z.string()).default([]),
    description: z.string().default(""),
  }).optional(),
  dailySystem: flowDailySystemSchema.optional(),
  punishmentMenu: flowPunishmentMenuSchema.optional(),
});
export type FlowDefinition = z.infer<typeof flowDefinitionSchema>;

export const storyPromptRuleSchema = z.object({
  id: safeIdSchema,
  title: z.string(),
  category: z.enum([
    "knowledge_forcing",
    "group_chat_boundary",
    "scenario_injection",
    "state_output",
    "history_state",
    "combat",
    "skill_linkage",
    "custom"
  ]),
  content: z.string(),
  enabled: z.boolean().default(true)
});
export type StoryPromptRule = z.infer<typeof storyPromptRuleSchema>;

export const uiLayoutConfigSchema = z.object({
  showCharacterPanel: z.boolean().default(true),
  showQuickActions: z.boolean().default(true),
  showDiceButton: z.boolean().default(true),
  showAutoPlay: z.boolean().default(true),
}).default({});
export type UiLayoutConfig = z.infer<typeof uiLayoutConfigSchema>;

export const uiThemeConfigSchema = z.object({
  primaryColor: z.string().default("#1a6b54"),
  accentColor: z.string().default("#14b8a6"),
  backgroundColor: z.string().default("#f7f1e7"),
  surfaceColor: z.string().default("#fffaf2"),
  textColor: z.string().default("#2f3133"),
  headingFont: z.string().default("STKaiti"),
  bodyFont: z.string().default("Inter"),
  navBackground: z.string().default("#0a1728"),
}).default({});
export type UiThemeConfig = z.infer<typeof uiThemeConfigSchema>;

export const uiSceneConfigSchema = z.object({ heading: z.string().default(""), introNarration: z.string().default(""), emptyTitle: z.string().default(""), emptyHint: z.string().default(""), backgroundImage: z.string().optional() }).default({});

export type UiSceneConfig = z.infer<typeof uiSceneConfigSchema>;

export const uiLabelConfigSchema = z.object({
  hp: z.string().default("气血"),
  mp: z.string().default("内力"),
  characters: z.string().default("登场角色"),
  lastSpeaker: z.string().default("上轮发言"),
  continue: z.string().default("继续"),
  autoPlay: z.string().default("自动继续"),
  send: z.string().default("发送"),
  manageCharacters: z.string().default("角色管理"),
  rules: z.string().default("故事规则"),
  scenarioRules: z.string().default("剧情规则"),
  promptRules: z.string().default("提示词规则"),
  currentStatus: z.string().default("当前状态"),
  round: z.string().default("回合"),
  currentStage: z.string().default("当前阶段"),
  statusActive: z.string().default("进行中"),
  statusCompleted: z.string().default("已结束"),
  interactiveStory: z.string().default("互动故事"),
  storyManagement: z.string().default("故事管理"),
  viewRules: z.string().default("查看规则"),
}).default({});
export type UiLabelConfig = z.infer<typeof uiLabelConfigSchema>;

export const uiAvatarConfigSchema = z.object({
  style: z.enum(["gradient", "emoji", "url"]).default("gradient"),
}).default({});
export type UiAvatarConfig = z.infer<typeof uiAvatarConfigSchema>;

export const uiConfigSchema = z.object({
  layout: uiLayoutConfigSchema,
  theme: uiThemeConfigSchema,
  scene: uiSceneConfigSchema,
  labels: uiLabelConfigSchema,
  avatar: uiAvatarConfigSchema,
}).default({});
export type UiConfig = z.infer<typeof uiConfigSchema>;

// ===== Plugin Manifest (v2 story packages) =====

export const manifestCapabilitiesSchema = z.object({
  audio: z.boolean().default(false),
  customFonts: z.boolean().default(false),
  customCss: z.boolean().default(false),
  characterPortraits: z.boolean().default(false),
  backgroundImages: z.boolean().default(false),
  performances: z.boolean().default(false),
}).default({});
export type ManifestCapabilities = z.infer<typeof manifestCapabilitiesSchema>;

export const manifestAudioConfigSchema = z.object({
  bgm: z.object({
    default: z.string().optional(),
    scenes: z.record(z.string(), z.string()).default({}),
  }).default({}),
  sfx: z.record(z.string(), z.string()).default({}),
}).default({});
export type ManifestAudioConfig = z.infer<typeof manifestAudioConfigSchema>;

export const manifestImagesConfigSchema = z.object({
  portraits: z.record(z.string(), z.string()).default({}),
  backgrounds: z.record(z.string(), z.string()).default({}),
}).default({});
export type ManifestImagesConfig = z.infer<typeof manifestImagesConfigSchema>;

export const manifestFontsConfigSchema = z.object({
  heading: z.string().optional(),
  body: z.string().optional(),
  ui: z.string().optional(),
}).default({});
export type ManifestFontsConfig = z.infer<typeof manifestFontsConfigSchema>;

export const storyPerformanceTriggerSchema = z.object({
  type: z.enum(["firstAppearance", "skillUse", "stageEnter", "messageEvent", "knowledgeUse"]),
  characterId: safeIdSchema.optional(),
  skillId: safeIdSchema.optional(),
  stageId: z.string().optional(),
  eventId: safeIdSchema.optional(),
  knowledgeTitle: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  matchBoldOnly: z.boolean().optional(),
});
export type StoryPerformanceTrigger = z.infer<typeof storyPerformanceTriggerSchema>;

export const storyPerformanceVideoSchema = z.object({
  webm: z.string().optional(),
  mp4: z.string().optional(),
  poster: z.string().optional(),
  containsAudio: z.boolean().default(false),
}).default({});
export type StoryPerformanceVideo = z.infer<typeof storyPerformanceVideoSchema>;

export const storyPerformanceDefinitionSchema = z.object({
  name: z.string(),
  renderer: z.enum(["video", "layeredCss", "audio", "image", "none"]),
  durationMs: z.number().int().positive().default(3800),
  trigger: storyPerformanceTriggerSchema,
  playOnce: z.enum(["session", "story", "never", "perStage"]).default("session"),
  video: storyPerformanceVideoSchema.optional(),
  layers: z.record(z.string(), z.string()).default({}),
  audio: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
});
export type StoryPerformanceDefinition = z.infer<typeof storyPerformanceDefinitionSchema>;

export const storyPluginManifestSchema = z.object({
  id: safeIdSchema,
  type: z.literal("story-plugin"),
  schemaVersion: z.literal("2"),
  title: z.string(),
  description: z.string().default(""),
  version: z.string().default("1.0.0"),
  author: z.string().default(""),
  capabilities: manifestCapabilitiesSchema,
  audio: manifestAudioConfigSchema,
  images: manifestImagesConfigSchema,
  fonts: manifestFontsConfigSchema,
  performances: z.record(z.string(), storyPerformanceDefinitionSchema).default({}),
  entry: z.string().default("story.json"),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type StoryPluginManifest = z.infer<typeof storyPluginManifestSchema>;

export const storyPackageSchema = z.object({
  id: safeIdSchema,
  title: z.string(),
  description: z.string(),
  thumbnail: z.string().optional(),
  hidden: z.boolean().default(false),
  storySettingPrompt: z.string().default(""),
  scenario: scenarioSchema,
  characters: z.array(characterSchema),
  skills: z.array(skillSchema).default([]),
  actions: z.array(actionSchema).default([]),
  reactions: z.array(reactionSchema).default([]),
  knowledgeDocuments: z.array(knowledgeDocumentSchema).default([]),
  promptRules: z.array(storyPromptRuleSchema).default([]),
  debugConfig: z.object({
    showPromptLayers: z.boolean(),
    showRawOutput: z.boolean(),
    showValidation: z.boolean()
  }),
  uiConfig: uiConfigSchema.optional(),
  pluginManifest: storyPluginManifestSchema.optional(),
  modules: z.array(storyModuleSchema).optional(),
  flow: flowDefinitionSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type StoryPackage = z.infer<typeof storyPackageSchema>;
export const taskPackageSchema = storyPackageSchema;
export type TaskPackage = StoryPackage;

export const characterStateSchema = z.object({
  characterId: safeIdSchema,
  hp: z.number().int(),
  mp: z.number().int(),
  conditions: z.array(z.string()),
  isDefeated: z.boolean()
});
export type CharacterState = z.infer<typeof characterStateSchema>;

export const gameStateSchema = z.object({
  sessionId: safeIdSchema,
  scenarioId: safeIdSchema,
  round: z.number().int().nonnegative(),
  lastSpeakerId: safeIdSchema.nullable(),
  status: z.enum(["active", "completed"]),
  characters: z.array(characterStateSchema),
  scenario: scenarioSchema,
  currentCycle: z.number().int().positive().default(1),
  usedModules: z.array(z.string()).default([]),
  stageEnteredAtRound: z.number().int().nonnegative().default(0),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type GameState = z.infer<typeof gameStateSchema>;

export const stateDeltaSchema = z.record(z.string(), z.number().int());
export type StateDelta = z.infer<typeof stateDeltaSchema>;

export const messageSchema = z.object({
  id: safeIdSchema,
  sessionId: safeIdSchema,
  role: messageRoleSchema,
  speakerId: safeIdSchema.nullable(),
  content: z.string(),
  usedSkills: z.array(z.string()),
  stateDelta: stateDeltaSchema,
  createdAt: z.string()
});
export type Message = z.infer<typeof messageSchema>;

export const llmActionSchema = z.object({
  type: z.enum(["skill", "observe", "command", "defend", "escape"]),
  skillId: z.string().nullable().optional(),
  targetIds: z.array(z.string()).default([])
});

export const llmStoryOutputSchema = z.object({
  speakerId: safeIdSchema,
  narration: z.string().min(1),
  dialogue: z.string().min(1),
  action: llmActionSchema,
  stateDeltaSuggestion: stateDeltaSchema.default({}),
  stageSuggestion: z.string().optional()
});
export type LlmStoryOutput = z.infer<typeof llmStoryOutputSchema>;

export const createSessionRequestSchema = z.object({
  storyPackageId: safeIdSchema.optional(),
  scenarioId: safeIdSchema.default("虚竹"),
  characterIds: z.array(safeIdSchema).default([...characterIds])
});
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;

export const sendMessageRequestSchema = z.object({
  text: z.string().min(1),
  targetCharacterId: safeIdSchema.nullable().optional()
});
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

export const choiceRequestSchema = z.object({
  branchIndex: z.number().int().nonnegative()
});
export type ChoiceRequest = z.infer<typeof choiceRequestSchema>;

export const updateCharacterRequestSchema = characterSchema;
export type UpdateCharacterRequest = z.infer<typeof updateCharacterRequestSchema>;

export const createStoryPackageRequestSchema = z.object({
  title: z.string().min(1),
  sourcePackageId: z.string().optional()
});
export type CreateStoryPackageRequest = z.infer<typeof createStoryPackageRequestSchema>;
export const createTaskPackageRequestSchema = createStoryPackageRequestSchema;
export type CreateTaskPackageRequest = CreateStoryPackageRequest;

export const updateStoryPackageRequestSchema = storyPackageSchema;
export type UpdateStoryPackageRequest = z.infer<typeof updateStoryPackageRequestSchema>;
export const updateTaskPackageRequestSchema = taskPackageSchema;
export type UpdateTaskPackageRequest = UpdateStoryPackageRequest;

export const llmProviderTypeSchema = z.enum(["mock", "deepseek"]);
export type LlmProviderType = z.infer<typeof llmProviderTypeSchema>;

// ===== TTS Config =====

export const ttsProviderTypeSchema = z.enum(["cosyvoice", "elevenlabs", "mock", "disabled"]);
export type TtsProviderType = z.infer<typeof ttsProviderTypeSchema>;

export const ttsConfigSchema = z.object({
  enabled: z.boolean(),
  provider: ttsProviderTypeSchema,
  serviceUrl: z.string(),
  defaultInstruct: z.string(),
  autoSynthesize: z.boolean(),
  cacheEnabled: z.boolean(),
  maxTextLength: z.number().int().positive(),
  defaultFormat: z.enum(["mp3", "ogg", "wav"]),
  sampleRate: z.number().int().positive(),
});
export type TtsConfig = z.infer<typeof ttsConfigSchema>;

export const ttsConfigViewSchema = ttsConfigSchema.extend({
  serviceAvailable: z.boolean().optional(),
});
export type TtsConfigView = z.infer<typeof ttsConfigViewSchema>;

export const ttsSynthesizeRequestSchema = z.object({
  text: z.string().min(1).max(2000),
  characterId: z.string().min(1),
  emotion: z.string().optional(),
  format: z.enum(["mp3", "ogg", "wav"]).optional(),
});
export type TtsSynthesizeRequest = z.infer<typeof ttsSynthesizeRequestSchema>;

export const ttsSynthesizeResultSchema = z.object({
  audioUrl: z.string(),
  durationMs: z.number(),
  cached: z.boolean(),
});
export type TtsSynthesizeResult = z.infer<typeof ttsSynthesizeResultSchema>;

export const voiceProfileSchema = z.object({
  characterId: z.string(),
  voiceId: z.string(),
  name: z.string(),
  instruct: z.string(),
  referenceAudio: z.string(),
  language: z.string(),
  emotions: z.record(z.string(), z.string()).optional(),
});
export type VoiceProfile = z.infer<typeof voiceProfileSchema>;

export const llmConfigSchema = z.object({
  provider: llmProviderTypeSchema,
  baseUrl: z.string().url(),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().positive(),
  apiKey: z.string().optional()
});
export type LlmConfig = z.infer<typeof llmConfigSchema>;

export const llmConfigViewSchema = llmConfigSchema.omit({ apiKey: true }).extend({
  hasApiKey: z.boolean()
});
export type LlmConfigView = z.infer<typeof llmConfigViewSchema>;

export const updateLlmConfigRequestSchema = llmConfigSchema.extend({
  apiKey: z.string().optional()
});
export type UpdateLlmConfigRequest = z.infer<typeof updateLlmConfigRequestSchema>;

// ===== Runtime Stats =====

export const runtimeStatsTokenUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
}).nullable();
export type RuntimeStatsTokenUsage = z.infer<typeof runtimeStatsTokenUsageSchema>;

export const runtimeTurnRecordSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  round: z.number().int().nonnegative(),
  speakerId: z.string(),
  speakerName: z.string(),
  prompt: z.string(),
  rawLlmResponse: z.string(),
  parsedOutput: z.any().nullable(),
  validationResult: z.enum(["passed", "failed"]),
  validationErrors: z.array(z.any()).default([]),
  stateDelta: z.record(z.string(), z.number().int()).nullable(),
  stageBefore: z.string(),
  stageAfter: z.string(),
  latencyMs: z.number().int().nonnegative(),
  tokenUsage: runtimeStatsTokenUsageSchema,
  timestamp: z.string(),
});
export type RuntimeTurnRecord = z.infer<typeof runtimeTurnRecordSchema>;

export const runtimeStatsAggregateSchema = z.object({
  totalTurns: z.number().int().nonnegative(),
  totalSessions: z.number().int().nonnegative(),
  avgLatencyMs: z.number().nonnegative(),
  maxLatencyMs: z.number().int().nonnegative(),
  minLatencyMs: z.number().int().nonnegative(),
  totalPromptTokens: z.number().int().nonnegative(),
  totalCompletionTokens: z.number().int().nonnegative(),
  avgPromptTokens: z.number().nonnegative(),
  avgCompletionTokens: z.number().nonnegative(),
  validationPassCount: z.number().int().nonnegative(),
  validationFailCount: z.number().int().nonnegative(),
  stageChanges: z.number().int().nonnegative(),
  activeSpeakers: z.array(z.string()),
});
export type RuntimeStatsAggregate = z.infer<typeof runtimeStatsAggregateSchema>;
