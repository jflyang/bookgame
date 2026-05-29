# 桌面版打包说明

## 基础版（默认打包）

基础版只包含「虚竹除害星宿老怪」故事，不包含音频演出资源。

```bash
cd apps/desktop
npm run package        # Windows
npm run package:mac    # macOS
```

输出：`release/StoryGame Setup x.x.x.exe`

### 基础版包含内容

- Electron 运行时
- API 后端（编译后）
- Web 前端（编译后）
- 虚竹故事包（不含 performances 音频）

### 基础版不包含

- 其他故事包（小薇日记、冷霜风云等）— 本地开发专用
- TTS 语音合成服务（CosyVoice Python 服务）
- 演出音频/图片资源（assets/performances/）
- 存档数据

## 打包前准备

```bash
# 在项目根目录
npm run build          # 构建 shared → api → web
cd apps/desktop
npm run package        # 打包
```

## 注意事项

- 每次打包都基于基础版（只有虚竹，无音频）
- 其他故事包和音频资源通过 gitignore 排除，不进入 git 仓库
- 用户可在安装后通过管理面板导入额外故事包
- TTS 功能需要用户自行配置（ElevenLabs API Key 或本地 CosyVoice）
