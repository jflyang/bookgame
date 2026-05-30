# Story Editor — AI 编辑引导地图

## 项目概述

本项目是一个**故事包可视化编辑器**，用于编辑互动叙事游戏的剧情流程、角色、技能、知识库等数据。

- **前端**: React 19 + Zustand + @xyflow/react + Vite
- **后端**: Express 5 (tsx 开发模式，Vite 中间件)
- **共享类型**: `@story-game/shared` monorepo 包
- **端口**: 前端 5174 (Vite dev) / 后端 4001 (Express)

---

## 架构分层

```
┌─────────────────────────────────────────────────────────┐
│  UI Layer (src/components/)                             │
│  纯展示 + 用户交互，不含业务逻辑                          │
├─────────────────────────────────────────────────────────┤
│  State Layer (src/store/)                               │
│  Zustand stores，管理应用状态和 CRUD 操作                 │
├─────────────────────────────────────────────────────────┤
│  Logic Layer (src/lib/)                                 │
│  纯函数，数据转换，布局算法，ID 生成                      │
├─────────────────────────────────────────────────────────┤
│  API Layer (src/lib/api.ts)                             │
│  HTTP 客户端，所有后端通信的唯一出口                      │
├─────────────────────────────────────────────────────────┤
│  Server Layer (server/)                                 │
│  Express 路由 + 文件 I/O + AI 集成                       │
└─────────────────────────────────────────────────────────┘
```

---

## 目录结构与职责

### `src/store/` — 状态管理 (2 个 store)

| 文件 | 职责 | 注意事项 |
|------|------|----------|
| `editorStore.ts` | 全局编辑器状态：加载/保存/CRUD 所有实体 | 是唯一调用 `api.ts` 的地方（除 FlowToolbar） |
| `flowStore.ts` | 流程编辑器状态：nodes/edges/modules | `getFlowData()` 含复杂图遍历逻辑，修改需谨慎 |

**耦合警告**: `editorStore` 直接调用 `useFlowStore.getState()`。修改 flowStore 接口时需同步检查 editorStore。

### `src/lib/` — 纯逻辑层 (10 个文件)

| 文件 | 职责 | 依赖 |
|------|------|------|
| `api.ts` | HTTP 客户端，所有 fetch 调用 | 无前端依赖 |
| `flowAdapter.ts` | `FlowDefinition ↔ FlowEditorState` 双向转换 | `flowTypes`, `@story-game/shared` |
| `flowLayout.ts` | 自动布局算法（节点定位） | `flowTypes` |
| `flowRunner.ts` | 流程模拟器（GameConsole 用） | `flowTypes`, `@story-game/shared` |
| `flowSync.ts` | Scenario → Module 同步 | `idGen`, `stageSort` |
| `flowTypes.ts` | TypeScript 接口定义 | `@story-game/shared` |
| `idGen.ts` | 唯一 ID 生成 (stage/module) | 无依赖 |
| `stageSort.ts` | 阶段排序/类型推断 | `@story-game/shared` |
| `storyStructure.ts` | 从 modules 重建 flow 结构 | `@story-game/shared` |
| `typeLabels.ts` | 节点类型的中文显示名 | 无依赖 |

### `src/components/` — UI 组件

#### 流程编辑器子系统 (`flow/`)

| 文件 | 行数 | 职责 |
|------|------|------|
| `FlowEditor.tsx` | ~537 | 主画布：拖拽、连线、右键菜单、模拟运行 |
| `FlowEditor/hooks/useConnection.ts` | 72 | 连线逻辑 hook |
| `FlowEditor/hooks/useUndoRedo.ts` | 63 | 撤销/重做 hook |
| `FlowToolbar.tsx` | 140 | 左侧工具箱 + 保存/布局/校验按钮 |
| `NodeEditModal.tsx` | ~493 | 节点编辑弹窗（多类型） |
| `ModuleDetailPanel.tsx` | 170 | 右侧模块详情面板 |
| `FlowAIPanel.tsx` | 305 | AI 分析/生成面板 |
| `GameConsole.tsx` | 161 | 流程模拟控制台 |
| `NodeContextMenu.tsx` | 88 | 右键菜单 |
| `ColoredEdge.tsx` | 57 | 自定义边样式 |
| `nodeTypes.ts` | 24 | 节点类型注册表 |
| `nodes/*.tsx` | 15-41 each | 11 种节点组件 |

