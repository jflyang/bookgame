# 原生 HTML / CSS / JS 专用提示词

请在当前纯前端项目中实现一个不依赖框架的“乔峰亢龙有悔互动演出层”。

## 请创建文件

```txt
public/kungfu-effect/kungfuEffect.js
public/kungfu-effect/kungfuEffect.css
public/kungfu-effect/demo.html
```

## JS API

请暴露全局或模块函数：

```js
window.playStoryEffect("qiao_feng_kang_long_you_hui");
```

或者：

```js
import { playStoryEffect } from "./kungfuEffect.js";
playStoryEffect("qiao_feng_kang_long_you_hui");
```

## 实现要求

1. 函数调用后动态创建 overlay DOM。
2. 插入背景、乔峰、招式字、掌风、冲击波、烟尘、闪光等图片层。
3. 播放 `kanglong-full-sequence.mp3`。
4. 约 3.8 秒后自动移除 overlay。
5. 提供 skip 按钮，点击立即关闭并停止音频。
6. 不要依赖构建工具。
7. CSS 动画写在 `kungfuEffect.css`。
8. demo.html 可直接双击或通过本地服务器打开测试。

## DOM 结构建议

```html
<div class="kungfu-overlay kungfu-shake">
  <div class="kungfu-bg"></div>
  <img class="kungfu-character" />
  <img class="kungfu-title" />
  <img class="kungfu-dragon" />
  <img class="kungfu-shockwave" />
  <img class="kungfu-burst" />
  <img class="kungfu-smoke" />
  <img class="kungfu-flash" />
  <button class="kungfu-skip">跳过</button>
</div>
```

## 注意

浏览器可能阻止自动播放音频，所以 demo 页必须有一个“开始阅读”按钮，用户点击后再触发演出。

