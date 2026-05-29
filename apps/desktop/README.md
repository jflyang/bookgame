# 互动故事游戏 - 桌面版 (Electron)

## 架构

```
apps/desktop/
├── src/
│   ├── main/index.ts      # Electron 主进程（启动后端、管理窗口）
│   └── preload/index.ts   # 预加载脚本（暴露安全 API 给渲染进程）
├── resources/             # 应用图标等资源
├── package.json           # Electron + electron-builder 配置
└── electron-vite.config.ts
```

## 工作原理

1. Electron 主进程启动时：
   - 查找可用端口
   - 将故事包数据复制到用户数据目录（首次运行）
   - 以子进程方式启动 Fastify 后端
   - 后端就绪后打开浏览器窗口加载前端

2. 数据存储：
   - 用户数据目录：`%APPDATA%/interactive-story-game-desktop/game-data/`
   - 故事包：`game-data/task-packages/`
   - 存档：`game-data/saves/`
   - LLM 配置：`game-data/llm-config.json`
   - 日志：`game-data/logs/`

## 构建步骤

### 1. 构建后端和前端

```bash
# 在项目根目录
npm run build
```

### 2. 安装桌面版依赖

```bash
cd apps/desktop
npm install
```

### 3. 开发模式运行

```bash
npm run dev
```

### 4. 打包为安装程序

```bash
# Windows
npm run package

# macOS
npm run package:mac

# Linux
npm run package:linux
```

产出在 `apps/desktop/release/` 目录。

## 前置条件

- 后端需要先 `npm run build` 生成 `apps/api/dist/`
- 前端需要先 `npm run build` 生成 `apps/web/dist/`
- 后端需要配置为能服务静态文件（生产模式下从 `../web/dist` 提供前端）

## API Key 配置

首次启动时，用户需要在应用内的设置页面配置 DeepSeek API Key。
配置保存在用户数据目录的 `config.json` 中。

## 注意事项

- 后端仅监听 127.0.0.1，不对外暴露
- 使用动态端口避免冲突
- 单实例锁防止重复启动
- 窗口位置和大小会记忆
- 关闭窗口时自动停止后端进程
