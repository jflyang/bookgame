# Claude Code + DeepSeek 中转配置方案

## 概述

通过本地 Node.js 代理，将 Claude Code 的 API 请求转发到 DeepSeek，实现用 Claude Code 作为开发 IDE 客户端、DeepSeek 作为实际推理模型的组合。

```
Claude Code CLI (v2.1.156)
    ↓ ANTHROPIC_BASE_URL
localhost:9960/anthropic (proxy.mjs)
    ↓ 转发 + 格式适配
https://api.deepseek.com (deepseek-v4-pro)
```

## 前置条件

- Node.js >= 18（需要支持 `node:http` / `node:https`）
- Claude Code CLI（当前使用 v2.1.156）
- DeepSeek API Key（从 https://platform.deepseek.com 获取）

## 步骤一：创建代理脚本

在任意目录创建代理文件，例如 `C:\Users\Administrator\deepseek-proxy\proxy.mjs`：

```javascript
import http from 'node:http';
import https from 'node:https';

const PORT = 9960;
const TARGET = 'https://api.deepseek.com';

// 格式适配：将 Anthropic 格式的 system role messages 提取到顶层 system 字段
function fixBody(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return raw; }
  if (!parsed.messages) return raw;

  const systemMsgs = parsed.messages.filter(m => m.role === 'system');
  if (systemMsgs.length === 0) return raw;

  // 从 messages 数组中移除 system 消息
  parsed.messages = parsed.messages.filter(m => m.role !== 'system');

  // 提取 system 文本
  const systemText = systemMsgs.map(m => {
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.content)) return m.content.map(c => c.text || '').join('\n');
    return '';
  }).join('\n\n');

  // 合并到顶层 system 字段
  if (parsed.system) {
    if (typeof parsed.system === 'string') {
      parsed.system = parsed.system + '\n\n' + systemText;
    } else if (Array.isArray(parsed.system)) {
      parsed.system.push({ type: 'text', text: systemText });
    }
  } else {
    parsed.system = systemText;
  }

  return JSON.stringify(parsed);
}

const server = http.createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;

  body = fixBody(body);

  const url = new URL(req.url, TARGET);
  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname + url.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: url.hostname,
      'content-length': Buffer.byteLength(body)
    },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (e) => {
    console.error('[proxy error]', e.message);
    res.writeHead(502);
    res.end(JSON.stringify({ error: { message: 'Proxy connection error: ' + e.message } }));
  });

  proxyReq.write(body);
  proxyReq.end();
});

server.listen(PORT, () => {
  console.log('[deepseek-proxy] running on port ' + PORT);
});
```

## 步骤二：配置环境变量

设置以下系统环境变量（或在启动 Claude Code 前设置）：

```powershell
# 将 API 请求指向本地代理
$env:ANTHROPIC_BASE_URL = "http://localhost:9960/anthropic"

# 指定使用的模型名称（代理会原样转发给 DeepSeek）
$env:ANTHROPIC_MODEL = "deepseek-v4-pro"

# DeepSeek API Key（代理通过 headers 透传，Claude Code 会把它作为 Authorization 发出）
$env:ANTHROPIC_API_KEY = "sk-你的deepseek-api-key"
```

如果想持久化，可以写入系统环境变量或用户环境变量（控制面板 → 系统 → 高级系统设置 → 环境变量）。

## 步骤三：启动代理

```powershell
node C:\Users\Administrator\deepseek-proxy\proxy.mjs
```

看到输出 `[deepseek-proxy] running on port 9960` 即代理就绪。

> 建议：可以用 PM2 或 Windows 任务计划程序让代理开机自启。

## 步骤四：启动 Claude Code

在代理运行的情况下，正常启动 Claude Code 即可：

```powershell
claude
```

Claude Code 会读取 `ANTHROPIC_BASE_URL` 和 `ANTHROPIC_MODEL`，将请求发到本地代理，代理转发给 DeepSeek。

## 版本说明

| 组件 | 版本 |
|------|------|
| Claude Code | 2.1.156 |
| Node.js | >= 18 |
| 目标模型 | deepseek-v4-pro |
| 代理端口 | 9960 |

## 代理原理

Claude Code 使用 Anthropic 的 Messages API 格式发送请求。DeepSeek 的 API 兼容 OpenAI/Anthropic 格式，但对 `system` 消息的处理方式略有不同：

- **Anthropic 格式**：system prompt 可能出现在 `messages` 数组中作为 `role: "system"` 的消息
- **DeepSeek 格式**：期望 system prompt 在请求体顶层的 `system` 字段

代理的 `fixBody` 函数负责这个格式转换，确保 DeepSeek 能正确接收 system prompt。

## 故障排查

| 问题 | 解决方案 |
|------|----------|
| Claude Code 报连接错误 | 检查代理是否在运行：`netstat -ano \| findstr 9960` |
| 代理报 502 错误 | 检查网络是否能访问 api.deepseek.com |
| 模型响应异常 | 确认 `ANTHROPIC_MODEL` 设置正确，检查 DeepSeek API Key 余额 |
| 代理进程意外退出 | 用 PM2 管理：`pm2 start proxy.mjs --name deepseek-proxy` |