#### 其他 Tab 组件

| 文件 | 行数 | 对应 Tab |
|------|------|----------|
| `ScenarioTimeline.tsx` | 347 | 剧情阶段 |
| `CharacterGraph.tsx` | 306 | 角色关系图 |
| `CharacterManager.tsx` | 244 | 角色管理 |
| `SkillTree.tsx` | 317 | 技能树 |
| `KnowledgeGraph.tsx` | 345 | 知识图谱 |
| `RulePipeline.tsx` | 285 | 规则管线 |
| `ManifestPanel.tsx` | 406 | 元数据 |
| `PerformanceMapper.tsx` | 423 | 演出映射 |
| `PerformanceEditor.tsx` | 250 | 演出编辑 |
| `UIConfigEditor.tsx` | ~100 | UI 配置 |
| `StorySettingEditor.tsx` | ~80 | 故事设定 |
| `MediaViewer.tsx` | ~80 | 媒体文件 |
| `AiAssistant.tsx` | ~120 | AI 助手 |
| `FileManager.tsx` | ~100 | 文件选择器 |

### `server/` — 后端 (4 个文件)

| 文件 | 行数 | 职责 |
|------|------|------|
| `index.ts` | 191 | Express 路由定义 + Vite 中间件 |
| `storyPackageIO.ts` | 217 | V3 故事包文件读写 |
| `aiAssistant.ts` | 104 | 通用 AI 建议 |
| `flowAIAssistant.ts` | 460 | 流程 AI 分析/生成/优化 |

---

## 数据流

### 打开故事包
```
FileManager → editorStore.openPackage(path)
  → api.openPackage(path) → server: openDirectory()
  → 返回 PackageState (storyPackage + flowNodes + flowEdges)
  → editorStore 设置全局状态
  → flowStore.initFromNodesEdges() 或 initFromData()
  → 如果无 flow 但有 scenario → syncFromScenario() 自动生成
```

### 保存
```
FlowToolbar "统一保存" → editorStore.save()
  → flowStore.getFlowData() 序列化 nodes/edges → FlowDefinition
  → api.saveStoryPackage(pkg)     → server: 写 package.json + scenario.json + ...
  → api.saveFlowNodesEdges(...)   → server: 写 flow.json (ReactFlow 格式)
  → api.saveManifest(...)         → server: 写 manifest.json
```

### 流程编辑
```
用户拖拽/连线 → FlowEditor 事件处理
  → useConnection hook (onConnect/onReconnect)
  → flowStore.addEdge/removeEdge/updateNodePosition
  → ReactFlow 重渲染
```

---

## 风险区域与注意事项

### 🔴 高风险 — 修改前必须理解全貌

1. **`flowStore.getFlowData()`** (~100 行)
   - 从 ReactFlow nodes/edges 反向重建 FlowDefinition
   - 涉及 phaseGroup 子节点排序、serving loop 边遍历、judgment 分支映射
   - **修改此函数可能导致保存数据丢失**
   - 测试方法：保存后重新打开，对比 flow.json 内容

2. **`flowLayout.ts` 的 `layoutServingLoop()`**
   - 硬编码了侍寝循环的节点结构（Serve → Event → Judgment → Random）
   - 修改布局可能导致 `getFlowData()` 无法正确反序列化
   - **布局和序列化是镜像关系，改一个必须改另一个**

3. **`editorStore.save()` 的保存顺序**
   - 先保存 storyPackage（含 flow 定义），再保存 nodes/edges（ReactFlow 格式）
   - 如果中间失败，flow.json 和 package.json 可能不一致
   - 未来应改为事务性保存

