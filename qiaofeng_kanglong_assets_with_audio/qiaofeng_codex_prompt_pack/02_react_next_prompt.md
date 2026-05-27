# React / Next.js 专用提示词

请在当前 React 或 Next.js 项目中实现一个可复用的互动读书演出组件，用于乔峰「亢龙有悔」事件。

## 请创建文件

```txt
components/story-effects/KungfuEffectOverlay.tsx
components/story-effects/useStoryEffect.ts
components/story-effects/effectsConfig.ts
components/story-effects/kungfuEffect.css
app/demo/kanglong/page.tsx    // 如果是 Next.js App Router
```

如果项目不是 App Router，请根据实际结构创建 demo 页面。

## 组件 API

```tsx
<KungfuEffectOverlay
  effectId={activeEffectId}
  visible={visible}
  onFinish={() => setVisible(false)}
  onSkip={() => setVisible(false)}
/>
```

Hook API：

```tsx
const { playEffect, stopEffect, activeEffectId, isPlaying } = useStoryEffect();
```

调用：

```tsx
playEffect("qiao_feng_kang_long_you_hui");
```

## 实现要求

1. 使用 CSS keyframes 控制入场、掌风、震屏、闪光、退场。
2. 使用 `useEffect` 控制音频播放和结束清理。
3. 音频播放失败时 catch，不阻塞动画。
4. duration 默认 3800ms，可在配置里调整。
5. 支持跳过按钮。
6. 组件卸载时清理 timer 和 audio。
7. 避免 SSR 报错，涉及 `Audio`、`window` 的逻辑只在客户端执行。
8. Next.js 中如果需要，组件顶部加 `'use client'`。

## 配置示例

```ts
export const storyEffects = {
  qiao_feng_kang_long_you_hui: {
    duration: 3800,
    characterIdle: "/images/characters/qiaofeng-idle.png",
    characterAttack: "/images/characters/qiaofeng-attack.png",
    title: "/images/skills/kanglong-title.png",
    dragon: "/images/skills/kanglong-dragon.png",
    shockwave: "/images/skills/kanglong-shockwave.png",
    burst: "/images/skills/kanglong-burst.png",
    smoke: "/images/fx/smoke.png",
    flash: "/images/fx/screen-flash.png",
    background: "/images/backgrounds/martial-dark-bg.jpg",
    audio: "/sounds/kanglong-full-sequence.mp3"
  }
} as const;
```

## 动画类名建议

```txt
.kungfu-overlay
.kungfu-stage
.kungfu-bg
.kungfu-character
.kungfu-skill-title
.kungfu-dragon-palm
.kungfu-shockwave
.kungfu-burst
.kungfu-smoke
.kungfu-flash
.kungfu-skip
```

## Demo 页面要求

Demo 页面包含一段正文和一个按钮：

```txt
继续阅读：触发乔峰「亢龙有悔」演出
```

并演示读到事件节点后自动播放。

