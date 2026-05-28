# AI 故事配置指南

本文档是给 AI 使用的完整参考手册。当你需要创建新故事包或修改现有故事时，严格按此手册操作。

---

## 一、项目架构总览

```
game/
├── packages/shared/src/index.ts    ← 所有 Zod Schema 定义（唯一真相源）
├── apps/api/src/                   ← 后端 Fastify 服务
│   ├── data/
│   │   ├── taskPackageRepository.ts  ← 读取 story.json 并用 Zod 校验
│   │   └── pluginPackageIndex.ts     ← 校验 manifest.json 中的文件引用
│   ├── services/
│   │   └── storyPackageService.ts    ← 启动时加载所有故事包到内存（需重启生效）
│   └── modules/container.ts         ← DI 容器
├── apps/data/task-packages/        ← 所有故事包存放位置
│   ├── story_sSw0IetszN/           ← 小薇日记
│   ├── xuzhu_vs_dingchunqiu/       ← 虚竹除害星宿老怪
│   └── your_new_story/             ← 新故事放这里
└── apps/web/                       ← React 前端 (:5173)
```

**关键事实**：
- API 服务启动时一次性加载所有 story.json 到内存，任何修改需**重启 API 服务**生效
- `manifest.json` 由 `pluginPackageIndex.ts` 单独校验——manifest 中引用的文件必须真实存在
- `story.json` 是"合集文件"，打包了 characters / skills / knowledgeDocuments / promptRules / scenario。但在编辑时，各部分有独立的拆分文件

---

## 二、故事包文件结构

一个完整的故事包目录如下：

```
apps/data/task-packages/{story_id}/
├── story.json              ← 完整故事包数据（合集，API 读取此文件）
├── manifest.json           ← 插件清单（表演定义、音效/图片路径、capabilities）
├── characters.json         ← 角色数组（已拆分的独立文件）
├── skills.json             ← 技能数组（已拆分的独立文件）
├── flow.json               ← 流程控制定义（v2 可选，判断/分支/循环逻辑）
├── modules.json             ← 故事模块定义（v2 可选，可被 flow 反复调用的独立模块）
├── knowledge/
│   └── documents.json      ← 知识库文档数组（已拆分的独立文件）
├── prompts/
│   ├── rules.json          ← Prompt 规则数组（已拆分的独立文件）
│   └── story-setting.md    ← storySettingPrompt 文本
├── media/
│   ├── background.png      ← 故事背景图
│   ├── chat-bg.jpg         ← 聊天背景
│   └── thumbnail.png       ← 缩略图
├── assets/
│   └── performances/
│       └── {perf_name}/
│           ├── audio/       ← 音效文件 (.mp3/.wav)
│           └── images/      ← 演出图层图片
└── saves/                   ← 游戏存档
```

**⚠️ 重要**：修改时必须保持 `story.json` 与独立拆分文件（`skills.json`, `knowledge/documents.json`, `flow.json`, `modules.json` 等）**同步**。API 只读 `story.json`，但前端管理后台编辑时读写独立文件。

