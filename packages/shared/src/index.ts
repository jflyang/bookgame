import { z } from "zod";

export const characterIds = ["qiaofeng", "xuzhu", "duanyu", "dingchunqiu"] as const;
export type CharacterId = string;
export const safeIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/, "Invalid id");

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
  sourceNote: z.string().optional()
});
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

export const knowledgeDocumentSchema = z.object({
  id: safeIdSchema,
  title: z.string(),
  ownerId: safeIdSchema.nullable(),
  content: z.string(),
  sourceType: z.enum(["markdown", "manual"]).default("markdown"),
  createdAt: z.string(),
  updatedAt: z.string()
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

export const scenarioStageDetailSchema = z.object({
  id: safeIdSchema,
  title: z.string().default(""),
  description: z.string().default(""),
  enterWhen: z.string().default(""),
  guidance: z.string().default("")
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
  playOnce: z.enum(["session", "story", "never"]).default("session"),
  video: storyPerformanceVideoSchema.optional(),
  layers: z.record(z.string(), z.string()).default({}),
  audio: z.record(z.string(), z.string()).default({}),
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
  knowledgeDocuments: z.array(knowledgeDocumentSchema).default([]),
  promptRules: z.array(storyPromptRuleSchema).default([]),
  debugConfig: z.object({
    showPromptLayers: z.boolean(),
    showRawOutput: z.boolean(),
    showValidation: z.boolean()
  }),
  uiConfig: uiConfigSchema.optional(),
  pluginManifest: storyPluginManifestSchema.optional(),
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
  scenarioId: safeIdSchema.default("xuzhu_vs_dingchunqiu"),
  characterIds: z.array(safeIdSchema).default([...characterIds])
});
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;

export const sendMessageRequestSchema = z.object({
  text: z.string().min(1),
  targetCharacterId: safeIdSchema.nullable().optional()
});
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

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
