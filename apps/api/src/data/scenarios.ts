import type { Scenario } from "@story-game/shared";

export const scenarios: Scenario[] = [
  {
    id: "xuzhu_vs_dingchunqiu",
    title: "虚竹除害星宿老怪",
    premise: "虚竹得知丁春秋欺师灭祖，决定为逍遥派清理门户。山道旁，乔峰、虚竹、段誉与丁春秋狭路相逢。",
    currentStage: "poison_fog",
    stages: ["opening", "encounter", "poison_fog", "counterattack", "crisis", "resolution"],
    currentGoal: "限制丁春秋毒功，保护段誉，并逐步迫使丁春秋败退。",
    rules: [
      "不要一次性说完整个故事",
      "每次只推进一小步",
      "保持武侠战斗张力",
      "气血归零者败",
      "丁春秋气血低于 30 时尝试逃跑"
    ],
    initialStates: [
      { characterId: "xuzhu", hp: 360, mp: 2000, attack: "中", defense: "极高", speed: "极高" },
      { characterId: "qiaofeng", hp: 700, mp: 800, attack: "极高", defense: "高", speed: "中上" },
      { characterId: "duanyu", hp: 180, mp: 260, attack: "低", defense: "中", speed: "极高" },
      { characterId: "dingchunqiu", hp: 400, mp: 180, attack: "中", defense: "中", speed: "中" }
    ]
  }
];
