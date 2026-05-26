import type { Skill } from "@story-game/shared";

export const skills: Skill[] = [
  {
    id: "xianglong_kanglongyouhui",
    name: "降龙十八掌·亢龙有悔",
    ownerId: "qiaofeng",
    cost: { mp: 35 },
    damage: { min: 45, max: 65 },
    effect: "正面强压丁春秋，使其下一回合反击伤害降低",
    description: "乔峰双掌推出，龙吟震野，掌风如怒潮压下",
    sampleLine: "虚竹，趁此刻！"
  },
  {
    id: "xianglong_feilongzaitian",
    name: "降龙十八掌·飞龙在天",
    ownerId: "qiaofeng",
    cost: { mp: 30 },
    damage: { min: 35, max: 50 },
    effect: "可打断丁春秋蓄毒、施法或逃跑",
    description: "乔峰腾身而起，一掌自上而下轰落",
    sampleLine: "莫让他聚毒！"
  },
  {
    id: "qinlonggong",
    name: "擒龙功",
    ownerId: "qiaofeng",
    cost: { mp: 20 },
    damage: { min: 15, max: 25 },
    effect: "牵制丁春秋，使虚竹下一招命中率提高",
    description: "乔峰五指虚抓，劲力隔空牵动丁春秋身形",
    sampleLine: "虚竹，攻他左肋！"
  },
  {
    id: "haoqi_huti",
    name: "豪气护体",
    ownerId: "qiaofeng",
    cost: { mp: 25 },
    effect: "替虚竹或段誉抵挡一次伤害，减少30~45点伤害",
    description: "乔峰横身挡在前方，真气鼓荡，衣袍猎猎",
    sampleLine: "有我在。"
  },
  {
    id: "putong_zhangji",
    name: "普通掌击",
    ownerId: "qiaofeng",
    cost: { mp: 0 },
    damage: { min: 10, max: 18 },
    effect: "内力不足时使用",
    description: "乔峰踏步近身，沉肩出掌，劲风扑面"
  },
  {
    id: "beiming_zhenqi",
    name: "北冥真气",
    ownerId: "xuzhu",
    cost: { mp: 30 },
    damage: { min: 18, max: 32 },
    effect: "化解毒功并压制丁春秋内息",
    description: "虚竹以深厚内力回旋毒雾，化毒于无形"
  },
  {
    id: "lingbo_weibu",
    name: "凌波微步",
    ownerId: "duanyu",
    cost: { mp: 18 },
    effect: "闪避毒雾并揭示敌方破绽",
    description: "段誉身形飘忽，避开毒雾并观察战局"
  },
  {
    id: "xingxiu_duwu",
    name: "星宿毒雾",
    ownerId: "dingchunqiu",
    cost: { mp: 28 },
    damage: { min: 16, max: 28 },
    effect: "扩散毒雾，威胁虚竹或段誉",
    description: "丁春秋催动毒粉，毒雾贴地翻涌"
  },
  {
    id: "wandu_guizong",
    name: "万毒归宗",
    ownerId: "dingchunqiu",
    cost: { mp: 55 },
    damage: { min: 42, max: 58 },
    effect: "低血时的最终毒招",
    description: "丁春秋孤注一掷，将毒功尽数爆发"
  }
];
