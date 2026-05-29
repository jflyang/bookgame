# TTS 语音服务技术方案

## 1. 总体架构

语音合成作为独立的 AI 服务层，与现有 LLM 文本生成服务平行部署，通过内部 API 对接游戏后端。

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React/Vite)                    │
│  PlayApp → MessageList → AudioPlayer (新增)                   │
└────────────────────────────┬────────────────────────────────┘
                             │ SSE stream + audio URL
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   Game API (Fastify :4000)                    │
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │ LLM Provider │   │ TTS Provider │   │ Story Assets   │  │
│  │ (DeepSeek)   │   │ (新增)        │   │ (existing)     │  │
│  └──────┬───────┘   └──────┬───────┘   └────────────────┘  │
│         │                   │                                │
└─────────┼───────────────────┼────────────────────────────────┘
          │                   │
          ▼                   ▼
┌──────────────────┐  ┌──────────────────────────────────────┐
│  DeepSeek API    │  │   CosyVoice Service (独立进程 :50001) │
│  (外部)          │  │   Python + FastAPI + GPU              │
└──────────────────┘  └──────────────────────────────────────┘
```

## 2. CosyVoice 独立服务层

### 2.1 服务定位

| 属性 | 说明 |
|------|------|
| 运行方式 | 独立 Python 进程，Docker 容器化 |
| 端口 | `:50001` (HTTP/REST) |
| 模型 | Fun-CosyVoice3-0.5B-2512 |
| 职责 | 接收文本 + 角色音色参数，返回音频流/文件 |
| 部署 | 与 Game API 同机或内网，GPU 机器 |

### 2.2 服务接口设计

```
POST /v1/tts/synthesize
POST /v1/tts/stream
GET  /v1/tts/voices
GET  /v1/tts/health
```

#### POST /v1/tts/synthesize — 完整合成

```json
// Request
{
  "text": "乔峰一掌拍出，掌风呼啸。",
  "voice_id": "qiaofeng",
  "voice_config": {
    "mode": "zero_shot",
    "reference_audio": "voices/qiaofeng_ref.wav",
    "instruct": "用低沉有力的男声，语速中等，带有豪迈气概"
  },
  "output_format": "mp3",
  "sample_rate": 22050
}

// Response
{
  "audio_url": "/v1/tts/audio/abc123.mp3",
  "duration_ms": 2340,
  "sample_rate": 22050,
  "cached": false
}
```

#### POST /v1/tts/stream — 流式合成

```json
// Request (同 synthesize)
{
  "text": "虚竹双手合十，口宣佛号。",
  "voice_id": "xuzhu",
  "voice_config": {
    "mode": "zero_shot",
    "reference_audio": "voices/xuzhu_ref.wav",
    "instruct": "温和谦逊的年轻僧人声音"
  },
  "stream": true
}

// Response: chunked audio/mpeg stream
// Header: Transfer-Encoding: chunked
// Header: X-Audio-Duration-Ms: 1850
```

#### GET /v1/tts/voices — 已注册音色列表

```json
// Response
{
  "voices": [
    {
      "id": "qiaofeng",
      "name": "乔峰",
      "reference_audio": "voices/qiaofeng_ref.wav",
      "default_instruct": "低沉有力的男声，豪迈气概",
      "language": "zh"
    },
    {
      "id": "xuzhu",
      "name": "虚竹",
      "reference_audio": "voices/xuzhu_ref.wav",
      "default_instruct": "温和谦逊的年轻僧人",
      "language": "zh"
    }
  ]
}
```

### 2.3 CosyVoice 服务实现

```python
# tts_server/main.py
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from cosyvoice.cli.cosyvoice import CosyVoice2
import torch, os, uuid, hashlib

app = FastAPI(title="CosyVoice TTS Service", version="1.0.0")

# 模型加载（启动时一次性加载）
MODEL_DIR = os.environ.get("COSYVOICE_MODEL_DIR", "pretrained_models/Fun-CosyVoice3-0.5B")
cosyvoice = CosyVoice2(MODEL_DIR, load_jit=False, load_trt=False)

# 音色参考音频目录
VOICES_DIR = os.environ.get("VOICES_DIR", "./voices")
AUDIO_CACHE_DIR = os.environ.get("AUDIO_CACHE_DIR", "./audio_cache")

class VoiceConfig(BaseModel):
    mode: str = "zero_shot"  # zero_shot | instruct | sft
    reference_audio: str | None = None
    instruct: str | None = None

