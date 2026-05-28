import type { Scenario } from "@story-game/shared";

export const scenarios: Scenario[] = [
  {
    id: "虚竹",
    title: "虚竹除害星宿老怪",
    premise: "虚竹得知丁春秋欺师灭祖，决定为逍遥派清理门户。山道旁，乔峰、虚竹、段誉与丁春秋狭路相逢。",
    currentStage: "poison_fog",
    stages: ["opening", "encounter", "poison_fog", "counterattack", "crisis", "resolution"],
    stageDetails: [
      { id: "opening", title: "开场", description: "三人抵达枯松岭，危机尚未完全显露。", enterWhen: "会话开始。", guidance: "铺垫地点、人物关系和丁春秋的威胁。", directive: "虚竹必须在对话中明确表达为逍遥派清理门户的决心，乔峰主动压阵、段誉负责观察" },
      { id: "encounter", title: "遭遇", description: "丁春秋与星宿派正式出现，双方开始言语试探。", enterWhen: "敌方现身并挑衅。", guidance: "让冲突升温，但不要立即决战。", directive: "丁春秋必须当众嘲讽虚竹并展示毒功，虚竹以劝诫回应——双方确认对立但暂未动手" },
      { id: "poison_fog", title: "毒雾初起", description: "丁春秋释放毒雾，战局进入危险。", enterWhen: "丁春秋首次施毒或环境出现毒雾。", guidance: "突出毒雾压迫，推动虚竹或乔峰寻找应对。", directive: "丁春秋必须释放惨绿色毒雾笼罩战场，虚竹以北冥真气化解第一波毒雾并保护同伴" },
      { id: "counterattack", title: "反击", description: "正派角色压制毒雾并开始反制丁春秋。", enterWhen: "毒雾被化解或丁春秋攻势受阻。", guidance: "让技能和配合产生实际战果。", directive: "虚竹必须以天山六阳掌击中丁春秋肩头，丁春秋首次吐血受伤露出惊疑之色" },
      { id: "crisis", title: "危机", description: "战斗出现重大风险或角色气血明显降低。", enterWhen: "任一关键角色陷入危险，或丁春秋准备最终毒招。", guidance: "制造艰难选择，但保留解决机会。", directive: "丁春秋必须使出最终毒招将战场推向生死边缘，虚竹在危急时刻被迫弹出生死符——表现出慈悲与决断的并存" },
      { id: "resolution", title: "结局", description: "丁春秋败退、被制伏或战斗收束。", enterWhen: "丁春秋气血归零、逃跑失败或剧情目标完成。", guidance: "收束战斗结果，不继续扩大战局。", directive: "丁春秋必须被制伏并失去继续施毒的能力，虚竹以合十收尾留其性命，乔峰给予肯定、段誉感叹收官" }
    ],
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
