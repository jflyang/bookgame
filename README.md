# 📖 互动故事游戏 (Interactive Story Game)

基于大语言模型（LLM）的互动叙事 Web 游戏引擎。玩家通过对话驱动剧情发展，AI 角色根据人设、技能和剧情规则自主回应，实现沉浸式的文字冒险体验。

## ✨ 核心特性

- **LLM 驱动叙事** — 接入 DeepSeek 等大模型，AI 角色根据人设 Prompt 自主生成对话与行动
- **多角色群聊** — 支持多个 NPC 角色同时参与对话，各有独立人设、知识库和技能
- **战斗系统** — 内置 HP/MP 状态管理、技能释放、伤害计算、克制关系
- **剧情阶段推进** — 场景自动根据条件推进，支持多阶段故事线
- **故事包系统** — 完整的故事打包/导入/导出机制，一键加载不同故事
- **演出系统 (Performances)** — 支持音效、图片、视频等多媒体演出效果
- **存档/读档** — 多槽位会话存档，随时保存和恢复游戏进度
- **管理后台** — 可视化编辑角色、规则、剧情、UI 主题等所有配置
- **运行时统计** — 记录每轮 LLM 调用延迟、Token 用量、验证结果等

## 🏗️ 技术架构

```
interactive-story-game/
├── apps/
│   ├── api/          # 后端 API (Fastify + TypeScript)
│   ├── web/          # 前端 (React 19 + Vite + Zustand)
│   └── data/         # 故事包数据目录
├── packages/
│   └── shared/       # 共享类型与 Schema (Zod)
└── package.json      # Monorepo 根配置 (npm workspaces)
```

### 后端 (apps/api)

| 技术 | 用途 |
|------|------|
| Fastify 5 | HTTP 框架 |
| TypeScript | 类型安全 |
| better-sqlite3 | 运行时统计持久化 |
| Zod | 请求/响应校验 |
| Pino | 结构化日志 |
| tsx | 开发热重载 |

### 前端 (apps/web)

| 技术 | 用途 |
|------|------|
| React 19 | UI 框架 |
| Vite 6 | 构建工具 |
| Zustand | 状态管理 |
| Lucide React | 图标库 |
| TypeScript | 类型安全 |

## 🚀 快速开始

### 环境要求

- Node.js >= 20
- npm >= 9

### 安装

```bash
git clone https://github.com/jflyang/bookgame.git
cd bookgame
npm install
```

### 配置

复制环境变量文件并填入你的 API Key：

```bash
cp apps/api/.env.example apps/api/.env
```

编辑 `apps/api/.env`：

```env
PORT=4000
WEB_ORIGIN=http://localhost:5173
LLM_PROVIDER=deepseek          # 可选: mock (测试用) | deepseek
DEEPSEEK_API_KEY=your-api-key  # 使用 deepseek 时必填
```

### 启动开发服务器

```bash
# 同时启动前后端
npm run dev

# 或分别启动
npm run dev:api   # 后端 http://localhost:4000
npm run dev:web   # 前端 http://localhost:5173
```

### 构建生产版本

```bash
npm run build
```

## 📦 故事包系统

游戏内容通过「故事包」(Story Package) 组织，每个故事包包含：

```
apps/data/task-packages/<story-id>/
├── task-package.json      # 主配置（标题、描述、调试选项）
├── manifest.json          # 插件清单（多媒体能力声明）
├── story.json             # 故事设定 Prompt
├── characters.json        # 角色定义
├── scenario.json          # 剧情场景与阶段
├── skills.json            # 技能定义
├── knowledge/             # 知识库文档
├── prompts/               # 提示词规则
├── ui/                    # UI 主题配置
├── media/                 # 缩略图等媒体资源
├── assets/performances/   # 演出资源（音效、图片）
└── saves/                 # 会话存档
```

### 默认故事包

项目自带一个示例故事包 **「虚竹除害星宿老怪」**，取材自《天龙八部》：

- 多阶段剧情（起因 → 相遇 → 冲突升级 → 交手 → 结局）
- 4 个角色：虚竹、乔峰、段誉、丁春秋
- 完整技能系统（天山折梅手、降龙十八掌、六脉神剑、化功大法等）
- 战斗机制（HP/MP、伤害范围、克制关系）

### 创建自定义故事包

通过管理后台可视化创建，或通过 API 导入 `.story-package.json` 文件。

## 🎮 游戏玩法

1. 打开前端页面，选择故事包
2. 创建新会话或加载存档
3. 在输入框中输入你的行动或对话
4. AI 角色会根据剧情和人设自主回应
5. 观察角色状态变化（HP/MP）和剧情阶段推进
6. 随时存档保存进度

## 🔧 管理后台

访问前端的管理页面可以：

- **故事管理** — 创建、编辑、导入/导出故事包
- **角色配置** — 编辑角色人设、头像、知识库绑定
- **规则编辑** — 配置提示词规则（知识强制、群聊边界、战斗规则等）
- **UI 主题** — 自定义颜色、字体、布局
- **LLM 配置** — 切换模型提供商、调整温度和 Token 限制
- **运行时面板** — 查看每轮调用详情、延迟统计、Token 用量
- **审计日志** — 追踪所有管理操作记录
- **会话管理** — 查看和管理所有游戏会话

## 🧪 测试

```bash
# 运行所有测试
npm run test -w @story-game/api
npm run test -w @story-game/web

# 类型检查
npm run typecheck
```

## 📁 项目结构详解

```
apps/api/src/
├── application/       # 应用层服务（编排业务流程）
├── data/              # 数据层（角色、场景、故事包仓库）
├── modules/
│   ├── container.ts   # 依赖注入容器
│   ├── database/      # SQLite 数据库管理
│   ├── runtime-stats/ # 运行时统计收集
│   └── sessions/      # 会话管理
├── resources/llm/     # LLM 提供商抽象层
├── routes/            # HTTP 路由定义
├── services/          # 核心业务服务
│   ├── dialogueEngine.ts       # 对话引擎
│   ├── turnProcessor.ts        # 回合处理器
│   ├── speakerSelector.ts      # 发言者选择
│   ├── promptService.ts        # Prompt 构建
│   ├── gameStateService.ts     # 游戏状态管理
│   ├── memoryService.ts        # 对话记忆
│   ├── ruleChecker.ts          # 规则校验
│   ├── skillParser.ts          # 技能解析
│   ├── storyPackageService.ts  # 故事包管理
│   ├── storyPackageActivator.ts # 故事包激活
│   ├── sessionSaveService.ts   # 存档服务
│   └── mediaService.ts         # 媒体资源服务
└── utils/             # 工具函数
```

## 🔌 API 端点

### 游戏 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/game/sessions` | 创建新会话 |
| POST | `/api/game/sessions/:id/messages` | 发送消息 |
| POST | `/api/game/sessions/:id/continue` | 继续（AI 自动推进） |
| GET | `/api/game/sessions/:id/state` | 获取游戏状态 |
| GET | `/api/game/sessions/:id/messages` | 获取消息历史 |

### 管理 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/stories` | 获取所有故事包 |
| POST | `/api/admin/stories` | 创建故事包 |
| PUT | `/api/admin/stories/:id` | 更新故事包 |
| GET | `/api/admin/llm-config` | 获取 LLM 配置 |
| PUT | `/api/admin/llm-config` | 更新 LLM 配置 |
| POST | `/api/admin/import` | 导入故事包 |
| GET | `/api/admin/export/:id` | 导出故事包 |

## 📄 License

MIT

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。