class SynthesizeRequest(BaseModel):
    text: str
    voice_id: str
    voice_config: VoiceConfig | None = None
    output_format: str = "mp3"
    sample_rate: int = 22050
    stream: bool = False

@app.post("/v1/tts/synthesize")
async def synthesize(req: SynthesizeRequest):
    voice_path = os.path.join(VOICES_DIR, f"{req.voice_id}_ref.wav")
    if not os.path.exists(voice_path):
        raise HTTPException(404, f"Voice reference not found: {req.voice_id}")

    # 缓存 key: text + voice_id + instruct 的 hash
    cache_key = hashlib.md5(
        f"{req.text}|{req.voice_id}|{req.voice_config.instruct if req.voice_config else ''}".encode()
    ).hexdigest()
    cache_path = os.path.join(AUDIO_CACHE_DIR, f"{cache_key}.{req.output_format}")

    if os.path.exists(cache_path):
        return {"audio_url": f"/v1/tts/audio/{cache_key}.{req.output_format}", "cached": True}

    # 合成
    instruct = req.voice_config.instruct if req.voice_config else ""
    output = cosyvoice.inference_zero_shot(
        tts_text=req.text,
        prompt_text="",  # 可从 voice registry 读取
        prompt_speech_16k=voice_path,
        instruct_text=instruct,
        stream=False
    )

    # 保存音频
    save_audio(output, cache_path, req.sample_rate, req.output_format)

    return {
        "audio_url": f"/v1/tts/audio/{cache_key}.{req.output_format}",
        "duration_ms": get_duration_ms(cache_path),
        "sample_rate": req.sample_rate,
        "cached": False
    }

@app.post("/v1/tts/stream")
async def stream_synthesize(req: SynthesizeRequest):
    voice_path = os.path.join(VOICES_DIR, f"{req.voice_id}_ref.wav")
    if not os.path.exists(voice_path):
        raise HTTPException(404, f"Voice reference not found: {req.voice_id}")

    instruct = req.voice_config.instruct if req.voice_config else ""

    async def audio_generator():
        for chunk in cosyvoice.inference_zero_shot(
            tts_text=req.text,
            prompt_text="",
            prompt_speech_16k=voice_path,
            instruct_text=instruct,
            stream=True
        ):
            yield encode_audio_chunk(chunk, req.output_format)

    return StreamingResponse(
        audio_generator(),
        media_type=f"audio/{req.output_format}",
        headers={"Transfer-Encoding": "chunked"}
    )

@app.get("/v1/tts/audio/{filename}")
async def get_audio(filename: str):
    path = os.path.join(AUDIO_CACHE_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404)
    return FileResponse(path)

@app.get("/v1/tts/voices")
async def list_voices():
    # 从 voices 目录扫描已注册音色
    ...

@app.get("/v1/tts/health")
async def health():
    return {"status": "ok", "model": MODEL_DIR, "gpu": torch.cuda.is_available()}
```

### 2.4 Docker 部署

```dockerfile
# tts_server/Dockerfile
FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# 下载模型（或挂载 volume）
# RUN python -c "from modelscope import snapshot_download; ..."

EXPOSE 50001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "50001", "--workers", "1"]
```

```yaml
# docker-compose.tts.yml
services:
  cosyvoice:
    build: ./tts_server
    ports:
      - "50001:50001"
    volumes:
      - ./tts_server/voices:/app/voices          # 角色参考音频
      - ./tts_server/audio_cache:/app/audio_cache # 合成缓存
      - ./pretrained_models:/app/pretrained_models # 模型文件
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    environment:
      - COSYVOICE_MODEL_DIR=/app/pretrained_models/Fun-CosyVoice3-0.5B
      - VOICES_DIR=/app/voices
      - AUDIO_CACHE_DIR=/app/audio_cache
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:50001/v1/tts/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## 3. Game API 集成层

### 3.1 新增文件结构

```
apps/api/src/resources/tts/
├── ttsProvider.ts          # TTS 接口抽象
├── cosyVoiceTtsProvider.ts # CosyVoice 实现
├── mockTtsProvider.ts      # 开发/测试用 mock
├── ttsConfigService.ts     # TTS 配置管理
└── voiceRegistry.ts        # 角色-音色映射
```

### 3.2 接口定义

