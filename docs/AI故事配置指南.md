# AI 故事配置指南

本指南说明如何创建和配置一个完整的互动故事包。以默认故事「虚竹除害星宿老怪」为例。

## 故事包结构

```
apps/data/task-packages/虚竹/
├── story.json              主配置（标题、描述、设定）
├── manifest.json           插件清单（能力声明、演出配置）
├── scenario.json           剧情场景（阶段、分支、目标）
├── characters.json         角色定义（人设、技能绑定）
├── skills.json             技能定义（消耗、伤害、效果）
├── modules.json            故事模块（可选，用于 flow 系统）
├── flow.json               流程定义（可选，线性/循环/终幕）
├── knowledge/              知识库文档
│   └── documents.json
├── prompts/                提示词
│   ├── story-setting.md    故事设定 Prompt
│   └── rules.json          提示词规则
├── ui/                     UI 主题配置
│   └── config.json
├── media/                  缩略图等
│   └── thumbnail.png
├── assets/performances/    演出资源（音效、图片）
└── saves/                  存档（运行时生成）
```

## 1. 角色配置（characters.json）

每个角色需要定义身份、人设和行为规则。

```json
[
  {
    "id": "qiaofeng",
    "name": "乔峰",
    "role": "主导者",
    "avatar": "乔",
    "personaPrompt": "你是乔峰，丐帮前帮主，性格豪迈刚烈，重情重义。武功以降龙十八掌和擒龙功为主。说话直爽，不拐弯抹角。",
    "rules": ["保护虚竹和段誉", "不会主动杀人"],
    "skillIds": ["xianglong_kanglongyouhui", "qinlong_gong"],
    "knowledgeBaseIds": ["kb_wulin"]
  },
  {
    "id": "xuzhu",
    "name": "虚竹",
    "role": "行动者",
    "avatar": "虚",
    "personaPrompt": "你是虚竹，少林弟子，性格温和谦逊。身负逍遥派武功，内力深厚但不愿伤人。说话带佛门用语。",
    "rules": ["慈悲为怀", "尽量不杀生"],
    "skillIds": ["tianshan_zhemeishou", "tianshan_liuyang", "beiming_zhenqi"],
    "knowledgeBaseIds": ["kb_wulin"]
  }
]
```

### 角色字段说明

| 字段 | 说明 |
|------|------|
| `id` | 唯一标识，英文小写+下划线 |
| `name` | 显示名称 |
| `role` | 角色定位（主导者/行动者/观察者/反派等） |
| `avatar` | 头像（单字或图片 URL） |
| `personaPrompt` | 人设描述，LLM 会据此生成对话 |
| `rules` | 行为约束规则 |
| `skillIds` | 可用技能 ID 列表 |
| `knowledgeBaseIds` | 绑定的知识库 |
| `attackableTargetIds` | 可攻击的目标角色 ID（可选） |

## 2. 技能配置（skills.json）

```json
[
  {
    "id": "xianglong_kanglongyouhui",
    "name": "降龙十八掌·亢龙有悔",
    "ownerId": "qiaofeng",
    "cost": {"mp": 30},
    "damage": {"min": 40, "max": 80},
    "effect": "天下第一刚猛掌法，掌力排山倒海"
  },
  {
    "id": "beiming_zhenqi",
    "name": "北冥神功",
    "ownerId": "xuzhu",
    "cost": {"mp": 50},
    "damage": {"min": 0, "max": 0},
    "effect": "吸取对手内力为己用"
  }
]
```

- `cost.mp`：内力消耗
- `damage`：伤害范围（0 表示非攻击技能）
- `effect`：效果描述（会出现在 Prompt 中）

## 3. 剧情配置（scenario.json）

```json
{
  "id": "xuzhu_vs_dingchunqiu",
  "title": "虚竹除害星宿老怪",
  "premise": "虚竹决定为逍遥派清理门户，与乔峰、段誉同行对抗丁春秋。",
  "currentStage": "stage_1",
  "currentGoal": "击败丁春秋",
  "stages": ["stage_1", "stage_2", "stage_3", "stage_4", "stage_5"],
  "stageDetails": [
    {
      "id": "stage_1",
      "title": "① 师门血债",
      "description": "虚竹得知丁春秋欺师灭祖的往事，决意下山。",
      "enterWhen": "故事开局",
      "guidance": "交代虚竹下山动机，展示三人关系。"
    },
    {
      "id": "stage_2",
      "title": "② 山路初遇",
      "description": "三人在星宿海山道遇见丁春秋和星宿弟子。",
      "enterWhen": "三人抵达星宿海",
      "guidance": "展示丁春秋的傲慢和星宿弟子的阿谀。"
    },
    {
      "id": "stage_3",
      "title": "③ 毒雾试探",
      "description": "丁春秋释放毒雾试探三人实力。",
      "enterWhen": "双方正面对峙",
      "guidance": "第一次小规模交手，展示各方实力。",
      "directive": "丁春秋必须先释放毒雾，乔峰用掌力压回。"
    }
  ],
  "rules": ["每次只推进一小步", "不要一次性说完整个故事"],
  "initialStates": [
    {"characterId": "qiaofeng", "hp": 700, "mp": 800},
    {"characterId": "xuzhu", "hp": 360, "mp": 2000},
    {"characterId": "duanyu", "hp": 180, "mp": 260},
    {"characterId": "dingchunqiu", "hp": 400, "mp": 180}
  ]
}
```

### 阶段字段说明

| 字段 | 说明 |
|------|------|
| `id` | 阶段唯一标识 |
| `title` | 阶段标题 |
| `description` | 阶段描述（LLM 可见） |
| `enterWhen` | 进入条件描述 |
| `guidance` | 给 LLM 的引导建议 |
| `directive` | 强制指令（LLM 必须执行的剧情） |
| `isChoicePoint` | 是否为分支选择点 |
| `branches` | 分支选项（仅选择点有效） |