### 🟡 中风险 — 需要注意副作用

4. **`editorStore` ↔ `flowStore` 耦合**
   - editorStore.openPackage 直接调用 flowStore.initFromData
   - editorStore.save 直接调用 flowStore.getFlowData
   - 修改 flowStore 接口时必须同步更新 editorStore

5. **`flowAdapter.ts` 的 `fallbackFromModules()`**
   - 当 flow.json 无 linearPhases 时自动按 module.type 分组
   - 分组逻辑硬编码了 TYPE_GROUP 映射
   - 新增 module type 时需要更新此映射

6. **`NodeEditModal.tsx` (493 行)**
   - 一个组件处理所有节点类型的编辑表单
   - 新增节点类型时此文件会持续膨胀
   - 建议拆分为 `NodeEditModal/forms/` 子目录

### 🟢 低风险 — 可安全修改

7. **`nodes/*.tsx`** — 纯展示组件，无副作用
8. **`lib/idGen.ts`** — 纯函数，无依赖
9. **`lib/typeLabels.ts`** — 纯映射表
10. **`MediaViewer.tsx`** — 独立组件，不影响其他功能

---

## 编辑规则

### 添加新节点类型
1. `src/components/flow/nodes/` 创建新节点组件
2. `src/components/flow/nodeTypes.ts` 注册
3. `src/components/flow/FlowToolbar.tsx` 添加到工具箱
4. `src/components/flow/NodeEditModal.tsx` 添加编辑表单
5. `src/lib/flowLayout.ts` 如需自动布局支持
6. `src/lib/typeLabels.ts` 添加中文标签

### 添加新 Tab
1. `src/components/` 创建组件
2. `src/App.tsx` 的 TABS 数组添加条目 + 条件渲染

### 修改保存格式
1. `server/storyPackageIO.ts` — 文件读写
2. `src/store/flowStore.ts` 的 `getFlowData()` — 序列化
3. `src/lib/flowAdapter.ts` — 反序列化
4. **三者必须保持一致**

### 修改 API 接口
1. `server/index.ts` — 路由定义
2. `src/lib/api.ts` — 客户端调用
3. `src/store/editorStore.ts` — 调用 api 的 action

---

## 待重构项（技术债）

| 优先级 | 项目 | 原因 |
|--------|------|------|
| P1 | `flowStore.getFlowData()` 提取到 `lib/flowSerializer.ts` | 100 行图遍历不应在 store 中 |
| P1 | `NodeEditModal.tsx` 拆分为子表单 | 493 行，每次加节点类型都要改 |
| P2 | `styles.css` 拆分为 CSS Modules | 912 行单文件，命名冲突风险 |
| P2 | Tab 组件懒加载 (`React.lazy`) | 13 个 tab 全部 eager import |
| P2 | `server/flowAIAssistant.ts` 拆分 prompt 模板 | 460 行，prompt 和逻辑混合 |
| P3 | 添加单元测试 (`vitest`) | 当前零测试覆盖 |
| P3 | 保存操作事务化 | 多文件写入无原子性保证 |

---

## 命名约定

- **Store**: `use[Domain]Store` (如 `useEditorStore`, `useFlowStore`)
- **Hook**: `use[Action]` (如 `useConnection`, `useUndoRedo`)
- **组件**: PascalCase，文件名与导出名一致
- **lib 函数**: camelCase，纯函数优先
- **节点类型**: camelCase key (如 `eventTrigger`)，对应组件 PascalCase (如 `EventTriggerNode`)
- **ID 格式**: `stage_` + 10 随机字符 / `mod_` + 10 随机字符 / `node_` + timestamp

---

## 构建与运行

```bash
# 开发模式（前后端一体）
npm run dev          # tsx server/index.ts → localhost:4001

# 仅前端开发（需要后端已启动）
npx vite             # localhost:5174，proxy /api → 4001

# 类型检查
npx tsc --noEmit

# 生产构建
npx vite build       # 输出到 dist/
```