```typescript
// apps/api/src/resources/tts/ttsProvider.ts

export interface TtsRequest {
  text: string;
  voiceId: string;          // 角色 ID，映射到音色
  instruct?: string;        // 情感/语速指令
  stream?: boolean;
  format?: "mp3" | "ogg" | "wav";
}

export interface TtsSynthesisResult {
  audioUrl: string;         // 可访问的音频 URL
  durationMs: number;
  cached: boolean;
}

export interface TtsProvider {
  synthesize(input: TtsRequest): Promise<TtsSynthesisResult>;
  streamSynthesize(input: TtsRequest): AsyncIterable<Buffer>;
  listVoices(): Promise<VoiceInfo[]>;
  isAvailable(): Promise<boolean>;
}

export interface VoiceInfo {
  id: string;
  name: string;
  language: string;
  defaultInstruct?: string;
}
```

### 3.3 CosyVoice Provider 实现

```typescript
// apps/api/src/resources/tts/cosyVoiceTtsProvider.ts

import type { TtsProvider, TtsRequest, TtsSynthesisResult, VoiceInfo } from "./ttsProvider.js";
import type { TtsConfigService } from "./ttsConfigService.js";

export class CosyVoiceTtsProvider implements TtsProvider {
  constructor(private readonly configService: TtsConfigService) {}

  async synthesize(input: TtsRequest): Promise<TtsSynthesisResult> {
    const config = this.configService.getConfig();
    const response = await fetch(`${config.serviceUrl}/v1/tts/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: input.text,
        voice_id: input.voiceId,
        voice_config: {
          mode: "zero_shot",
          instruct: input.instruct || config.defaultInstruct
        },
        output_format: input.format || "mp3"
      })
    });

    if (!response.ok) {
      throw new Error(`TTS synthesis failed: ${response.status}`);
    }

    const data = await response.json();
    // 将内部 URL 转为前端可访问的代理 URL
    return {
      audioUrl: `/api/tts/audio/${data.audio_url.split("/").pop()}`,
      durationMs: data.duration_ms,
      cached: data.cached
    };
  }

  async *streamSynthesize(input: TtsRequest): AsyncIterable<Buffer> {
    const config = this.configService.getConfig();
    const response = await fetch(`${config.serviceUrl}/v1/tts/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: input.text,
        voice_id: input.voiceId,
        voice_config: { mode: "zero_shot", instruct: input.instruct },
        output_format: input.format || "mp3",
        stream: true
      })
    });

    if (!response.ok) throw new Error(`TTS stream failed: ${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield Buffer.from(value);
      }
    } finally {
      reader.releaseLock();
    }
  }

  async listVoices(): Promise<VoiceInfo[]> {
    const config = this.configService.getConfig();
    const response = await fetch(`${config.serviceUrl}/v1/tts/voices`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.voices;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const config = this.configService.getConfig();
      const response = await fetch(`${config.serviceUrl}/v1/tts/health`, {
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### 3.4 配置管理

```typescript
// apps/api/src/resources/tts/ttsConfigService.ts

export interface TtsConfig {
  enabled: boolean;
  provider: "cosyvoice" | "mock" | "disabled";
  serviceUrl: string;       // CosyVoice 服务地址
  defaultInstruct: string;  // 默认情感指令
  autoSynthesize: boolean;  // 是否自动为每条消息合成语音
  cacheEnabled: boolean;
}

const defaultConfig: TtsConfig = {
  enabled: false,
  provider: "disabled",
  serviceUrl: "http://localhost:50001",
  defaultInstruct: "",
  autoSynthesize: false,
  cacheEnabled: true
};
```

### 3.5 角色音色注册表

```typescript
// apps/api/src/resources/tts/voiceRegistry.ts

export interface VoiceProfile {
  characterId: string;
  voiceId: string;
  instruct: string;         // 角色专属语音指令
  referenceAudio: string;   // 参考音频文件名
}

// 从 story package 的 characters.json 扩展，或独立配置
// 支持每个故事包定义自己的角色音色
export class VoiceRegistry {
  private profiles = new Map<string, VoiceProfile>();

  register(profile: VoiceProfile) { ... }
  getProfile(characterId: string): VoiceProfile | undefined { ... }
  getInstruct(characterId: string, emotion?: string): string { ... }
}
```

### 3.6 容器注入

```typescript
// 在 container.ts 中新增
import { TtsConfigService } from "../resources/tts/ttsConfigService.js";
import { CosyVoiceTtsProvider } from "../resources/tts/cosyVoiceTtsProvider.js";
import { MockTtsProvider } from "../resources/tts/mockTtsProvider.js";
import { ConfigurableTtsProvider } from "../resources/tts/configurableTtsProvider.js";
import { VoiceRegistry } from "../resources/tts/voiceRegistry.js";

export const ttsConfigService = new TtsConfigService();
export const voiceRegistry = new VoiceRegistry();
const ttsProvider = new ConfigurableTtsProvider(ttsConfigService, {
  cosyvoice: new CosyVoiceTtsProvider(ttsConfigService),
  mock: new MockTtsProvider()
});
export { ttsProvider };
```

## 4. API 路由层

### 4.1 新增 TTS 路由

```typescript
// apps/api/src/routes/tts.routes.ts

export async function ttsRoutes(app: FastifyInstance) {
  // 按需合成：前端请求某条消息的语音
  app.post("/tts/synthesize", async (request, reply) => {
    const { text, characterId, emotion } = request.body as {
      text: string; characterId: string; emotion?: string;
    };
    const profile = voiceRegistry.getProfile(characterId);
    const result = await ttsProvider.synthesize({
      text,
      voiceId: profile?.voiceId || characterId,
      instruct: voiceRegistry.getInstruct(characterId, emotion)
    });
    return reply.send(result);
  });

  // 流式合成
  app.post("/tts/stream", async (request, reply) => {
    const { text, characterId } = request.body as { text: string; characterId: string };
    const profile = voiceRegistry.getProfile(characterId);

    const raw = reply.raw;
    raw.writeHead(200, {
      "Content-Type": "audio/mpeg",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache"
    });

    for await (const chunk of ttsProvider.streamSynthesize({
      text,
      voiceId: profile?.voiceId || characterId,
      instruct: profile?.instruct
    })) {
      raw.write(chunk);
    }
    raw.end();
    return reply.hijack();
  });

  // 代理 CosyVoice 缓存音频
  app.get("/tts/audio/:filename", async (request, reply) => {
    const { filename } = request.params as { filename: string };
    // 代理到 CosyVoice 服务的音频缓存
    const config = ttsConfigService.getConfig();
    const upstream = await fetch(`${config.serviceUrl}/v1/tts/audio/${filename}`);
    if (!upstream.ok) return reply.code(404).send();
    raw.writeHead(200, { "Content-Type": "audio/mpeg" });
    // pipe upstream body to response
    ...
  });

  // TTS 配置管理（Admin）
  app.get("/tts/config", async (_, reply) => reply.send(ttsConfigService.getConfig()));
  app.put("/tts/config", async (request, reply) => {
    const updated = ttsConfigService.update(request.body as Partial<TtsConfig>);
    return reply.send(updated);
  });

  // 音色列表
  app.get("/tts/voices", async (_, reply) => {
    const voices = await ttsProvider.listVoices();
    return reply.send({ voices });
  });
}
```

## 5. 游戏流程集成

### 5.1 方案 A：按需合成（推荐初期）

前端收到文本消息后，用户点击"播放"按钮触发合成。

```
用户点击播放 → POST /api/tts/synthesize → CosyVoice 合成 → 返回 audio URL → 前端播放
```

优点：不浪费 GPU 资源，用户可选择性听语音。

### 5.2 方案 B：自动合成（后期优化）

TurnProcessor 输出文本后，异步触发 TTS，通过 SSE 推送音频 URL。

```typescript
// 在 TurnProcessor 或 GameApplicationService 中
async *sendMessageStream(sessionId, input) {
  for await (const event of dialogueEngine.processStream(...)) {
    yield event;

    // 当收到完整消息时，异步触发 TTS
    if (event.type === "message" && ttsConfig.autoSynthesize) {
      const ttsResult = await ttsProvider.synthesize({
        text: event.data.narration + event.data.dialogue,
        voiceId: event.data.speakerId
      });
      yield { type: "audio", audioUrl: ttsResult.audioUrl, durationMs: ttsResult.durationMs };
    }
  }
}
```

SSE 事件新增 `audio` 类型：

```json
data: {"type": "audio", "audioUrl": "/api/tts/audio/abc123.mp3", "durationMs": 2340, "speakerId": "qiaofeng"}
```

### 5.3 方案 C：流式文本 + 流式语音（终极体验）

文本流式输出的同时，语音也流式合成播放。需要 CosyVoice 的双向流式能力。

```
LLM streaming text → 累积句子 → CosyVoice streaming audio → 前端 Web Audio API 播放
```

这是最复杂但体验最好的方案，建议作为 v2 目标。

## 6. 前端集成

### 6.1 新增组件

```typescript
// apps/web/src/features/play/components/MessageAudioPlayer.tsx

interface Props {
  messageId: string;
  text: string;
  speakerId: string;
}

function MessageAudioPlayer({ messageId, text, speakerId }: Props) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePlay = async () => {
    setLoading(true);
    const result = await ttsApi.synthesize(text, speakerId);
    setAudioUrl(result.audioUrl);
    setLoading(false);
  };

  return (
    <button onClick={handlePlay} disabled={loading}>
      {loading ? "合成中..." : "🔊"}
    </button>
    {audioUrl && <audio src={audioUrl} autoPlay controls />}
  );
}
```

### 6.2 全局语音控制

```typescript
// apps/web/src/store/audioStore.ts (新增)
interface AudioState {
  ttsEnabled: boolean;       // 全局开关
  autoPlay: boolean;         // 自动播放
  volume: number;
  currentPlaying: string | null;
}
```

## 7. Story Package 扩展

在 `characters.json` 中为每个角色添加可选的 voice 配置：

```json
{
  "id": "qiaofeng",
  "name": "乔峰",
  "voice": {
    "referenceAudio": "voices/qiaofeng_ref.wav",
    "instruct": "低沉有力的男声，语速中等，带有豪迈气概",
    "emotions": {
      "angry": "愤怒咆哮的声音，语速加快",
      "sad": "低沉悲伤的声音，语速放慢",
      "calm": "平静沉稳的声音"
    }
  }
}
```

## 8. 分阶段实施计划

| 阶段 | 内容 | 预计工期 |
|------|------|---------|
| P0 | CosyVoice 独立服务搭建 + Docker 化 + 健康检查 | 2-3 天 |
| P1 | Game API TTS Provider 抽象 + 路由 + 配置管理 | 2 天 |
| P2 | 角色参考音频录制/选取 + VoiceRegistry | 1-2 天 |
| P3 | 前端按需播放按钮 + AudioPlayer 组件 | 1-2 天 |
| P4 | Admin 面板 TTS 配置 UI + 音色试听 | 1 天 |
| P5 | 自动合成 + SSE audio 事件推送 | 2 天 |
| P6 | 流式语音合成 + Web Audio API 实时播放 | 3-5 天 |

## 9. 性能与资源考量

| 指标 | 预期值 |
|------|--------|
| 首包延迟 (流式) | ~150ms |
| 完整合成延迟 (20字) | ~500-800ms |
| GPU 显存占用 | ~2-3 GB (0.5B 模型) |
| 并发能力 | 单 GPU 约 4 路并发 |
| 缓存命中率 | 相同文本+角色 100% 命中 |

### 优化策略

1. **音频缓存**：相同文本+角色+情感的合成结果缓存到磁盘，避免重复合成
2. **句子分割**：长文本按句号分割，逐句合成+流式播放
3. **预合成**：对 system 消息、固定旁白可预先合成
4. **vLLM 加速**：CosyVoice 3.0 支持 vLLM，可显著提升吞吐
5. **降级策略**：GPU 不可用时自动降级为纯文本模式

## 10. 配置文件示例

```json
// apps/api/data/tts-config.json
{
  "enabled": true,
  "provider": "cosyvoice",
  "serviceUrl": "http://localhost:50001",
  "defaultInstruct": "",
  "autoSynthesize": false,
  "cacheEnabled": true,
  "maxTextLength": 500,
  "defaultFormat": "mp3",
  "sampleRate": 22050
}
```

## 11. 环境变量

```env
# .env 新增
TTS_ENABLED=true
TTS_PROVIDER=cosyvoice
TTS_SERVICE_URL=http://localhost:50001
TTS_AUTO_SYNTHESIZE=false
```

## 12. 与现有系统的关系

- **不侵入现有 LLM 流程**：TTS 是独立的后处理步骤，LLM 文本生成完全不受影响
- **复用 Performance 系统**：语音可以作为一种新的 performance renderer 类型集成
- **复用 Story Assets 路由**：合成的音频可以通过现有的 `/api/story-assets/` 路径提供
- **Admin 面板扩展**：在现有 LlmConfigPanel 旁边新增 TtsConfigPanel
