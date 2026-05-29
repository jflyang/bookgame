# 📖 互动故事游戏

基于大语言模型的互动叙事游戏引擎。玩家通过对话驱动剧情，AI 角色根据人设与技能自主回应，配合语音合成与演出系统，实现沉浸式文字冒险体验。

![Tech](https://img.shields.io/badge/React_19-blue) ![Tech](https://img.shields.io/badge/Fastify_5-green) ![Tech](https://img.shields.io/badge/DeepSeek-purple) ![Tech](https://img.shields.io/badge/CosyVoice_TTS-orange) ![Tech](https://img.shields.io/badge/Electron-gray)

## 默认故事：虚竹除害星宿老怪

取材自金庸《天龙八部》。少林小僧虚竹身负逍遥派奇缘，得知丁春秋欺师灭祖、以毒功残害江湖，决意下山清理门户。乔峰与段誉同行，三人在星宿海山道与丁春秋正面交锋。

**角色**

| 角色 | 定位 | 代表技能 |
|------|------|---------|
| 虚竹 | 主角·逍遥派传人 | 天山折梅手、天山六阳掌、北冥神功 |
| 乔峰 | 盟友·压阵 | 降龙十八掌、擒龙功 |
| 段誉 | 盟友·观察 | 六脉神剑、凌波微步 |
| 丁春秋 | 反派·星宿老怪 | 化功大法、星宿毒雾 |

**剧情结构**

18 个阶段，含 3 条分支路线（仁道 / 智道 / 勇道），从师门血债到最终对决，玩家选择决定结局走向。

## 核心特性

- **LLM 驱动叙事** — DeepSeek 大模型实时生成角色对话与行动，流式输出
- **语音合成** — CosyVoice TTS 为每个角色生成独立语音，GPU 加速推理
- **战斗系统** — HP/MP 状态、技能伤害计算、克制关系、回合制对抗
- **演出系统** — 技能释放时触发音效、图片、视频等多媒体效果
- **故事包** — 模块化内容打包，支持导入/导出/自定义创作
- **多端运行** — Web 浏览器 + Electron 桌面应用
- **存档系统** — 多槽位存档，随时保存和恢复进度
- **管理后台** — 可视化编辑角色、规则、剧情、LLM/TTS 配置

## 快速开始

### 环境要求

- Node.js >= 20
- DeepSeek API Key（[申请地址](https://platform.deepseek.com)）
- Python 3.10+（可选，用于 CosyVoice TTS）

### 安装与启动

```bash
git clone https://github.com/jflyang/bookgame.git
cd bookgame
npm install

# 配置 API Key
cp apps/api/.env.example apps/api/.env
# 编辑 .env 填入 DEEPSEEK_API_KEY

# 启动（前后端同时）
npm run dev
```

打开 http://localhost:5173 即可开始游戏。

### 桌面版

```bash
cd apps/desktop
npm run package        # Windows
npm run package:mac    # macOS
```

## 技术架构

```
├── apps/api          Fastify 后端 (TypeScript, SQLite, Zod)
├── apps/web          React 前端 (Vite, Zustand)
├── apps/desktop      Electron 桌面壳
├── apps/data         故事包数据
├── packages/shared   共享类型与 Schema
└── services/tts      CosyVoice Python 服务
```

### LLM 集成

- 支持 DeepSeek（deepseek-chat / deepseek-v4-flash / deepseek-v4-pro）
- Prompt 分层：system（稳定前缀，利用 prefix caching）+ user（动态状态）
- 流式 SSE 输出，实时显示角色回复
- 自动 JSON 解析与容错（reasoning_content 回退提取）

### TTS 集成

- CosyVoice：本地 GPU 推理，角色音色克隆
- ElevenLabs：云端备选方案
- API 启动时自动拉起 TTS 服务（可配置）
- 音频缓存，避免重复合成

## 开发命令

```bash
npm run dev           # 前后端同时启动
npm run dev:api       # 仅后端 (localhost:4000)
npm run dev:web       # 仅前端 (localhost:5173)
npm run build         # 生产构建
npm run typecheck     # 全量类型检查
npm run test -w @story-game/api   # 后端测试
npm run test -w @story-game/web   # 前端测试
```

## License

MIT
