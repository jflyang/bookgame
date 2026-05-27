# 乔峰「亢龙有悔」互动读书演出 - Codex 提示词包

用途：把图片素材与音效素材交给 Codex，让它在你的 Web 项目里实现“读到关键事件时弹出乔峰、播放出招动画和音效、结束后自动关闭”的互动阅读效果。

建议把素材包解压到项目的 `public/` 目录下，例如：

```txt
public/
  images/
    characters/
    skills/
    fx/
    backgrounds/
  sounds/
```

然后把本提示词包中的 `01_codex_main_prompt.md` 直接粘贴给 Codex。

如果你的项目是 React / Next.js，优先使用 `02_react_next_prompt.md`。
如果你的项目是纯 HTML/CSS/JS，使用 `03_vanilla_web_prompt.md`。