### 分支配置

```json
{
  "id": "stage_6",
  "title": "⑥ 命运抉择",
  "isChoicePoint": true,
  "branches": [
    {"targetStage": "stage_7a", "choiceText": "仁道：以德服人"},
    {"targetStage": "stage_7b", "choiceText": "智道：智取巧胜"},
    {"targetStage": "stage_7c", "choiceText": "勇道：正面强攻"}
  ]
}
```

## 4. 故事设定（prompts/story-setting.md）

这是注入给 LLM 的背景设定文本：

```markdown
# 故事设定：虚竹除害星宿老怪

虚竹得知丁春秋原是逍遥派叛逆，欺师灭祖，另立星宿派，以毒功残害江湖中人。
虚竹决定出手，为门派清理门户。乔峰与段誉同行。

## 规则
- 初始状态：虚竹 气血:360 内力:2000；乔峰 气血:700 内力:800
- 不要一次性说完整个故事，每次只推进一小步
- 使用知识库招式时用 **粗体** 标出
```

## 5. 提示词规则（prompts/rules.json）

控制 LLM 行为的规则列表：

```json
[
  {
    "id": "rule_knowledge",
    "title": "知识库强制使用",
    "content": "每次回复必须体现至少一项知识库/技能内容。运用知识库内容时用 **粗体** 显示。",
    "enabled": true
  },
  {
    "id": "rule_group",
    "title": "群聊规则",
    "content": "你只能以当前角色身份说话。不能描述其他角色的动作或心理。",
    "enabled": true
  }
]
```

规则支持变量替换：
- `{currentCharacterName}` — 当前发言角色名
- `{otherCharacterNames}` — 其他角色名
- `{scenarioSetting}` — 当前阶段描述
- `{currentGameState}` — 当前状态

## 6. 知识库（knowledge/documents.json）

为角色提供专业知识，LLM 会根据对话内容检索相关知识：

```json
[
  {
    "id": "kb_wulin",
    "title": "武林秘籍",
    "ownerId": "qiaofeng",
    "content": "## 降龙十八掌\n天下第一刚猛掌法。\n- 亢龙有悔：掌力排山倒海\n- 飞龙在天：跃起从空中击下\n\n## 擒龙功\n隔空取物的内力运用。"
  }
]
```

## 7. UI 配置（ui/config.json）

自定义游戏界面外观：

```json
{
  "layout": {
    "showCharacterPanel": true,
    "showQuickActions": true,
    "showAutoPlay": true
  },
  "theme": {
    "primaryColor": "#1f5b51",
    "accentColor": "#2b987a",
    "backgroundColor": "#f7f1e7",
    "headingFont": "STKaiti",
    "bodyFont": "Inter"
  },
  "scene": {
    "heading": "星宿海",
    "introNarration": "暮色低垂，寒风凛冽，山道上两道人影对峙。",
    "emptyTitle": "山道毒雾初起",
    "emptyHint": "输入内容开始冒险"
  },
  "avatar": {
    "style": "gradient"
  }
}
```

## 8. 插件清单（manifest.json）

声明故事包的能力和演出配置：

```json
{
  "id": "虚竹",
  "type": "story-plugin",
  "schemaVersion": "2",
  "title": "虚竹除害星宿老怪",
  "capabilities": {
    "audio": true,
    "performances": true,
    "characterPortraits": false,
    "backgroundImages": false
  },
  "audio": {"bgm": {"scenes": {}}, "sfx": {}},
  "images": {"portraits": {}, "backgrounds": {}},
  "fonts": {},
  "performances": {
    "sfx_qiaofeng_kanglong": {
      "name": "降龙十八掌",
      "renderer": "audio",
      "durationMs": 3000,
      "trigger": {
        "type": "knowledgeUse",
        "characterId": "qiaofeng",
        "keywords": ["降龙十八掌", "亢龙有悔"],
        "matchBoldOnly": false
      },
      "playOnce": "never",
      "layers": {},
      "audio": {"main": "assets/performances/wuxia_sfx/audio/kanglong.wav"}
    }
  }
}
```

## 创建新故事包的步骤

1. **规划剧情**：确定角色、阶段、分支结构
2. **创建目录**：在 `apps/data/task-packages/` 下新建文件夹
3. **配置角色**：编写 `characters.json`，定义人设和技能
4. **配置技能**：编写 `skills.json`，定义消耗和伤害
5. **配置剧情**：编写 `scenario.json`，定义阶段和推进条件
6. **编写设定**：编写 `prompts/story-setting.md`
7. **配置规则**：编写 `prompts/rules.json`
8. **配置 UI**：编写 `ui/config.json`
9. **编写清单**：编写 `manifest.json`
10. **添加演出**：放入音效/图片资源，配置 performances

或者通过管理后台可视化创建，所有配置都可以在界面上编辑。

## 剧情推进机制

- LLM 在回复中通过 `stageSuggestion` 字段建议推进到下一阶段
- 系统验证建议的阶段是否在 `stages` 列表中
- 同一阶段超过 8 回合时，Prompt 会提示 LLM 推进
- 超过 20 回合强制推进到下一阶段
- 分支选择点由玩家手动选择，不自动推进

## 注意事项

- 角色 ID 只能用英文小写 + 下划线
- 每个故事包完全独立，不依赖公共资源
- 存档数据在 `saves/` 目录，不影响故事配置
- Session 状态持久化在 SQLite 中，服务重启不丢失
- 通过管理面板的「导出」功能可以打包分享故事包
