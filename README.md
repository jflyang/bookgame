# LLM Interactive Story Game

前后端分离的 LLM 互动故事网页游戏骨架。项目从技术报告抽象出的领域模型重新开始，不依赖旧桌面端代码。

## 结构

- `apps/api`: Fastify + TypeScript 后端，负责会话、调度、状态结算、Prompt 编排和 LLM provider 抽象。
- `apps/web`: React + TypeScript + Vite 前端，负责互动故事主界面。
- `packages/shared`: 前后端共享的类型、Zod schema 和常量。

## 运行

```bash
npm install
npm run dev:api
npm run dev:web
```

默认 API 地址为 `http://localhost:4000`，前端为 `http://localhost:5173`。

## 当前范围

- 固定剧本：虚竹除害星宿老怪。
- 固定角色：乔峰、虚竹、段誉、丁春秋。
- 支持创建会话、发送消息、获取状态、更新剧情设定。
- 后端维护结构化状态，LLM 只返回行动建议。
- 当前 LLM provider 为 mock，可在 `apps/api/src/llm` 替换真实模型。
