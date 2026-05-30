# 游戏包 V2 → V3 升级方案

## V2 的问题

```
story_a_CW69KOgU/
├── story.json       ← 625KB 怪物文件，包含一切
├── characters.json  ← 和 story.json 重复
├── modules.json     ← 和 story.json 重复
├── scenario.json    ← 和 story.json 重复
├── skills.json      ← 已废弃（战斗技能）
├── knowledge/
│   └── documents.json
├── prompts/
│   ├── rules.json
│   └── story-setting.md
├── ui/config.json   ← 几乎无用
├── manifest.json
├── assets/performances/
└── flow.json        ← 混乱：有时是 ReactFlow，有时是 FlowDefinition
```

**核心问题**：`story.json` 和拆分文件双向同步，经常不一致。

## V3 结构

```
story_name/
├── package.json      ← { schemaVersion:"3", id, title, description, createdAt, updatedAt }
├── scenario.json     ← scenario（stages + stageDetails + branches）
├── flow.json         ← ReactFlow nodes/edges + FlowDefinition + modules（单一真相源）
├── characters.json   ← 角色定义
├── actions.json      ← 主动技能
├── reactions.json    ← 被动技能
├── knowledge.json    ← 角色知识库（纯角色定位，无战斗技能）
├── rules.json        ← Prompt 管线规则
├── setting.md        ← 故事世界观设定
├── manifest.json     ← 演出配置（performances）+ 基本信息
└── media/
    └── performances/ ← 用户上传的图片/音频
```

**原则**：
- 一文件一职责，无重复数据
- 根目录扁平化，无嵌套子目录
- `package.json` 替代 `story.json` 作为入口
- `flow.json` 统一管理流程数据

## V2 → V3 字段映射

| V2 位置 | V3 位置 | 说明 |
|---------|---------|------|
| `story.json` | `package.json` | 只保留 id/title/description/schemaVersion |
| `story.json.scenario` | `scenario.json` | 内容不变 |
| `story.json.flow` + `flow.json` | `flow.json` | 合并为单一文件 |
| `story.json.modules` | `flow.json.modules` | 嵌入 flow |
| `characters.json` | `characters.json` | 去掉 attackableTargetIds/rules |
| `story.json.skills` | **废弃** | 战斗技能，不迁移 |
| `story.json.actions` | `actions.json` | 新增 |
| `story.json.reactions` | `reactions.json` | 新增 |
| `knowledge/documents.json` | `knowledge.json` | 只保留角色定位 |
| `prompts/rules.json` | `rules.json` | 只保留通用规则 |
| `prompts/story-setting.md` | `setting.md` | 内容不变 |
| `manifest.json` | `manifest.json` | 只保留 title/description/performances |
| `ui/config.json` | **废弃** | 有用字段已在编辑器合并 |
| `assets/performances/` | `media/performances/` | 目录重命名 |
| `story.json.storySettingPrompt` | `setting.md` | 内容不变 |

## V3 文件格式

### package.json
```json
{
  "schemaVersion": "3",
  "id": "story_a_CW69KOgU",
  "title": "小薇的身体",
  "description": "大学生小薇被少爷和大姐逐步调教...",
  "createdAt": "2026-05-29T14:22:02.053Z",
  "updatedAt": "2026-05-30T12:00:00.000Z"
}
```

### flow.json（单一文件包含所有流程数据）
```json
{
  "id": "flow_default",
  "title": "小薇日记",
  "nodes": [...],        // ReactFlow 节点（编辑器布局）
  "edges": [...],        // ReactFlow 边
  "linearPhases": {...}, // 阶段分组（运行时用）
  "modules": [...]       // 模块定义
}
```

### characters.json
```json
[
  {
    "id": "da_jie",
    "name": "大姐",
    "role": "首席女仆长",
    "avatar": "",
    "personaPrompt": "你是经验丰富、冷艳的女仆长..."
  }
]
```
字段变化：移除 `rules`、`knowledgeBaseIds`、`attackableTargetIds`。

### manifest.json（简化）
```json
{
  "title": "小薇的身体",
  "description": "...",
  "version": "3.0.0",
  "performances": {
    "perf_stage_1": {
      "name": "① 囚鸟入笼",
      "renderer": "image",
      "durationMs": 6000,
      "trigger": { "type": "stageEnter", "stageId": "stage_1" },
      "layers": { "main": "media/performances/stage_1.jpg" }
    }
  }
}
```

## 实施改造的文件

### 编辑器侧
| 文件 | 改动 |
|------|------|
| `apps/story-editor/server/storyPackageIO.ts` | 新增 V3 读写逻辑，兼容 V2 |
| `apps/story-editor/server/index.ts` | `saveFlowNodesEdges` 适配 V3 路径 |

### 游戏 API 侧
| 文件 | 改动 |
|------|------|
| `apps/api/src/data/taskPackageRepository.ts` | 新增 V3 加载，兼容 V2 |

### 共享类型
| 文件 | 改动 |
|------|------|
| `packages/shared/src/index.ts` | `StoryPackage` 类型保持不变（运行时用），新增 V3 包格式类型 |

## 迁移脚本

```bash
node scripts/migrate-v2-to-v3.cjs <story-dir>
```

脚本逻辑：
1. 读取 `story.json` → 提取 `package.json` 字段
2. 已有独立文件（`characters.json`、`scenario.json`）直接保留
3. 从 `story.json` 提取 `actions`/`reactions` → 写 `actions.json`/`reactions.json`
4. 重命名 `knowledge/documents.json` → `knowledge.json`
5. 重命名 `prompts/rules.json` → `rules.json`
6. 重命名 `prompts/story-setting.md` → `setting.md`
7. 重命名 `assets/performances/` → `media/performances/`
8. 合并 `story.json.flow` + `flow.json` → 新 `flow.json`
9. 简化 `manifest.json`
10. 删除 `story.json`、`skills.json`、`ui/config.json`、`modules.json`、旧子目录

## 验证清单

- [ ] 编辑器能打开 V3 包并编辑
- [ ] 编辑器能打开 V2 包（向后兼容）
- [ ] 游戏能加载 V3 包并运行
- [ ] Ctrl+S 保存写入正确文件
- [ ] 演出图片上传到 `media/performances/`
- [ ] 导出 ZIP 包含 V3 结构
- [ ] 导入 ZIP 正确识别 V2/V3
