import type { KnowledgeDocument } from "@story-game/shared";

const now = new Date().toISOString();

export const knowledgeDocuments: KnowledgeDocument[] = [
  {
    id: "kb_qiaofeng_moves_md",
    title: "乔峰招数知识库",
    ownerId: "qiaofeng",
    sourceType: "markdown",
    createdAt: now,
    updatedAt: now,
    content: [
      "# 乔峰的招数",
      "",
      "## 降龙十八掌·亢龙有悔",
      "- 内力：35",
      "- 伤害：45~65",
      "- 效果：正面强压丁春秋，使其下一回合反击伤害降低",
      "- 描述：乔峰双掌推出，龙吟震野，掌风如怒潮压下",
      "- 台词：“虚竹，趁此刻！”",
      "",
      "## 降龙十八掌·飞龙在天",
      "- 内力：30",
      "- 伤害：35~50",
      "- 效果：可打断丁春秋蓄毒、施法或逃跑",
      "- 描述：乔峰腾身而起，一掌自上而下轰落",
      "- 台词：“莫让他聚毒！”",
      "",
      "## 擒龙功",
      "- 内力：20",
      "- 伤害：15~25",
      "- 效果：牵制丁春秋，使虚竹下一招命中率提高",
      "- 描述：乔峰五指虚抓，劲力隔空牵动丁春秋身形",
      "- 台词：“虚竹，攻他左肋！”",
      "",
      "## 豪气护体",
      "- 内力：25",
      "- 效果：替虚竹或段誉抵挡一次伤害，减少30~45点伤害",
      "- 描述：乔峰横身挡在前方，真气鼓荡，衣袍猎猎",
      "- 台词：“有我在。”"
    ].join("\n")
  }
];
