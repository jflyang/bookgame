# AI 故事生成 → 编辑器 → 游戏包 完整设计方案

## 总体流程

```
用户输入故事描述 + 风格提示词
        ↓
  [Step 1] AI 生成故事大纲（角色 + 阶段列表 + 分支结构）
        ↓
  用户确认/微调大纲
        ↓
  [Step 2] AI 逐阶段生成详细内容（guidance、description、directive）
        ↓
  自动组装为完整故事包文件
        ↓
  在编辑器中打开（flow 画布可视化）
        ↓
  用户微调（拖拽节点、编辑内容、绑定演出）
        ↓
  导出为 game 可加载的故事包
```

---

## Step 1：AI 输出 JSON Schema

### 输入

```json
{
  "description": "虚竹得知丁春秋欺师灭祖，在乔峰段誉陪同下前往星宿海清理门户",
  "style": "武侠，金庸风格，有分支选择",
  "stageCount": 18,
  "branchCount": 3,
  "characters": [
    { "name": "虚竹", "role": "主角" },
    { "name": "乔峰", "role": "辅助" },
    { "name": "段誉", "role": "观察者" },
    { "name": "丁春秋", "role": "反派" }
  ]
}
```

> `characters` 可选。如果不提供，AI 自动根据描述生成角色。

### 输出（大纲阶段）

```json
{
  "title": "虚竹除害星宿老怪",
  "premise": "...",
  "setting": "北宋年间，武林纷争...",
  "characters": [
    {
      "id": "xuzhu",
      "name": "虚竹",
      "role": "行动者",
      "description": "少林小僧，性格木讷仁厚，身负逍遥派百年内力"
    }
  ],
  "stages": [
    {
      "id": "stage_001",
      "title": "① 师门血债",
      "description": "虚竹在少林寺藏经阁发现丁春秋的罪行...",
      "stageType": "training",
      "enterWhen": "故事开局",
      "sortKey": 0
    },
    {
      "id": "stage_007",
      "title": "⑦ 三道抉择",
      "description": "虚竹面临选择...",
      "stageType": "choice",
      "isChoicePoint": true,
      "branches": [
        { "choiceText": "仁道正法", "description": "以武学感化弟子" },
        { "choiceText": "智道布局", "description": "潜入揭露真相" },
        { "choiceText": "勇道强攻", "description": "正面碾压" }
      ],
      "sortKey": 6
    }
  ],
  "flow": {
    "mainLine": ["stage_001", "stage_002", "stage_003", "stage_004", "stage_005", "stage_006"],
    "choicePoint": "stage_007",
    "branches": {
      "A": ["stage_008a", "stage_009a", "stage_010a", "stage_011a", "stage_012a"],
      "B": ["stage_008b", "stage_009b", "stage_010b", "stage_011b", "stage_012b"],
      "C": ["stage_008c", "stage_009c", "stage_010c", "stage_011c", "stage_012c"]
    },
    "converge": "stage_013",
    "finale": ["stage_013", "stage_014", "stage_015", "stage_016", "stage_017", "stage_018"]
  }
}
```

---

## Step 2：逐阶段生成详细内容

大纲确认后，对每个 stage 调用 AI 生成：

### 输入（每个 stage）

```json
{
  "storyContext": "故事标题 + premise + setting + 角色列表",
  "previousStage": "上一个阶段的 title + description（提供连贯性）",
  "currentStage": { "id": "stage_003", "title": "③ 毒雾漫山", "description": "..." },
  "instruction": "为这个阶段生成详细的 guidance（氛围描写 + 角色对话示例 + 推进条件）和 directive（AI 必须遵守的指令）"
}
```

### 输出

```json
{
  "guidance": "氛围：惨绿色的毒雾如同活物...\n\n丁春秋：**袖袍连挥**...\n→ 推进条件：虚竹以北冥真气将毒雾逼退三尺",
  "directive": "丁春秋必须率先释放星宿毒雾。乔峰应立即提醒虚竹运转北冥真气护体。"
}
```

---

## Step 3：组装为故事包文件

AI 输出 → 自动转换为以下文件：

