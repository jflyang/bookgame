# 📖 互动故事游戏

基于大语言模型的互动叙事游戏引擎。玩家通过对话驱动剧情，AI 角色根据人设与技能自主回应，实现沉浸式文字冒险体验。

## 默认故事：虚竹除害星宿老怪

取材自金庸《天龙八部》。少林小僧虚竹身负逍遥派奇缘，得知丁春秋欺师灭祖、以毒功残害江湖，决意下山清理门户。乔峰与段誉同行，三人在星宿海山道与丁春秋正面交锋。

| 角色 | 定位 | 代表技能 |
|------|------|---------|
| 虚竹 | 主角·逍遥派传人 | 天山折梅手、天山六阳掌、北冥神功 |
| 乔峰 | 盟友·压阵 | 降龙十八掌、擒龙功 |
| 段誉 | 盟友·观察 | 六脉神剑、凌波微步 |
| 丁春秋 | 反派·星宿老怪 | 化功大法、星宿毒雾 |

18 个阶段，含 3 条分支路线（仁道 / 智道 / 勇道），玩家选择决定结局走向。

## 核心特性

- **LLM 驱动叙事** — DeepSeek 大模型实时生成角色对话与行动，流式输出
- **战斗系统** — HP/MP 状态、技能伤害计算、回合制对抗
- **剧情阶段推进** — 自动检测推进条件，支持分支选择
- **故事包系统** — 模块化内容，支持导入/导出/自定义创作
- **演出系统** — 技能释放时触发音效、图片等多媒体效果
- **存档系统** — 多槽位存档 + 自动存档，随时保存恢复
- **Session 持久化** — SQLite 存储，服务重启不丢失进度
- **管理后台** — 可视化编辑角色、规则、剧情、LLM 配置

## 快速开始

### 环境要求

- Node.js >= 20
- DeepSeek API Key（[申请地址](https://platform.deepseek.com)）

### 安装与启动

```bash
git clone https://github.com/jflyang/bookgame.git
cd bookgame
npm install

# 配置 API Key
cp apps/api/.env.example apps/api/.env
# 编辑 .env 填入 DEEPSEEK_API_KEY

# 启动
npm run dev
```

打开 http://localhost:5173 即可开始游戏。

### 桌面版（绿色免安装）

从 [Releases](https://github.com/jflyang/bookgame/releases) 下载压缩包，解压后直接运行 `StoryGame.exe`，无需安装。

## 技术架构

```
├── apps/api          Fastify 后端 (TypeScript, SQLite, Zod)
├── apps/web          React 前端 (Vite, Zustand)
├── apps/desktop      Electron 桌面壳
├── apps/data         故事包数据
├── packages/shared   共享类型与 Schema
└── services/tts      CosyVoice TTS 服务（可选）
```

## 开发命令

```bash
npm run dev           # 前后端同时启动
npm run dev:api       # 仅后端 (localhost:4000)
npm run dev:web       # 仅前端 (localhost:5173)
npm run build         # 生产构建
npm run typecheck     # 全量类型检查
```

## 打包桌面版

```bash
npm run build
cd apps/desktop
npm run package       # 生成安装包
```

详见 [apps/desktop/PACKAGING.md](apps/desktop/PACKAGING.md)

## License

MIT
