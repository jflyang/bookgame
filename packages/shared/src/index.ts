import { z } from "zod";

export const characterIds = ["qiaofeng", "xuzhu", "duanyu", "dingchunqiu"] as const;
export type CharacterId = (typeof characterIds)[number];

export const messageRoleSchema = z.enum(["user", "assistant", "system"]);
export type MessageRole = z.infer<typeof messageRoleSchema>;

export const characterSchema = z.object({
  id: z.enum(characterIds),
  name: z.string(),
  role: z.string(),
  avatar: z.string(),
  personaPrompt: z.string(),
  rules: z.array(z.string()).default([]),
  skillIds: z.array(z.string()).default([]),
  knowledgeBaseIds: z.array(z.string()).default([]),
  sourceNote: z.string().optional()
});
export type Character = z.infer<typeof characterSchema>;

export const skillSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.enum(characterIds),
  cost: z.object({ mp: z.number().int().nonnegative() }),
  damage: z.object({ min: z.number().int().nonnegative(), max: z.number().int().nonnegative() }).optional(),
  effect: z.string(),
  description: z.string(),
  sampleLine: z.string().optional()
});
export type Skill = z.infer<typeof skillSchema>;

export const knowledgeDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  ownerId: z.enum(characterIds).nullable(),
  content: z.string(),
  sourceType: z.enum(["markdown", "manual"]).default("markdown"),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type KnowledgeDocument = z.infer<typeof knowledgeDocumentSchema>;

export const initialCharacterStateSchema = z.object({
  characterId: z.enum(characterIds),
  hp: z.number().int().positive(),
  mp: z.number().int().nonnegative(),
  attack: z.string().optional(),
  defense: z.string().optional(),
  speed: z.string().optional()
});
export type InitialCharacterState = z.infer<typeof initialCharacterStateSchema>;

export const scenarioSchema = z.object({
  id: z.string(),
  title: z.string(),
  premise: z.string(),
  currentStage: z.string(),
  stages: z.array(z.string()),
  currentGoal: z.string(),
  rules: z.array(z.string()),
  initialStates: z.array(initialCharacterStateSchema)
});
export type Scenario = z.infer<typeof scenarioSchema>;

export const storyPromptRuleSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.enum([
    "knowledge_forcing",
    "group_chat_boundary",
    "scenario_injection",
    "state_output",
    "history_state",
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
  primaryColor: z.string().default("#1f5b51"),
  accentColor: z.string().default("#2b987a"),
  backgroundColor: z.string().default("#f7f1e7"),
  surfaceColor: z.string().default("#fffaf2"),
  textColor: z.string().default("#2f3133"),
  headingFont: z.string().default("STKaiti"),
  bodyFont: z.string().default("Inter"),
  navBackground: z.string().default("#0a1728"),
}).default({});
export type UiThemeConfig = z.infer<typeof uiThemeConfigSchema>;

export const uiSceneConfigSchema = z.object({
  heading: z.string().default("山道暮色 · 枯松岭"),
  introNarration: z.string().default("暮色低垂，枯松岭上寒风凛冽。毒雾从谷底翻涌而上，令人心神俱颤。"),
  emptyTitle: z.string().default("山道毒雾初起"),
  emptyHint: z.string().default('点击"继续"让角色轮流推动剧情，也可以点选头像或输入 @角色 指定发言。'),
}).default({});
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

export const storyPackageSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  storySettingPrompt: z.string().default(""),
  scenario: scenarioSchema,
  characters: z.array(characterSchema),
  skills: z.array(skillSchema),
  knowledgeDocuments: z.array(knowledgeDocumentSchema).default([]),
  promptRules: z.array(storyPromptRuleSchema).default([]),
  debugConfig: z.object({
    showPromptLayers: z.boolean(),
    showRawOutput: z.boolean(),
    showValidation: z.boolean()
  }),
  uiConfig: uiConfigSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type StoryPackage = z.infer<typeof storyPackageSchema>;

export const characterStateSchema = z.object({
  characterId: z.enum(characterIds),
  hp: z.number().int(),
  mp: z.number().int(),
  conditions: z.array(z.string()),
  isDefeated: z.boolean()
});
export type CharacterState = z.infer<typeof characterStateSchema>;

export const gameStateSchema = z.object({
  sessionId: z.string(),
  scenarioId: z.string(),
  round: z.number().int().nonnegative(),
  lastSpeakerId: z.enum(characterIds).nullable(),
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
  id: z.string(),
  sessionId: z.string(),
  role: messageRoleSchema,
  speakerId: z.enum(characterIds).nullable(),
  content: z.string(),
  usedSkills: z.array(z.string()),
  stateDelta: stateDeltaSchema,
  createdAt: z.string()
});
export type Message = z.infer<typeof messageSchema>;

export const llmActionSchema = z.object({
  type: z.enum(["skill", "observe", "command", "defend", "escape"]),
  skillId: z.string().optional(),
  targetIds: z.array(z.enum(characterIds)).default([])
});

export const llmStoryOutputSchema = z.object({
  speakerId: z.enum(characterIds),
  narration: z.string().min(1),
  dialogue: z.string().min(1),
  action: llmActionSchema,
  stateDeltaSuggestion: stateDeltaSchema.default({}),
  stageSuggestion: z.string().optional()
});
export type LlmStoryOutput = z.infer<typeof llmStoryOutputSchema>;

export const createSessionRequestSchema = z.object({
  storyPackageId: z.string().optional(),
  scenarioId: z.string().default("xuzhu_vs_dingchunqiu"),
  characterIds: z.array(z.enum(characterIds)).default([...characterIds])
});
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;

export const sendMessageRequestSchema = z.object({
  text: z.string().min(1),
  targetCharacterId: z.enum(characterIds).nullable().optional()
});
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

export const updateCharacterRequestSchema = characterSchema;
export type UpdateCharacterRequest = z.infer<typeof updateCharacterRequestSchema>;

export const createStoryPackageRequestSchema = z.object({
  title: z.string().min(1),
  sourcePackageId: z.string().optional()
});
export type CreateStoryPackageRequest = z.infer<typeof createStoryPackageRequestSchema>;

export const updateStoryPackageRequestSchema = storyPackageSchema;
export type UpdateStoryPackageRequest = z.infer<typeof updateStoryPackageRequestSchema>;

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