| 文件 | 来源 |
|------|------|
| `package.json` | 自动生成（id = `story_<name>_<random>`） |
| `manifest.json` | `{ title, description, version: "2.0.0", performances: {} }` |
| `scenario.json` | 从大纲的 stages + flow 结构组装 |
| `modules.json` | 每个 stage → 一个 module |
| `flow.json` | 从 flow 结构生成 nodes + edges（自动布局） |
| `characters.json` | 从大纲的 characters 生成 |
| `setting.md` | 从大纲的 setting 字段 |
| `actions.json` | 空数组（用户后续手动添加） |
| `reactions.json` | 空数组 |
| `skills.json` | 空数组 |
| `knowledge.json` | 空数组 |
| `rules.json` | 默认规则模板 |
| `ui-config.json` | `{}` |

---

## Step 4：后端接口设计

### `POST /api/editor/ai/generate-outline`

生成故事大纲（Step 1）。

```typescript
// Request
{ description: string; style?: string; stageCount?: number; branchCount?: number; characters?: { name: string; role: string }[] }

// Response
{ ok: true; outline: OutlineData }  // OutlineData = Step 1 的输出格式
```

### `POST /api/editor/ai/generate-stage-detail`

为单个阶段生成详细内容（Step 2）。

```typescript
// Request
{ outline: OutlineData; stageId: string; previousGuidance?: string }

// Response
{ ok: true; guidance: string; directive: string }
```

### `POST /api/editor/ai/create-package`

将完整数据组装为故事包并写入磁盘。

```typescript
// Request
{ outline: OutlineData; stageDetails: Record<string, { guidance: string; directive: string }> }

// Response
{ ok: true; packagePath: string; packageId: string }
```

---

## Step 5：前端 UI 设计

### 入口

story-editor 首页（包列表页）增加按钮：**「🤖 AI 创建新故事」**

### 生成对话框（3 步向导）

**第 1 页：输入描述**
```
┌─────────────────────────────────────────┐
│  🤖 AI 创建新故事                        │
│                                         │
│  故事描述：                              │
│  ┌─────────────────────────────────────┐│
│  │ 虚竹得知丁春秋欺师灭祖...           ││
│  └─────────────────────────────────────┘│
│                                         │
│  风格提示词（可选）：                     │
│  ┌─────────────────────────────────────┐│
│  │ 武侠，金庸风格，有分支选择           ││
│  └─────────────────────────────────────┘│
│                                         │
│  阶段数量：[18]  分支数：[3]             │
│                                         │
│  角色（可选，留空自动生成）：             │
│  [+ 添加角色]                            │
│                                         │
│              [取消]  [生成大纲 →]         │
└─────────────────────────────────────────┘
```

**第 2 页：确认大纲**
```
┌─────────────────────────────────────────┐
│  📋 故事大纲预览                         │
│                                         │
│  标题：虚竹除害星宿老怪                   │
│  角色：虚竹(主角) 乔峰(辅助) ...         │
│                                         │
│  阶段列表：                              │
│  ① 师门血债 [training]                   │
│  ② 山路初遇 [training]                   │
│  ③ 毒雾漫山 [training]                   │
│  ...                                    │
│  ⑦ 三道抉择 [choice] ← 分支点           │
│    ├─ A: 仁道正法 (5 阶段)              │
│    ├─ B: 智道布局 (5 阶段)              │
│    └─ C: 勇道强攻 (5 阶段)              │
│  ⑬ 生死符现 [event] ← 汇聚             │
│  ...                                    │
│                                         │
│  [← 返回修改]  [确认，生成详细内容 →]     │
└─────────────────────────────────────────┘
```

**第 3 页：生成进度**
```
┌─────────────────────────────────────────┐
│  ⏳ 正在生成详细内容...                   │
│                                         │
│  ████████████░░░░░░░░  12/18 阶段       │
│                                         │
│  ✅ ① 师门血债                           │
│  ✅ ② 山路初遇                           │
│  ✅ ③ 毒雾漫山                           │
│  ...                                    │
│  🔄 ⑫ 内力碾压 (生成中...)               │
│  ⏳ ⑬ 生死符现                           │
│  ...                                    │
│                                         │
│  预计剩余时间：约 2 分钟                  │
│                                         │
│              [取消]                       │
└─────────────────────────────────────────┘
```

