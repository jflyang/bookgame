# Codex 主提示词：实现乔峰「亢龙有悔」互动阅读演出

你是资深前端工程师和互动叙事系统开发者。请在当前 Web 项目中实现一个“互动读书演出层”：当故事正文触发事件 `qiao_feng_kang_long_you_hui` 时，页面弹出乔峰角色，播放“亢龙有悔”出招动画和音效，动画结束后自动关闭，回到正文阅读。

## 目标体验

读者阅读到某个剧情节点时：

1. 正文阅读区域暂时进入演出状态。
2. 全屏出现半透明暗色武侠背景遮罩。
3. 乔峰角色图从左侧或下方冲入。
4. 屏幕出现“亢龙有悔”招式字。
5. 播放掌风、龙吟、冲击波和爆裂音效。
6. 金色龙形掌风从乔峰方向向右轰出。
7. 出现冲击波、闪光、烟尘和轻微屏幕震动。
8. 3.5 到 4.2 秒后演出层自动淡出并移除。
9. 用户可以继续阅读正文。

## 素材路径

请按以下默认路径读取素材，如果项目里没有完全相同的文件名，请把路径集中写入一个配置对象，方便我修改：

```js
const KANGLONG_ASSETS = {
  qiaofengIdle: "/images/characters/qiaofeng-idle.png",
  qiaofengAttack: "/images/characters/qiaofeng-attack.png",
  skillTitle: "/images/skills/kanglong-title.png",
  dragonPalm: "/images/skills/kanglong-dragon.png",
  shockwave: "/images/skills/kanglong-shockwave.png",
  burst: "/images/skills/kanglong-burst.png",
  lightStreak: "/images/skills/kanglong-light-streak.png",
  smoke: "/images/fx/smoke.png",
  screenFlash: "/images/fx/screen-flash.png",
  bg: "/images/backgrounds/martial-dark-bg.jpg",
  fullAudio: "/sounds/kanglong-full-sequence.mp3",
  roar: "/sounds/kanglong-roar.mp3",
  palmHit: "/sounds/palm-hit.mp3",
  windRush: "/sounds/wind-rush.mp3",
  screenImpact: "/sounds/screen-impact.mp3"
};
```

## 技术要求

请根据当前项目技术栈实现，不要引入过重依赖。优先顺序：

1. 如果项目已有 React / Next.js，请做成组件 `KungfuEffectOverlay` 和 hook `useStoryEventEffect`。
2. 如果是 Vue，请做成组件和 composable。
3. 如果是原生 Web，请做成独立 JS 模块 `kungfuEffect.js` 和 CSS 文件。
4. 动画优先用 CSS keyframes；如果项目已有 GSAP，可以使用 GSAP 时间线，但不要强制安装。
5. 音频使用 HTMLAudioElement 或 Howler.js；如果没有 Howler.js，不要强制安装。
6. 考虑浏览器自动播放限制：只有用户点击“开始阅读”或“继续阅读”之后才播放音频；如果播放失败，动画仍然正常执行。
7. 支持 `prefers-reduced-motion`：用户开启减少动画时，缩短动画并减少震动。
8. 支持移动端：横屏和竖屏都能基本可用，素材不要溢出到不可见区域。
9. 演出期间添加一个可选的“跳过”按钮，允许用户提前关闭。
10. 演出层 `pointer-events` 需要合理处理：默认阻止正文误点，但“跳过”按钮可点。

## 事件接口

请暴露一个简单接口，例如：

```ts
playStoryEffect("qiao_feng_kang_long_you_hui");
```

或者在 React 中：

```tsx
const { playEffect, isPlaying } = useStoryEventEffect();
playEffect("qiao_feng_kang_long_you_hui");
```

## 演出时间线

请按下面节奏实现：

```txt
0.0s  全屏背景变暗，战斗背景出现
0.2s  烟尘出现，乔峰 idle 或 attack 图入场
0.7s  镜头/角色轻微推近
0.9s  “亢龙有悔”招式字出现
1.1s  播放龙吟或 full sequence 音频
1.3s  金色掌风/龙形特效从左向右轰出
1.5s  冲击波扩散，屏幕轻微震动
1.8s  闪光和爆裂光效出现
2.4s  烟尘扩散，掌风消散
3.5s  整体淡出
3.8s  清理 DOM / 状态回收
```

## 样式方向

风格关键词：

```txt
写实武侠、金色内力、暗色水墨背景、龙形掌风、震屏、电影感、互动读书演出
```

请避免做成游戏战斗 UI，不需要血条、伤害数字或复杂按钮。重点是“阅读中插入一段短促有冲击力的剧情演出”。

## 集成示例

如果正文数据是数组，请支持类似：

```js
const story = [
  { type: "text", content: "乔峰双目如电，猛然踏前一步。" },
  { type: "event", eventId: "qiao_feng_kang_long_you_hui" },
  { type: "text", content: "只听轰然一声，群雄皆惊。" }
];
```

当渲染到 `event` 类型时，不要显示文字，而是触发演出，然后自动进入下一段。

## 交付内容

请输出或修改以下内容：

1. 演出层组件/模块。
2. 对应 CSS 动画。
3. 音频播放封装。
4. 一个最小 demo 页面或示例调用。
5. 简短 README，说明素材目录和如何触发事件。
6. 代码要可运行、可维护、可配置。