> **v2 架构**：从 v2 开始，故事支持 **Module-Flow 分离架构**。`flow.json` 定义流程控制（判断/分支/循环），`modules.json` 定义可被 flow 反复调用的独立故事模块。不配置时系统回退到传统 `stageDetails` 模式。详见[八、Module-Flow 架构](#八module-flow-架构v2)。

---

## 三、Zod Schema 速查

所有字段、类型、必填/可选均以此为准。Schema 定义在 `packages/shared/src/index.ts`。

### 3.1 Character（角色）

```typescript
characterSchema = z.object({
  id:            safeIdSchema,        // 必填，正则: /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/
  name:          z.string(),          // 必填，显示名称
  role:          z.string(),          // 必填，角色定位描述
  avatar:        z.string(),          // 必填，头像标识
  personaPrompt: z.string(),          // 必填，角色扮演 Prompt
  rules:         z.array(z.string()).default([]),
  knowledgeBaseIds: z.array(safeIdSchema).default([]),
  attackableTargetIds: z.array(z.string()).default([]),
  sourceNote:    z.string().optional()
})
```

### 3.2 Skill（技能）

```typescript
skillSchema = z.object({
  id:          safeIdSchema,        // 必填
  name:        z.string(),          // 必填
  ownerId:     safeIdSchema,        // 必填，所属角色 id
  cost:        z.object({ mp: z.number().int().nonnegative() }),  // 必填
  damage:      z.object({
                 min: z.number().int().nonnegative(),
                 max: z.number().int().nonnegative()
               }).optional(),       // 可选，纯辅助技可不填
  effect:      z.string(),          // 必填，技能效果
  description: z.string(),          // 必填 ← 最容易漏掉！
  sampleLine:  z.string().optional()
})
```

**⚠️ `description` 是必填字段**，漏掉会导致服务启动报 ZodError。

### 3.3 KnowledgeDocument（知识库文档）

```typescript
knowledgeDocumentSchema = z.object({
  id:         safeIdSchema,     // 必填
  title:      z.string(),       // 必填
  ownerId:    safeIdSchema.nullable(),  // 可 null
  content:    z.string(),       // 必填，Markdown 格式
  sourceType: z.enum(["markdown", "manual"]).default("markdown"),
  createdAt:  z.string(),       // 必填，ISO 日期
  updatedAt:  z.string()        // 必填，ISO 日期
})
```

### 3.4 StoryPromptRule（Prompt 规则）

```typescript
storyPromptRuleSchema = z.object({
  id:       safeIdSchema,       // 必填
  title:    z.string(),         // 必填
  category: z.enum([            // 必填 ← 枚举值，不能乱填
    "knowledge_forcing",        // 强制 LLM 查阅知识库
    "group_chat_boundary",      // 群聊边界控制
    "scenario_injection",       // 场景注入
    "state_output",             // 状态输出格式
    "history_state",            // 历史状态
    "combat",                   // 战斗系统
    "custom"                    // 自定义规则
  ]),
  content:  z.string(),         // 必填
  enabled:  z.boolean().default(true)
})
```

### 3.5 Scenario & Stage

```typescript
scenarioSchema = z.object({
  id:              safeIdSchema,      // 必填
  title:           z.string(),        // 必填
  premise:         z.string(),        // 必填，故事前提
  currentStage:    z.string(),        // 必填，当前阶段 id
  stages:          z.array(z.string()),  // 必填，所有阶段 id 列表
  stageDetails:    z.array(z.object({
    id:            safeIdSchema,
    title:         z.string().default(""),
    description:   z.string().default(""),
    enterWhen:     z.string().default(""),
    guidance:      z.string().default(""),
    branches:      z.array(stageBranchSchema).optional(),  // ← 分支定义
    isChoicePoint: z.boolean().optional()                  // ← 是否为抉择点
  })).optional().default([]),
  currentGoal:     z.string(),        // 必填
  rules:           z.array(z.string()),  // 必填
  initialStates:   z.array(initialCharacterStateSchema),  // 必填
  defaultSpeakerId: safeIdSchema.optional()
})

// 分支定义
stageBranchSchema = z.object({
  targetStage: z.string(),           // 必填，跳转目标阶段 id
  choiceText:  z.string().optional(), // 前端显示的按钮文本
  condition:   z.string().optional(), // 触发条件描述（供 LLM 判断）
  description: z.string().optional()  // 分支结果简述
})
```

### 3.6 PerformanceDefinition（表演定义，在 manifest.json 中）

```typescript
storyPerformanceDefinitionSchema = z.object({
  name:       z.string(),                      // 必填
  renderer:   z.enum(["video", "layeredCss", "audio", "image", "none"]),  // 必填
  durationMs: z.number().int().positive().default(3800),
  trigger:    storyPerformanceTriggerSchema,    // 必填
  playOnce:   z.enum(["session", "story", "never"]).default("session"),
  video:      storyPerformanceVideoSchema.optional(),
  layers:     z.record(z.string(), z.string()).default({}),
  audio:      z.record(z.string(), z.string()).default({}),
})

storyPerformanceTriggerSchema = z.object({
  type:           z.enum(["firstAppearance", "skillUse", "stageEnter", "messageEvent", "knowledgeUse"]),
  characterId:    safeIdSchema.optional(),
  skillId:        safeIdSchema.optional(),     // skillUse 类型时用
  stageId:        z.string().optional(),        // stageEnter 类型时用
  eventId:        safeIdSchema.optional(),      // messageEvent 类型时用
  knowledgeTitle: z.string().optional(),        // knowledgeUse 类型时用
  keywords:       z.array(z.string()).optional(), // knowledgeUse 类型时用
  matchBoldOnly:  z.boolean().optional(),       // knowledgeUse：true=仅匹配粗体
})
```

**5 种 Trigger 类型**：

| 类型 | 说明 | 必填字段 |
|------|------|---------|
| `knowledgeUse` | 匹配 LLM 输出的粗体关键词 | `characterId`, `keywords`, `matchBoldOnly` |
| `skillUse` | 匹配技能被使用 | `characterId`, `skillId` |
| `firstAppearance` | 角色首次登场 | `characterId` |
| `stageEnter` | 阶段切换 | `stageId` |
| `messageEvent` | 自定义事件 | `eventId` |

### 3.7 Module-Flow Architecture（v2 可选）

> v2 故事包支持将流程控制（判断/分支/循环）与故事模块内容分离。`flow.json` 定义流程逻辑，`modules.json` 定义可复用故事模块。

#### StoryModule（故事模块）

```typescript
moduleTypeSchema = z.enum(["training", "serving", "punishment", "daily", "finale"])

storyModuleSchema = z.object({
  id:                  safeIdSchema,
  sourceStage:         z.string().optional(),     // 对应 scenario 中的 stage id
  title:               z.string(),
  type:                moduleTypeSchema,          // training/serving/punishment/daily/finale
  reusable:            z.boolean().default(false), // 可被 flow 反复调用
  description:         z.string().default(""),
  guidance:            z.string().default(""),     // LLM 引导文本 ← 核心字段
  enterWhen:           z.string().default(""),
  exitCondition:       z.string().default(""),
  requiredCharacters:  z.array(z.string()).optional(),
  consumesSkills:      z.array(z.string()).optional(),
})
```

**模块类型说明**：

| 类型 | 用途 | reusable | 示例 |
|------|------|----------|------|
| `training` | 一次性训练模块，顺序推进 | false | 武功封印、换装束缚、精油悬吊 |
| `serving` | 侍寝模块，可在循环中反复调用 | true | 全副束缚侍寝、悬吊式侍寝、M字开腿侍寝 |
| `punishment` | 惩戒模块，可在循环中反复调用 | true | 三塞悬吊、双龙边缘、媚药煎熬 |
| `daily` | 日常体系模块，任意时间可触发 | true | 佩戴器具、晨间检查、跪行日 |
| `finale` | 终幕模块，一次性 | false | 事后余韵、侍女宣言、永恒归属 |

#### FlowDefinition（流程定义）

```typescript
flowDefinitionSchema = z.object({
  id:              z.string(),
  title:           z.string(),
  description:     z.string().default(""),
  linearPhases:    z.record(z.string(), flowLinearPhaseSchema).default({}),
  servingLoop:     flowServingLoopSchema.optional(),
  finaleSequence:  z.object({
    title:       z.string(),
    sequence:    z.array(z.string()),      // module id 数组
    description: z.string()
  }).optional(),
  dailySystem:     flowDailySystemSchema.optional(),
  punishmentMenu:  flowPunishmentMenuSchema.optional(),
})
```

**流控制阶段**：

| 字段 | 说明 |
|------|------|
| `linearPhases` | 线性阶段组——每幕一个 phase，包含按顺序推进的 module |
| `servingLoop` | 侍寝循环——侍寝→判定→不满意→惩戒→重新侍寝→直到满意 |
| `finaleSequence` | 终幕序列——满意后的结局模块列表 |
| `dailySystem` | 日常体系——贯穿全故事的触发规则 |
| `punishmentMenu` | 惩戒菜单——所有可用惩戒模块及其严重度 |

#### ServingLoop（侍寝循环核心）

```typescript
flowServingLoopSchema = z.object({
  id:                   z.string(),
  title:                z.string(),
  description:          z.string().default(""),
  initialCycle:         z.number().int().positive().default(1),
  maxCycles:            z.number().int().positive().nullable().default(null),
  serveModuleByCycle:   z.record(z.string(), z.string()).default({}),
                         // { "1": "mod_stage_21", "2": "mod_stage_23", "default": "mod_stage_29" }
  punishModuleByCycle:  z.record(z.string(), z.string()).default({}),
                         // { "1": "mod_stage_22", "2": "mod_stage_24", "default": "mod_stage_30" }
  judgmentNode:         flowJudgmentNodeSchema,  // 判定节点
  punishThenReServe:    z.object({...}).optional(), // 失败→惩戒→重新侍寝流程
})
```

**判定节点（JudgmentNode）**——支持两种评分模式：

| 模式 | 说明 | 配置字段 |
|------|------|---------|
| `score_3d` | 三维评分：身体配合度+声音表达度+眼神臣服度 | `dimensions` + `thresholdsByCycle` |
| `score_4trials_random` | 四重考验+50%随机失败 | `trials` + `randomFailChance` |

#### GameState 扩展字段

```typescript
// gameStateSchema 新增 v2 字段
{
  currentCycle: z.number().int().positive().default(1),  // 当前侍寝循环数
  usedModules:  z.array(z.string()).default([]),          // 已使用的模块 id 列表
}
```

#### StoryPackage 扩展字段

```typescript
// storyPackageSchema 新增 v2 可选字段
{
  modules: z.array(storyModuleSchema).optional(),  // 模块池
  flow:    flowDefinitionSchema.optional(),         // 流程定义
}
```

---

## 四、知识库文档编写规范

知识库文档（`knowledge/documents.json` 中的 `content` 字段）是 **Markdown 格式**，是 LLM 生成内容的核心依据。

### 4.1 技能条目的标准格式

每个技能必须包含以下字段（在 Markdown 中）：

```markdown
## 技能名称

- 类型：招式/辅助技/控制技
- 表演：表演名称（与 manifest.json 中 performances 的 key 对应）
- 触发词：关键词A、关键词B、关键词C
- 消耗：低/中/高/数字
- 内力：30          ← 此格式被 SkillParser 解析为 {mp: 30}
- 伤害：35~50       ← 此格式被 SkillParser 解析为 {min: 35, max: 50}
- 效果：技能效果的详细描述
- 发动时机：什么情况下使用
- 描述：技能的文字描述（LLM 用来生成叙述）
- 台词："示例台词"
- 角色名反应：具体反应描述（如果是被动联动角色，如小薇对其他角色的反应）
- 输出要求：发动此技能时，叙事或台词中必须出现 **技能名称**。
```

**关键约定**：
- `内力：数字` 和 `伤害：数字~数字` 格式被后端的 `SkillParser` 解析，用于自动提取技能数据
- `表演：xxx` 和 `触发词：A、B、C` 用于和 `manifest.json` 中的 performances 建立关联
- `输出要求` 中的粗体标记是告诉 LLM 输出时必须用 `**粗体**` 包裹技能名，这样前端的 `StoryPerformanceRuntime` 才能检测到并触发演出

### 4.2 角色整体判断（阶段路线图）

每个角色的知识库末尾必须有 `## 角色名整体战斗判断`（或 `整体判断`）章节，按阶段指导 LLM 行为：

```markdown
## 角色名整体战斗判断

你是xxx角色。严格按阶段推进：
①阶段一：具体行为描述（使用 **技能A** 和 **技能B**）
②阶段二：具体行为描述（升级为 **技能C**）
③阶段三：……
...
全程保持xxx风格。每轮都要描述xxx并用粗体标注。
```

### 4.3 被动联动角色的反应标注

如果一个角色（如小薇）的表演是被其他角色（如大姐）的技能触发的，需要在大姐的知识库中加 `小薇反应：` 行：

```markdown
- 小薇反应：被捆绑时出现**傲娇激烈反抗**，剧烈挣扎扭动身体并大声抗议。
```

这样 LLM 在生成大姐的内容时，会同时输出小薇的反应名称（粗体），从而触发小薇的表演。

---

## 五、演出（Performance）配置规范

### 5.1 manifest.json 结构

```json
{
  "id": "story_id",
  "type": "story-plugin",
  "schemaVersion": "2",
  "title": "故事标题",
  "capabilities": {
    "audio": true,
    "performances": true
  },
  "audio": { "bgm": { "scenes": {} }, "sfx": {} },
  "images": { "portraits": {}, "backgrounds": {} },
  "fonts": {},
  "performances": {
    "perf_key_1": { /* 表演定义 */ },
    "perf_key_2": { /* 表演定义 */ }
  },
  "entry": "story.json",
  "createdAt": "2026-05-28T00:00:00.000Z",
  "updatedAt": "2026-05-28T00:00:00.000Z"
}
```

### 5.2 为 knowledgeUse 类型配置表演（最常见）

```json
"perf_key": {
  "name": "显示名称",
  "renderer": "audio",
  "durationMs": 2400,
  "trigger": {
    "type": "knowledgeUse",
    "characterId": "角色的 ownerId",
    "knowledgeTitle": "对应的知识库条目标题",
    "keywords": ["触发词A", "触发词B", "触发词C"],
    "matchBoldOnly": true
  },
  "playOnce": "never",
  "audio": {
    "main": "assets/performances/perf_key/audio/filename.mp3"
  }
}
```

**字段对应关系**：
- `trigger.keywords` 必须与知识库文档中的 `触发词：` 一致
- `trigger.matchBoldOnly: true` 表示仅匹配 LLM 输出中的 `**粗体**` 内容
- `audio.main` 路径指向真实存在的音效文件，路径不存在会导致服务启动失败

### 5.3 为 skillUse 类型配置表演

```json
"perf_key": {
  "name": "技能使用演出",
  "renderer": "audio",
  "durationMs": 1500,
  "trigger": {
    "type": "skillUse",
    "characterId": "角色id",
    "skillId": "技能id"
  },
  "playOnce": "never",
  "audio": {
    "main": "assets/performances/perf_key/audio/filename.mp3"
  }
}
```

### 5.4 renderer 类型

| renderer | 用途 | 需要配置的字段 |
|----------|------|--------------|
| `audio` | 纯音效 | `audio.main` |
| `image` | 纯图片 | `layers` |
| `layeredCss` | 多层 CSS 动画 | `layers`（多图层）+ `audio`（可选） |
| `video` | 视频 | `video.webm` / `video.mp4` |
| `none` | 无渲染（仅逻辑触发） | 无 |

---

## 六、技能、知识库、表演的联动关系

**核心数据流**：

```
skills.json                 knowledge/documents.json          manifest.json
  ┌─────────┐                 ┌──────────────────┐            ┌────────────────┐
  │ skill   │ ─── id 对应 ──→ │ ## 技能名称       │            │ performance    │
  │  .id    │                 │ - 表演：xxx       │ ────────→  │  .trigger      │
  │  .name  │                 │ - 触发词：A、B   │  触发词匹配  │   .keywords    │
  │  .cost  │                 │ - 输出要求：**粗体**│ ←── LLM   │  .audio.main   │
  │  .effect│                 │ - 小薇反应：...   │   输出粗体  │  .renderer     │
  └─────────┘                 └──────────────────┘            └────────────────┘
```

**联动链**：
1. **skills.json** 定义技能元数据（id, cost, damage, effect, description）→ 给系统提供技能数据
2. **knowledge/documents.json** 定义 LLM 行为（何时用、怎么说、用哪个粗体标记）→ 给 LLM 提供生成指南
3. **manifest.json** 定义演出（匹配哪些关键词 → 播放什么音效/动画）→ 给前端提供演出资源

**三步验证法**：
- skill 存在于 `skills.json` ↔ knowledge doc 中有对应的 `## 技能名` 章节 ↔ manifest.json 中有对应的 `performances` 条目
- 知识库中的 `触发词` = manifest 中的 `trigger.keywords`
- 知识库中的 `表演：xxx` = manifest 中 performances 的 key

---

## 七、阶段渐进系统配置

为了让故事从"轻到重"自然推进（而非一直停留在低强度），需要配置阶段渐进系统。**核心原则：阶段行为写 stageDetails，跨阶段铁律写 promptRules，各司其职不重复。**

### 7.1 定义 scenario.stages 和 stageDetails（阶段行为）

在 `story.json` 的 `scenario` 中，`stageDetails` 是**阶段行为的主要载体**。每个阶段的 `guidance` 字段要写清楚该阶段的氛围、技能分配、推进条件：

```json
{
  "scenario": {
    "id": "main",
    "title": "故事标题",
    "premise": "故事背景前提",
    "currentStage": "stage_1",
    "stages": ["stage_1", "stage_2", "stage_3"],
    "stageDetails": [
      {
        "id": "stage_1",
        "title": "① 阶段名（预计2~3轮）",
        "description": "一句话概括此阶段发生什么",
        "enterWhen": "进入此阶段的条件",
        "guidance": "氛围：描述此阶段的气氛基调\n\n角色A：**技能X** + **技能Y**（具体用法说明）\n角色B：**技能Z**\n→ 推进条件：达成什么才能进入下一阶段"
      }
    ],
    "currentGoal": "当前目标",
    "rules": [],
    "initialStates": [
      { "characterId": "char_1", "hp": 100, "mp": 100 }
    ]
  }
}
```

**`guidance` 字段的写法**（这是 LLM 看到的核心指令）：
- 第一行写氛围（情绪基调）
- 然后列出每个角色在此阶段应使用的技能（用粗体标记技能名和反应名）
- 最后写 `→ 推进条件：xxx`

**7.2 添加阶段铁律（promptRules）**

promptRules 中的阶段相关规则应**只保留跨阶段铁律**，不重复写每个阶段的技能分配。内容中引用"剧情阶段信息"让 LLM 关联到 stageDetails：

```json
{
  "id": "rule_stage_progression",
  "title": "阶段推进铁律",
  "category": "custom",
  "content": "本故事共N个阶段。每个阶段的氛围、技能分配、推进条件详见"剧情阶段信息"中的阶段卡片。必须严格按顺序推进，不得跳跃、不得长期卡在同一阶段。\n\n═══════════════════════════════════════\n核心铁律\n═══════════════════════════════════════\n\n❌ 禁止在早期阶段使用高级技能\n❌ 禁止跳过阶段\n❌ 禁止同一技能连续使用超过3次\n\n✅ 每轮发言必须用粗体标出技能名称\n✅ 阶段推进后，上一阶段解锁的技能仍可用",
  "enabled": true
}
```

**⚠️ `category` 必须是枚举值之一**：`"knowledge_forcing" | "group_chat_boundary" | "scenario_injection" | "state_output" | "history_state" | "combat" | "custom"`。战斗类故事用 `"combat"`，其他用 `"custom"`。

### 7.3 两个机制的职责分工

| 位置 | 职责 | 内容 |
|------|------|------|
| `stageDetails[].guidance` | **阶段行为**（主） | 每阶段氛围、各角色技能分配、推进条件 |
| `promptRules[].content` | **跨阶段铁律**（辅） | 禁止跳跃、禁止提前使用高级技能、最大重复次数等全局规则 |

**不要在两个地方重复写阶段技能表。** 如果 stageDetails.guidance 已经写了"大姐用 **技能A** + **技能B**"，promptRules 就不需要再列一遍。promptRules 引用 stageDetails 即可。

### 7.4 运行时如何工作

LLM 收到的 prompt 中包含两块：
1. **剧情阶段信息**（从 stageDetails 生成）→ 当前阶段、所有阶段卡片（含 guidance）
2. **故事包规则**（从 promptRules 生成）→ 铁律文本

两者共同约束 LLM 行为。LLM 通过输出 `stageSuggestion: "stage_2"` 来推进阶段，系统检查建议的 stage id 是否在 `stages` 数组中。**不强制按顺序，不检查条件——完全靠 prompt 引导 LLM 自律。**

### 7.5 分支系统配置（抉择点）

故事支持在特定阶段通过显式选项让玩家选择不同的剧情走向。系统采用**混合方案**：大部分阶段由 LLM 自主判断推进，关键抉择点弹出明确选项。

**核心流程**：
```
LLM 到达抉择点阶段 → LLM 写出故事到达抉择时刻（不填 stageSuggestion）
  → 前端渲染 ChoiceCards，玩家点击选择
  → POST /api/game/sessions/:id/choose { branchIndex }
  → 服务端切换 currentStage → 自动继续下一轮
```

#### 7.5.1 配置抉择点

在 `stageDetails` 中对需要抉择的阶段添加 `isChoicePoint: true` 和 `branches` 数组：

```json
{
  "id": "stage_6",
  "title": "⑥ 花蕾绽放（抉择点）",
  "description": "小薇身体开始出现反应",
  "guidance": "氛围：小薇开始出现生理反应，内心挣扎...\n\n大姐：引导小薇接受身体变化...\n\n⚠️ 本轮必须把剧情推到抉择时刻。",
  "isChoicePoint": true,
  "branches": [
    {
      "targetStage": "stage_7a",
      "choiceText": "温柔引导",
      "condition": "小薇接受自己的身体反应",
      "description": "进入 A 路线：身体诚实、温柔顺从"
    },
    {
      "targetStage": "stage_7b",
      "choiceText": "严厉施压",
      "condition": "小薇因羞耻而更加抗拒",
      "description": "进入 B 路线：羞耻崩坏、顽固抵抗"
    }
  ]
}
```

**字段说明**：

| 字段 | 必填 | 说明 |
|------|------|------|
| `isChoicePoint` | 是 | 标记为抉择点，LLM 会收到特殊指令 |
| `branches[].targetStage` | 是 | 跳转目标阶段 id，必须在 `scenario.stages` 中 |
| `branches[].choiceText` | 推荐 | 前端按钮文本，不填则显示 targetStage |
| `branches[].condition` | 推荐 | 供 LLM 判断的触发条件 |
| `branches[].description` | 推荐 | 分支结果简述，前端辅助显示 |

#### 7.5.2 Prompt 生成行为

当 `isChoicePoint: true` 时，`promptService` 会自动注入特殊指令：

```
⚠️ 当前阶段是抉择点。你必须在此轮回复中把剧情推进到需要玩家做出选择的时刻...

抉择分支：
  选项1：温柔引导 → 进入 stage_7a（进入 A 路线：身体诚实、温柔顺从）
  选项2：严厉施压 → 进入 stage_7b（进入 B 路线：羞耻崩坏、顽固抵抗）

关键：本轮不要填写 stageSuggestion。等待玩家做出选择后系统会自动推进。
```

**LLM 职责**：把故事写到分叉时刻，但不做选择。让玩家通过 UI 决定走向。

#### 7.5.3 API 接口

```
POST /api/game/sessions/:id/choose
Content-Type: application/json

{
  "branchIndex": 0   // 分支数组索引，0 = 第一个选项
}

Response:
{
  "state": { /* 更新后的 GameState */ },
  "previousStage": "stage_6",
  "chosenBranch": { "targetStage": "stage_7a", "choiceText": "温柔引导", ... }
}
```

**后端逻辑**（`gameStateService.applyChoice`）：
1. 获取当前阶段详情，验证 `branches` 存在
2. 校验 `branchIndex` 合法性
3. 验证 `targetStage` 存在于 `scenario.stages`
4. 更新 `currentStage` → `targetStage`，`round += 1`

**前端逻辑**（`gameStore.chooseBranch`）：
1. 调用 API 应用选择
2. 清除 `pendingChoices`
3. 自动发起 `continueStory()` 进入下一轮

#### 7.5.4 分支后的阶段推进

分支后的阶段与普通阶段一样，LLM 继续通过 `stageSuggestion` 自主推进。多个分支可以汇合到同一阶段（如 A/B 路线在最终阶段合并）。

#### 7.5.5 当前故事包的分支结构（小薇日记）

```
⑥ 花蕾绽放（抉择点）
├─ A 路线 → ⑦A→⑧A→⑨A（身体诚实/温柔顺从）
└─ B 路线 → ⑦B→⑧B→⑨B（羞耻崩坏/顽固抵抗）
         ↓ 汇合
⑩ 慢火煎熬（抉择点）
├─ A 路线 → ⑪A→⑫A（泣诉屈服/温柔收束）
└─ B 路线 → ⑪B→⑫B（前后夹击/悬崖崩坠，三人桥段）
         ↓ 汇合
⑯ 傲骨碎裂（抉择点）
├─ A 路线 → ⑰A（柔情交付）
└─ B 路线 → ⑰B（仪式交付）
```

共 26 个阶段（20 个普通阶段 + 6 个分支阶段），3 个抉择点。

#### 7.5.6 分支阶段命名约定

- 主线阶段用数字编号：`stage_1`, `stage_2`, ...
- 分支目标用数字+字母：`stage_7a`, `stage_7b`, `stage_11a`, `stage_11b`
- 所有分支阶段 id 必须出现在 `scenario.stages` 数组中
- 汇合后恢复主线编号

---

## 八、Module-Flow 架构（v2）

v2 故事包支持**模块-流程分离架构**：将流程控制逻辑（判断/分支/循环）与故事内容模块分离。`flow.json` 描述"什么时候做什么判断"，`modules.json` 描述"每个阶段的具体内容"。不配置 `flow` 和 `modules` 时，系统回退到传统 stageDetails 模式（兼容 v1）。

### 8.1 核心概念

```
传统 v1：
  scenario.stageDetails → 35 个阶段卡片 → 全部注入 LLM prompt（信息过载）

v2 Module-Flow：
  modules.json → 独立的故事模块（41 个模块，各自有 type/guidance/exitCondition）
       +
  flow.json    → 流程控制图（4 个线性幕 + 1 个侍寝循环 + 终幕序列 + 日常体系）
       ↓
  PromptService 根据当前 stage 自动判定所处阶段
       → 只注入当前模块 + 相邻 2-3 个模块的 guidance（精准引导）
       → 侍寝循环时额外注入判定标准、当前循环数、可用惩戒菜单
```

### 8.2 流程阶段判定

`PromptService.buildStageGuide()` 根据 `state.scenario.currentStage` → 查找对应 module → 判定所处 flow 阶段：

| 判定结果 | 注入内容 | Prompt 格式 |
|----------|---------|------------|
| **线性训练** | 当前模块 + 下 2 个模块的 guidance | `【第一幕：落网废武】第 2/4 阶段` + 模块引导 |
| **侍寝循环** | 当前循环数 + 侍寝/惩戒模块 + 判定标准 + 惩戒菜单 + 日常体系 | `【侍寝循环】当前循环：第 2 次侍寝` + 三维评分阈值 + 可用惩戒 |
| **终幕** | 终幕序列 + 当前位置 | `【终幕】序列：㉛→㉜→㉟` + 当前模块引导 |

### 8.3 侍寝循环机制

```
侍寝循环（ServingLoop）：
  ┌──────────────────────────────────────────────────┐
  │  侍寝 → 帝王判定 → 满意?                          │
  │    │                    │                        │
  │    │                    ├─ YES → 终幕序列（㉛-㉟）  │
  │    │                    │                        │
  │    └─ 循环数≤4 → 不满意 → 对应惩戒模块            │
  │              → currentCycle++ → 下一侍寝模块       │
  │              → 日常惩罚叠加                        │
  │              → 回到侍寝（循环）                     │
  │    └─ 循环数>4 → 不满意 → 终极惩戒 → 重新侍寝       │
  └──────────────────────────────────────────────────┘
```

**判定标准自动注入**：

- **三维评分（score_3d）**：`身体配合度 + 声音表达度 + 眼神臣服度`，每项 1-5 分。通过阈值随循环递增：循环1 ≥7分(单项≥2) → 循环2 ≥8分(单项≥2) → 循环3 ≥10分(单项≥3) → 默认 ≥12分(单项≥4)
- **四重考验+随机（score_4trials_random）**：口交 + 呻吟 + 亲吻 + 禁止高潮，全部通过后 50% 随机判定

**后端自动追踪**：`GameStateService.applyAssistantTurn()` 检测 stage 从 serving 模块切换到 punishment 模块时自动 `currentCycle++`。

### 8.4 flow.json 配置示例

```json
{
  "id": "flow_lengshuang_main",
  "title": "冷霜风云主线流程",
  "linearPhases": {
    "act1_capture": {
      "title": "第一幕：落网废武",
      "sequence": ["mod_stage_1", "mod_stage_2", "mod_stage_3", "mod_stage_4"],
      "afterAll": "act2_initiation"
    }
  },
  "servingLoop": {
    "id": "serving_loop",
    "title": "侍寝循环",
    "serveModuleByCycle": {
      "1": "mod_stage_21",
      "2": "mod_stage_23",
      "3": "mod_stage_25",
      "4": "mod_stage_26",
      "default": "mod_stage_29"
    },
    "punishModuleByCycle": {
      "1": "mod_stage_22",
      "2": "mod_stage_24",
      "3": "mod_stage_27",
      "4": "mod_stage_28",
      "default": "mod_stage_30"
    },
    "judgmentNode": {
      "id": "judge_emperor_satisfaction",
      "type": "judgment",
      "judge": "emperor",
      "scoringMethods": {
        "score_3d": {
          "dimensions": {
            "bodyCoordination": { "name": "身体配合度", "min": 1, "max": 5 },
            "voiceExpression": { "name": "声音表达度", "min": 1, "max": 5 },
            "eyeSubmission": { "name": "眼神臣服度", "min": 1, "max": 5 }
          },
          "thresholdsByCycle": {
            "1": { "total": 7, "perDimension": 2 },
            "2": { "total": 8, "perDimension": 2 }
          }
        }
      },
      "routes": {
        "satisfied": { "target": "finale_sequence", "targetModule": "mod_stage_31" },
        "unsatisfied": { "target": "serving_loop.punishThenReServe" }
      }
    }
  },
  "finaleSequence": {
    "sequence": ["mod_stage_31", "mod_stage_32", "mod_stage_33", "mod_stage_34", "mod_stage_35"]
  }
}
```

### 8.5 modules.json 配置示例

```json
{
  "id": "mod_stage_21",
  "sourceStage": "stage_21",
  "title": "㉑ 侍寝（全副束缚·背后式）",
  "type": "serving",
  "reusable": true,
  "description": "双手反绑+口塞+眼罩+阴塞+肛塞——五件全副。帝王在背后占有冷霜。",
  "guidance": "氛围：完全束缚中的被动承受、五感剥夺的异样刺激\n\n冷霜：**全副束缚**（无法言语、无法看见、只能感受+身体自动反应）\n帝王：**帝王亲临**（第一次直接面对冷霜+用行动审判）\n→ 帝王判断满意/不满意",
  "enterWhen": "冷霜完成 ⑳ 意志崩坏后进入侍寝循环",
  "exitCondition": "帝王做出满意/不满意判断"
}
```

### 8.6 v1 / v2 兼容

| 特性 | v1（无 flow/modules） | v2（有 flow/modules） |
|------|----------------------|----------------------|
| 阶段引导 | 全部 35 阶段 dump 到 prompt | 只注入当前模块 + 相邻模块 |
| 循环追踪 | 无，LLM 自主判断 | `currentCycle` 自动递增 |
| 判定标准 | 依赖 promptRules 文本 | flow.json 结构化定义，自动注入 |
| 模块复用 | 不支持 | `reusable: true` 模块可被多次调用 |
| 惩戒菜单 | 硬编码在规则文本中 | `punishmentMenu` 结构化定义 |

**向后兼容**：`storyPackageSchema` 中 `modules` 和 `flow` 均为可选字段。不配置时 `PromptService` 自动回退到 v1 的全量 stageDetails dump。

---

## 九、创建新故事包的完整流程

### Step 1：创建目录

```bash
mkdir -p apps/data/task-packages/{story_id}/{knowledge,media,prompts,assets/performances,saves}
```

### Step 2：编写 characters.json

定义所有角色，每个角色必填：`id`, `name`, `role`, `avatar`, `personaPrompt`。

### Step 3：编写 skills.json

为每个角色定义技能（至少 4-5 个），**所有字段必填**。确保 `description` 不为空。

### Step 4：编写 knowledge/documents.json

为每个角色写一个知识库文档，包含：
- 角色定位（名称、身份、气质、行动原则、说话风格）
- 每项技能的详细条目（按 4.1 的格式）
- 角色整体判断（按阶段指导行为）

### Step 5：编写 prompts/rules.json

至少包含：
- 一条 `knowledge_forcing` 规则（强制 LLM 查阅知识库并用粗体）
- 一条 `group_chat_boundary` 规则（控制发言顺序）
- 一条阶段铁律规则（`custom` 或 `combat`，只写跨阶段禁止事项，不写每阶段技能分配。每阶段技能写在各 stageDetail.guidance 中）

### Step 6：编写 manifest.json

为每个技能的 `knowledgeUse` 触发配置一个表演条目。audio 文件路径必须指向存在的文件（可以先放通用的 wuxia_sfx 音效）。

### Step 7：编写 story.json

将上述所有内容整合到 story.json：
```json
{
  "id": "story_id",
  "title": "故事标题",
  "description": "简介",
  "storySettingPrompt": "从 prompts/story-setting.md 读取",
  "scenario": { /* 从 scenario 定义 */ },
  "characters": [ /* 从 characters.json 读取 */ ],
  "skills": [ /* 从 skills.json 读取 */ ],
  "knowledgeDocuments": [ /* 从 knowledge/documents.json 读取 */ ],
  "promptRules": [ /* 从 prompts/rules.json 读取 */ ],
  "modules": [ /* v2 可选：从 modules.json 读取 */ ],
  "flow": { /* v2 可选：从 flow.json 读取 */ },
  "debugConfig": {
    "showPromptLayers": false,
    "showRawOutput": false,
    "showValidation": false
  },
  "pluginManifest": null,
  "createdAt": "2026-05-28T00:00:00.000Z",
  "updatedAt": "2026-05-28T00:00:00.000Z"
}
```

### Step 8：验证并重启

```bash
# 启动 API 服务验证
cd apps/api && npm run dev
# 观察日志，确保 "story packages loaded" 且无 ZodError
# 如果报错，根据 ZodError 的 path 定位问题字段
```

---

## 十、常见错误及修复

| 错误 | 原因 | 修复 |
|------|------|------|
| `ZodError: skills/X/description: Required` | skill 缺少 `description` 字段 | 为每个 skill 添加 `"description": "..."` |
| `ZodError: promptRules/X/category: Required` | promptRule 缺少 `category` 或值不在枚举中 | 设为 `"custom"` 或 `"combat"` 等合法值 |
| `Plugin manifest references missing file` | manifest 中的 audio/images 路径指向不存在的文件 | 检查路径拼写，或使用已知存在的音频文件 |
| 表演不触发 | 触发词不匹配或 LLM 没输出粗体 | 检查 knowledge doc 中是否要求 `**粗体**`，检查 keywords 是否一致 |
| 故事一直停在早期阶段 | 缺少阶段渐进规则 | 添加 `rule_stage_progression` promptRule |
| story.json 与独立文件不同步 | 只改了独立文件没改 story.json | 修改后必须同步更新两边，或用 rebuild 脚本重新打包 |
| `modules`/`flow` 有内容但 Prompt 仍用 v1 | 未重启 API 服务或 story.json 缺少字段 | 重启 API，检查 story.json 中 `modules` 和 `flow` 字段存在 |
| 侍寝循环判定标准不生效 | flow.json 缺少 `judgmentNode` 配置 | 检查 `servingLoop.judgmentNode.scoringMethods` 配置完整性 |
| `matchBoldOnly: true` 但表演不触发 | LLM 没有用 `**粗体**` 包裹关键词 | 在知识库的输出要求中明确写"必须出现 **技能名**" |

---

## 十一、检查清单（提交前逐项核对）

- [ ] 所有 skill 有 `description` 字段
- [ ] 所有 promptRule 有 `category` 字段（枚举值之一）
- [ ] 所有 knowledgeDocument 有 `createdAt` 和 `updatedAt`
- [ ] manifest.json 中所有 `audio.main` 路径指向真实存在的文件
- [ ] `performances` 中的 `trigger.keywords` 与知识库中的 `触发词` 一致
- [ ] `story.json` 与各独立拆分文件内容同步（含 `flow.json`、`modules.json`）
- [ ] 每个角色有"整体判断"章节（阶段路线图）
- [ ] 有阶段渐进规则（promptRules 中）
- [ ] 抉择点阶段：`isChoicePoint: true`，`branches` 非空，每个 `targetStage` 在 `stages` 中
- [ ] 分支目标阶段 id 符合命名约定（数字+字母），已加入 `stages` 数组
- [ ] A/B 路线有对应的 guidance 内容（不依赖默认占位）
- [ ] （v2）`modules.json` 中所有 module 的 `id` 与 `flow.json` 中引用的模块 id 一致
- [ ] （v2）`servingLoop.judgmentNode` 的 `scoringMethods` 配置完整
- [ ] （v2）`modules.json` 中每个 module 有 `guidance` 字段（LLM 核心引导文本）
- [ ] API 服务启动无 ZodError
- [ ] `story packages loaded` 日志中 count 正确