**完成后：**
- 自动在 `apps/data/task-packages/` 下创建新目录
- 自动在编辑器中打开
- 用户可以在 flow 画布上看到完整的故事流程图

---

## Prompt 模板设计

### System Prompt（大纲生成）

```
你是一个互动故事架构师。用户会给你一段故事描述，你需要输出一个结构化的故事大纲 JSON。

输出格式要求：
1. title: 故事标题
2. premise: 一句话概括故事前提
3. setting: 世界观背景（200字以内）
4. characters: 角色数组，每个含 id/name/role/description
5. stages: 阶段数组，每个含 id/title/description/stageType/enterWhen/sortKey
6. flow: 流程结构（mainLine/choicePoint/branches/converge/finale）

stageType 枚举：training（铺垫）、serving（主角优势）、punishment（反派反扑）、
choice（抉择点）、event（高潮事件）、daily（可循环）

设计原则：
- training 阶段放在开头（3-5个），用于铺垫和角色登场
- serving 和 punishment 交替出现，形成叙事张力
- choice 有且仅有一个抉择点（除非用户要求多个）
- event 用于高潮节点（2-3个）
- 每个分支路线长度相同
- 所有分支最终汇聚到同一个 converge 阶段

用 ```json 代码块包裹输出。
```

### System Prompt（阶段详情生成）

```
你是一个互动故事编剧。根据故事大纲和当前阶段信息，为这个阶段生成详细的 guidance 和 directive。

guidance 格式：
- 第一段：氛围描写（环境、感官细节、情绪基调）
- 中间：角色对话示例（格式：角色名：**动作**（描述）「台词」）
- 最后一行：→ 推进条件：xxx

directive 格式：
- 简短的强制指令，告诉 AI 这个阶段必须发生什么、不能跳过什么

要求：
- guidance 500-800字
- directive 1-2句话
- 对话要有画面感，体现角色性格
- 推进条件要明确、可判断

用 ```json 代码块包裹输出，格式：{ "guidance": "...", "directive": "..." }
```

---

## 技术实现要点

### DeepSeek 调用

复用现有的 `AiAssistant` 类，扩展方法：

```typescript
class AiAssistant {
  // 已有
  async suggest(req): Promise<AiSuggestionResponse>

  // 新增
  async generateOutline(input: GenerateInput): Promise<OutlineData>
  async generateStageDetail(outline: OutlineData, stageId: string, prev?: string): Promise<{ guidance: string; directive: string }>
}
```

### Token 预算

- 大纲生成：输入 ~500 tokens，输出 ~3000 tokens → 一次调用
- 阶段详情：输入 ~1000 tokens，输出 ~800 tokens → 每阶段一次
- 18 阶段总计：约 18 次 API 调用，总 token ~35000

DeepSeek-chat 的 context window 是 64K，单次调用没问题。

### 并发控制

阶段详情生成可以并发（3-5 个同时），但需要：
- 限制并发数避免 rate limit
- 失败重试（最多 2 次）
- 前端显示实时进度

### 自动布局

生成 flow.json 时自动计算节点位置：
- 主线：水平排列，间距 280px
- 分支：垂直偏移 160px
- 汇聚后：回到主线 y 坐标

---

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `server/aiAssistant.ts` | 扩展：新增 generateOutline / generateStageDetail 方法 |
| `server/index.ts` | 新增 3 个 API 路由 |
| `server/storyPackageIO.ts` | 新增 createPackageFromAI 方法（组装文件写入磁盘） |
| `src/components/AiGenerateWizard.tsx` | 新建：3 步向导 UI 组件 |
| `src/components/PackageListPage.tsx`（或首页） | 增加"AI 创建"按钮入口 |

---

## 时间估算

| 步骤 | 工作量 |
|------|--------|
| Prompt 模板 + Schema 定义 | 1 小时 |
| 后端 3 个 API 接口 | 2 小时 |
| 前端 3 步向导 UI | 3 小时 |
| 自动布局 + 文件组装 | 2 小时 |
| 测试 + 修复 AI 输出格式问题 | 2 小时 |
| **总计** | **~10 小时** |
