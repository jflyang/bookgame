import { describe, it, expect } from "vitest";
import { SkillIndex } from "../skillIndex.js";
import { parseAttackTargetsFromKnowledgeDocs, parseSkillsFromKnowledgeDocs } from "../skillParser.js";
import type { Character, KnowledgeDocument } from "@story-game/shared";

function makeDoc(overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument {
  return {
    id: "kb_test",
    title: "测试技能",
    ownerId: "test_char",
    content: "",
    sourceType: "markdown",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ---- SkillIndex ----

describe("SkillIndex", () => {
  it("stores skills via replaceAll and retrieves via get", () => {
    const idx = new SkillIndex();
    idx.replaceAll([
      { id: "天山六阳掌", name: "天山六阳掌", ownerId: "xuzhu", cost: { mp: 30 }, damage: { min: 35, max: 50 } },
    ]);
    expect(idx.get("天山六阳掌")).toBeDefined();
    expect(idx.get("天山六阳掌")!.cost.mp).toBe(30);
    expect(idx.get("天山六阳掌")!.damage).toEqual({ min: 35, max: 50 });
  });

  it("returns undefined for unknown skill", () => {
    const idx = new SkillIndex();
    expect(idx.get("不存在")).toBeUndefined();
  });

  it("list returns all stored skills", () => {
    const idx = new SkillIndex();
    idx.replaceAll([
      { id: "A", name: "A", ownerId: "c1", cost: { mp: 10 } },
      { id: "B", name: "B", ownerId: "c2", cost: { mp: 20 } },
    ]);
    expect(idx.list()).toHaveLength(2);
  });

  it("replaceAll clears previous skills", () => {
    const idx = new SkillIndex();
    idx.replaceAll([{ id: "Old", name: "Old", ownerId: "c1", cost: { mp: 10 } }]);
    idx.replaceAll([{ id: "New", name: "New", ownerId: "c2", cost: { mp: 20 } }]);
    expect(idx.get("Old")).toBeUndefined();
    expect(idx.get("New")).toBeDefined();
  });

  it("clear removes all skills", () => {
    const idx = new SkillIndex();
    idx.replaceAll([{ id: "S", name: "S", ownerId: "c1", cost: { mp: 10 } }]);
    idx.clear();
    expect(idx.list()).toHaveLength(0);
  });
});

// ---- parseSkillsFromKnowledgeDocs ----

describe("parseSkillsFromKnowledgeDocs", () => {
  it("parses dash-format skill with damage", () => {
    const doc = makeDoc({
      ownerId: "xuzhu",
      content: "## 六、技能卡\n\n## 天山六阳掌\n\n- 内力：30\n- 伤害：35~50\n- 效果：阳刚掌力，可压制毒功\n- 描述：虚竹双掌推出\n- 台词：小僧得罪了！",
    });
    const skills = parseSkillsFromKnowledgeDocs([doc]);
    expect(skills).toHaveLength(1);
    expect(skills[0].id).toBe("天山六阳掌");
    expect(skills[0].name).toBe("天山六阳掌");
    expect(skills[0].ownerId).toBe("xuzhu");
    expect(skills[0].cost.mp).toBe(30);
    expect(skills[0].damage).toEqual({ min: 35, max: 50 });
    expect(skills[0].effect).toBe("阳刚掌力，可压制毒功");
  });

  it("parses asterisk-format skill with escaped tilde", () => {
    const doc = makeDoc({
      ownerId: "qiaofeng",
      content: "## 降龙十八掌·亢龙有悔\n\n* 内力：35\n* 伤害：45\\~65\n* 效果：正面强压丁春秋",
    });
    const skills = parseSkillsFromKnowledgeDocs([doc]);
    expect(skills).toHaveLength(1);
    expect(skills[0].id).toBe("降龙十八掌·亢龙有悔");
    expect(skills[0].cost.mp).toBe(35);
    expect(skills[0].damage).toEqual({ min: 45, max: 65 });
  });

  it("parses skill without damage (defensive/movement)", () => {
    const doc = makeDoc({
      ownerId: "duanyu",
      content: "## 凌波微步\n\n- 内力：18\n- 效果：闪避毒雾并揭示敌方破绽\n- 描述：段誉身形飘忽",
    });
    const skills = parseSkillsFromKnowledgeDocs([doc]);
    expect(skills).toHaveLength(1);
    expect(skills[0].cost.mp).toBe(18);
    expect(skills[0].damage).toBeUndefined();
    expect(skills[0].effect).toBe("闪避毒雾并揭示敌方破绽");
  });

  it("handles 全部 MP cost as 999", () => {
    const doc = makeDoc({
      ownerId: "dingchunqiu",
      content: "## 万毒归宗\n\n- 条件：气血低于25\n- 内力：全部\n- 伤害：50~75\n- 效果：最终毒招",
    });
    const skills = parseSkillsFromKnowledgeDocs([doc]);
    expect(skills).toHaveLength(1);
    expect(skills[0].cost.mp).toBe(999);
    expect(skills[0].damage).toEqual({ min: 50, max: 75 });
  });

  it("parses skills from multiple docs with different owners", () => {
    const xuzhuDoc = makeDoc({
      ownerId: "xuzhu",
      content: "## 天山六阳掌\n\n- 内力：30\n- 伤害：35~50",
    });
    const dingDoc = makeDoc({
      ownerId: "dingchunqiu",
      content: "## 星宿毒雾\n\n- 内力：30\n- 伤害：20~35\n- 效果：全场毒雾",
    });
    const skills = parseSkillsFromKnowledgeDocs([xuzhuDoc, dingDoc]);
    expect(skills).toHaveLength(2);
    expect(skills[0].ownerId).toBe("xuzhu");
    expect(skills[1].ownerId).toBe("dingchunqiu");
  });

  it("skips non-skill sections", () => {
    const doc = makeDoc({
      ownerId: "qiaofeng",
      content: [
        "## 角色定位",
        "* 姓名：乔峰",
        "",
        "## 降龙十八掌·亢龙有悔",
        "* 内力：35",
        "* 伤害：45\\~65",
        "",
        "## 战斗判断",
        "* 如果丁春秋毒雾扩散，乔峰应优先用掌力压制",
        "",
        "## 普通掌击",
        "* 内力：0",
        "* 伤害：10\\~18",
      ].join("\n"),
    });
    const skills = parseSkillsFromKnowledgeDocs([doc]);
    expect(skills).toHaveLength(2);
    expect(skills.map((s) => s.id)).toEqual(["降龙十八掌·亢龙有悔", "普通掌击"]);
  });

  it("skips category headers like 六、技能卡", () => {
    const doc = makeDoc({
      ownerId: "xuzhu",
      content: "## 六、技能卡\n\n## 北冥真气\n\n- 内力：20\n- 伤害：15~25",
    });
    const skills = parseSkillsFromKnowledgeDocs([doc]);
    expect(skills).toHaveLength(1);
    expect(skills[0].id).toBe("北冥真气");
  });

  it("deduplicates by skill name", () => {
    const doc = makeDoc({
      ownerId: "xuzhu",
      content: "## 天山六阳掌\n\n- 内力：30\n- 伤害：35~50\n\n## 天山六阳掌\n\n- 内力：30\n- 伤害：35~50",
    });
    const skills = parseSkillsFromKnowledgeDocs([doc]);
    expect(skills).toHaveLength(1);
  });

  it("returns empty array for docs without skills", () => {
    const doc = makeDoc({
      content: "## 角色定位\n\n这是角色介绍，没有内力字段",
    });
    expect(parseSkillsFromKnowledgeDocs([doc])).toHaveLength(0);
  });

  it("returns empty array for empty docs", () => {
    expect(parseSkillsFromKnowledgeDocs([])).toHaveLength(0);
  });

  it("uses colon separator (半角冒号) in field names", () => {
    const doc = makeDoc({
      ownerId: "test",
      content: "## 测试招式\n\n- 内力: 25\n- 伤害: 10~20\n- 效果: 测试效果",
    });
    const skills = parseSkillsFromKnowledgeDocs([doc]);
    expect(skills).toHaveLength(1);
    expect(skills[0].cost.mp).toBe(25);
    expect(skills[0].damage).toEqual({ min: 10, max: 20 });
  });

  it("parses real 丁春秋 knowledge doc correctly", () => {
    const doc = makeDoc({
      id: "kb_dingchunqiu",
      ownerId: "dingchunqiu",
      content: "## 六、技能卡\r\n\r\n## 化功大法\r\n\r\n- 内力：35\r\n- 伤害：25~40\r\n- 效果：削减乔峰或虚竹15~25内力\r\n- 描述：丁春秋怪笑一声，毒掌贴近\r\n- 台词：让老仙化了你的内力！\r\n\r\n## 星宿毒雾\r\n\r\n- 内力：30\r\n- 伤害：20~35\r\n- 效果：全场毒雾\r\n- 描述：丁春秋羽扇一挥\r\n- 台词：尝尝老仙的星宿毒雾！\r\n\r\n## 毒雾遁身\r\n\r\n- 内力：20\r\n- 效果：闪避一次攻击\r\n- 描述：毒雾炸开\r\n\r\n## 普通毒掌\r\n\r\n- 内力：0\r\n- 伤害：8~15\r\n- 效果：内力不足时使用\r\n",
    });
    const skills = parseSkillsFromKnowledgeDocs([doc]);
    expect(skills).toHaveLength(4);
    expect(skills.map((s) => s.id)).toEqual(["化功大法", "星宿毒雾", "毒雾遁身", "普通毒掌"]);
    // 化功大法: damage skill
    expect(skills[0].cost.mp).toBe(35);
    expect(skills[0].damage).toEqual({ min: 25, max: 40 });
    // 毒雾遁身: no damage
    expect(skills[2].damage).toBeUndefined();
    // 普通毒掌: zero mp, has damage
    expect(skills[3].cost.mp).toBe(0);
    expect(skills[3].damage).toEqual({ min: 8, max: 15 });
  });

  it("parses real 乔峰 knowledge doc correctly", () => {
    const doc = makeDoc({
      id: "kb_qiaofeng",
      ownerId: "qiaofeng",
      content: [
        "## 乔峰知识库技能卡",
        "",
        "使用规则：粗体内容会被表演系统识别。",
        "",
        "## 角色定位",
        "* 姓名：乔峰",
        "* 战斗气质：刚猛、果断",
        "",
        "## 降龙十八掌·亢龙有悔",
        "* 内力：35",
        "* 伤害：45\\~65",
        "* 效果：正面强压丁春秋",
        "",
        "## 豪气护体",
        "* 内力：25",
        "* 效果：替虚竹或段誉抵挡一次伤害",
        "",
        "## 战斗判断",
        "* 如果丁春秋毒雾扩散，乔峰应优先用掌力压制",
      ].join("\n"),
    });
    const skills = parseSkillsFromKnowledgeDocs([doc]);
    expect(skills).toHaveLength(2);
    expect(skills[0].id).toBe("降龙十八掌·亢龙有悔");
    expect(skills[0].cost.mp).toBe(35);
    expect(skills[0].damage).toEqual({ min: 45, max: 65 });
    expect(skills[1].id).toBe("豪气护体");
    expect(skills[1].cost.mp).toBe(25);
    expect(skills[1].damage).toBeUndefined();
  });
});

// ---- parseAttackTargetsFromKnowledgeDocs ----

describe("parseAttackTargetsFromKnowledgeDocs", () => {
  const characters: Character[] = [
    { id: "qiaofeng", name: "乔峰", role: "主导者", avatar: "乔", personaPrompt: "", rules: [], knowledgeBaseIds: [], attackableTargetIds: [] },
    { id: "xuzhu", name: "虚竹", role: "行动者", avatar: "虚", personaPrompt: "", rules: [], knowledgeBaseIds: [], attackableTargetIds: [] },
    { id: "duanyu", name: "段誉", role: "观察者", avatar: "段", personaPrompt: "", rules: [], knowledgeBaseIds: [], attackableTargetIds: [] },
    { id: "dingchunqiu", name: "丁春秋", role: "反派", avatar: "丁", personaPrompt: "", rules: [], knowledgeBaseIds: [], attackableTargetIds: [] },
  ];

  it("parses single attack target from knowledge doc", () => {
    const doc = makeDoc({
      ownerId: "xuzhu",
      content: "可攻击目标：丁春秋\n\n## 技能卡\n\n...",
    });
    const targets = parseAttackTargetsFromKnowledgeDocs([doc], characters);
    expect(targets.get("xuzhu")).toEqual(["dingchunqiu"]);
  });

  it("parses multiple comma-separated attack targets", () => {
    const doc = makeDoc({
      ownerId: "dingchunqiu",
      content: "## 角色定位\n\n可攻击目标：乔峰、虚竹、段誉\n\n## 技能卡",
    });
    const targets = parseAttackTargetsFromKnowledgeDocs([doc], characters);
    expect(targets.get("dingchunqiu")).toEqual(["qiaofeng", "xuzhu", "duanyu"]);
  });

  it("parses targets separated by Chinese comma", () => {
    const doc = makeDoc({
      ownerId: "dingchunqiu",
      content: "可攻击目标：乔峰，虚竹",
    });
    const targets = parseAttackTargetsFromKnowledgeDocs([doc], characters);
    expect(targets.get("dingchunqiu")).toEqual(["qiaofeng", "xuzhu"]);
  });

  it("skips unknown target names (no matching character)", () => {
    const doc = makeDoc({
      ownerId: "xuzhu",
      content: "可攻击目标：丁春秋、扫地僧",
    });
    const targets = parseAttackTargetsFromKnowledgeDocs([doc], characters);
    expect(targets.get("xuzhu")).toEqual(["dingchunqiu"]);
  });

  it("returns empty map for docs without attack target line", () => {
    const doc = makeDoc({
      ownerId: "xuzhu",
      content: "## 技能卡\n\n- 内力：30\n- 伤害：35~50",
    });
    const targets = parseAttackTargetsFromKnowledgeDocs([doc], characters);
    expect(targets.size).toBe(0);
  });

  it("returns empty map for empty docs", () => {
    expect(parseAttackTargetsFromKnowledgeDocs([], characters).size).toBe(0);
  });

  it("skips doc with null ownerId", () => {
    const doc = makeDoc({
      ownerId: null as unknown as string,
      content: "可攻击目标：丁春秋",
    });
    const targets = parseAttackTargetsFromKnowledgeDocs([doc], characters);
    expect(targets.size).toBe(0);
  });

  it("returns empty array when all target names are unknown", () => {
    const doc = makeDoc({
      ownerId: "xuzhu",
      content: "可攻击目标：扫地僧、风清扬",
    });
    const targets = parseAttackTargetsFromKnowledgeDocs([doc], characters);
    expect(targets.size).toBe(0);
  });

  it("merges targets from multiple docs for different owners", () => {
    const xuzhuDoc = makeDoc({ ownerId: "xuzhu", content: "可攻击目标：丁春秋" });
    const qiaofengDoc = makeDoc({ ownerId: "qiaofeng", content: "可攻击目标：丁春秋" });
    const targets = parseAttackTargetsFromKnowledgeDocs([xuzhuDoc, qiaofengDoc], characters);
    expect(targets.get("xuzhu")).toEqual(["dingchunqiu"]);
    expect(targets.get("qiaofeng")).toEqual(["dingchunqiu"]);
  });
});
