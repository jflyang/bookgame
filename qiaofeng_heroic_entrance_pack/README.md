# 乔峰出场动画与音效包

## 内容
- `video/qiaofeng_heroic_entrance.mp4`：带音效的出场动画（推荐通用播放）
- `video/qiaofeng_heroic_entrance.webm`：带音效的 WebM 版本（适合网页）
- `audio/qiaofeng_heroic_entrance.mp3`：单独音效
- `audio/qiaofeng_heroic_entrance.wav`：单独音效无损版
- `images/qiaofeng_hero_frame.jpg`：预览封面
- `images/qiaofeng_source_reference.png`：你提供的参考图

## 风格
英雄气概、武侠史诗感、出场 4.2 秒、金色光效、写实人物立绘。

## 网页使用建议
### HTML
```html
<video id="qfEntrance" preload="auto" playsinline style="width:100%;max-width:960px;display:none;">
  <source src="/assets/video/qiaofeng_heroic_entrance.webm" type="video/webm" />
  <source src="/assets/video/qiaofeng_heroic_entrance.mp4" type="video/mp4" />
</video>
```

### JS
```js
function playQiaoFengEntrance() {
  const video = document.getElementById('qfEntrance');
  video.style.display = 'block';
  video.currentTime = 0;
  video.play();
  video.onended = () => {
    video.style.display = 'none';
  };
}
```

## 说明
如果你想要下一步，我还可以继续给你做：
1. 透明背景版人物 PNG
2. 仅人物弹出、无背景的视频层
3. 与读书事件系统对接的前端 demo
4. “乔峰拍出亢龙有悔”完整第二段战斗演出包
