# 故事事件数据结构建议

推荐把互动阅读正文设计成结构化数据，方便后续加入更多角色和招式。

```ts
type StoryNode =
  | {
      type: "text";
      content: string;
    }
  | {
      type: "event";
      eventId: string;
      autoContinue?: boolean;
    }
  | {
      type: "choice";
      options: Array<{
        label: string;
        nextId: string;
      }>;
    };
```

## 示例

```js
export const demoStory = [
  {
    type: "text",
    content: "乔峰立于风雪之中，双目如电，衣袍猎猎作响。"
  },
  {
    type: "text",
    content: "群雄逼近，杀气如潮。乔峰忽然沉肩坠肘，掌心金光骤起。"
  },
  {
    type: "event",
    eventId: "qiao_feng_kang_long_you_hui",
    autoContinue: true
  },
  {
    type: "text",
    content: "只听轰然一声，掌风如龙，众人骇然退避。"
  }
];
```

## 事件配置扩展方向

```js
export const storyEffects = {
  qiao_feng_kang_long_you_hui: {
    name: "亢龙有悔",
    characterName: "乔峰",
    type: "kungfu",
    duration: 3800,
    assets: {},
    audio: {}
  },
  duan_yu_liu_mai_shen_jian: {
    name: "六脉神剑",
    characterName: "段誉",
    type: "swordQi",
    duration: 3200,
    assets: {},
    audio: {}
  }
};
```

