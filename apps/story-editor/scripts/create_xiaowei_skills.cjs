/**
 * 为"小薇的身体"故事包创建 skills.json
 * 
 * 用法: node scripts/create_xiaowei_skills.cjs
 * 
 * 技能分类（用 effect 字段标记）：
 * - "主动|xxx"：少爷、大姐、二姐拥有，可以对小薇实施
 * - "被动|xxx"：小薇拥有，是对主动技能的身体/心理反应
 */

const fs = require("fs");
const path = require("path");

const outputPath = path.resolve(__dirname, "../../data/task-packages/story_a_CW69KOgU/skills.json");

const skills = [
  // ═══ 少爷 — 主动技能（命令/享用类）═══
  { id: "skill_shaoye_kiss", name: "强吻", ownerId: "shao_ye", cost: { mp: 0 }, effect: "主动|亲密", description: "少爷强行捏住小薇下巴，将舌头探入她口中，深吻时不允许她闭嘴或躲避。", sampleLine: "嘴张开，让爷尝尝你的味道。" },
  { id: "skill_shaoye_fondle_breast", name: "揉捏乳房", ownerId: "shao_ye", cost: { mp: 0 }, effect: "主动|挑逗", description: "少爷用手掌包裹住小薇的乳房，时而轻揉时而用力捏紧乳尖，观察她的反应。", sampleLine: "这么敏感？才碰了一下就硬了。" },
  { id: "skill_shaoye_oral_command", name: "命令口侍", ownerId: "shao_ye", cost: { mp: 0 }, effect: "主动|命令", description: "少爷按住小薇的头，命令她跪下用嘴服侍。控制节奏和深度，不允许她自行停止。", sampleLine: "跪下，用嘴好好伺候。" },
  { id: "skill_shaoye_penetrate", name: "插入", ownerId: "shao_ye", cost: { mp: 0 }, effect: "主动|占有", description: "少爷将小薇固定在某个姿势后直接插入，根据心情决定速度和力度。", sampleLine: "夹紧了，让爷舒服。" },
  { id: "skill_shaoye_edge", name: "边缘控制", ownerId: "shao_ye", cost: { mp: 0 }, effect: "主动|控制", description: "少爷在小薇即将高潮时突然停止所有刺激，反复将她推到边缘又拉回，不允许她释放。", sampleLine: "想去？没我的允许不行。" },

  // ═══ 大姐 — 主动技能（调教/道具类）═══
  { id: "skill_dajie_suspend", name: "悬吊调教", ownerId: "da_jie", cost: { mp: 0 }, effect: "主动|束缚", description: "大姐用绳索将小薇双手绑缚吊起，使其脚尖勉强着地，身体完全暴露无法挣脱。配合乳夹和跳蛋增加刺激。", sampleLine: "吊起来之后，你的身体就不再属于你了。" },
  { id: "skill_dajie_vibrator", name: "跳蛋折磨", ownerId: "da_jie", cost: { mp: 0 }, effect: "主动|道具", description: "大姐将高频跳蛋固定在小薇的敏感部位，调节频率和模式，长时间持续刺激不允许取下。", sampleLine: "开到最大档，看你能忍多久。" },
  { id: "skill_dajie_nipple_clamp", name: "乳夹惩罚", ownerId: "da_jie", cost: { mp: 0 }, effect: "主动|惩罚", description: "大姐将带链条的乳夹夹住小薇乳尖，通过拉扯链条施加疼痛，或挂上重物增加压迫感。", sampleLine: "疼吗？这才刚开始。" },
  { id: "skill_dajie_aphrodisiac", name: "媚药涂抹", ownerId: "da_jie", cost: { mp: 0 }, effect: "主动|药物", description: "大姐将特制媚药涂抹在小薇的敏感部位，使其敏感度成倍增加，身体不受控制地发热发情。", sampleLine: "涂上这个，你的身体会比你的嘴诚实得多。" },
  { id: "skill_dajie_anal_plug", name: "肛塞调教", ownerId: "da_jie", cost: { mp: 0 }, effect: "主动|道具", description: "大姐将不同尺寸的肛塞逐步塞入小薇后穴，从小号开始逐渐加大，训练她的承受能力。", sampleLine: "放松，抗拒只会让你更痛。" },
  { id: "skill_dajie_whip", name: "鞭打", ownerId: "da_jie", cost: { mp: 0 }, effect: "主动|惩罚", description: "大姐用皮鞭抽打小薇的臀部、大腿内侧或乳房，力度精准控制在疼痛与快感的边界。", sampleLine: "数着，漏数了重来。" },

  // ═══ 二姐 — 主动技能（观察/辅助类）═══
  { id: "skill_erjie_report", name: "状态播报", ownerId: "er_jie", cost: { mp: 0 }, effect: "主动|观察", description: "二姐近距离观察小薇的身体反应，用露骨的语言实时播报她的敏感程度、出水量、颤抖频率等。", sampleLine: "报告，她下面已经湿透了，大腿在发抖。" },
  { id: "skill_erjie_tease", name: "言语羞辱", ownerId: "er_jie", cost: { mp: 0 }, effect: "主动|心理", description: "二姐用下流的语言描述小薇当前的狼狈状态，故意让她听到，加深羞耻感和心理崩溃。", sampleLine: "看看你现在的样子，嘴上说不要，身体倒是很诚实呢。" },
  { id: "skill_erjie_assist", name: "辅助固定", ownerId: "er_jie", cost: { mp: 0 }, effect: "主动|辅助", description: "二姐帮助固定小薇的身体姿势，掰开双腿或按住肩膀，确保调教过程中她无法逃避。", sampleLine: "别动，乖乖张开腿。" },

  // ═══ 小薇 — 被动技能（身体/心理反应）═══
  { id: "skill_xiaowei_moan", name: "呻吟失控", ownerId: "xiao_wei", cost: { mp: 0 }, effect: "被动|声音反应", description: "当受到持续刺激时，小薇无法控制地发出呻吟声，越试图忍住声音越大。对应：揉捏乳房、跳蛋折磨、插入。", sampleLine: "不...啊...不要..." },
  { id: "skill_xiaowei_tremble", name: "身体颤抖", ownerId: "xiao_wei", cost: { mp: 0 }, effect: "被动|身体反应", description: "当被边缘控制或悬吊时，小薇的双腿和腰部不自主地剧烈颤抖，无法站稳。对应：边缘控制、悬吊调教。", sampleLine: "腿...腿软了...站不住..." },
  { id: "skill_xiaowei_wet", name: "不自主出水", ownerId: "xiao_wei", cost: { mp: 0 }, effect: "被动|身体反应", description: "即使心理上抗拒，小薇的身体仍会大量分泌爱液，暴露她的真实感受。对应：媚药涂抹、跳蛋折磨、揉捏乳房。", sampleLine: "不是...这不是我想要的...身体自己..." },
  { id: "skill_xiaowei_nipple_erect", name: "乳尖挺立", ownerId: "xiao_wei", cost: { mp: 0 }, effect: "被动|身体反应", description: "乳头在刺激下迅速充血挺立，变得极度敏感，轻触即有强烈反应。对应：揉捏乳房、乳夹惩罚、强吻。", sampleLine: "别...别碰那里...太敏感了..." },
  { id: "skill_xiaowei_shame_cry", name: "羞耻哭泣", ownerId: "xiao_wei", cost: { mp: 0 }, effect: "被动|心理反应", description: "当被言语羞辱或身体反应被当面指出时，小薇因极度羞耻而流泪，但哭泣并不能阻止身体的反应。对应：言语羞辱、状态播报。", sampleLine: "呜...不要说出来...求你了..." },
  { id: "skill_xiaowei_beg", name: "求饶乞怜", ownerId: "xiao_wei", cost: { mp: 0 }, effect: "被动|心理反应", description: "在调教后期，小薇放弃抵抗开始主动求饶，语气从愤怒变为哀求。对应：鞭打、肛塞调教、边缘控制。", sampleLine: "求求你...放过我...我受不了了..." },
  { id: "skill_xiaowei_orgasm_deny", name: "高潮被拒", ownerId: "xiao_wei", cost: { mp: 0 }, effect: "被动|身体反应", description: "在边缘控制下反复被推到高潮边缘又被拉回，身体积累的快感无处释放，导致全身痉挛和精神崩溃。对应：边缘控制。", sampleLine: "让我...让我去...求你了...快疯了..." },
  { id: "skill_xiaowei_submit", name: "屈服顺从", ownerId: "xiao_wei", cost: { mp: 0 }, effect: "被动|心理反应", description: "经过长时间调教后，小薇的抵抗意志彻底崩溃，开始主动配合甚至迎合调教者的要求。对应：所有主动技能的累积效果。", sampleLine: "我...我听话...你说什么我都做..." }
];

fs.writeFileSync(outputPath, JSON.stringify(skills, null, 2), "utf-8");
console.log(`✅ 已创建 skills.json: ${outputPath}`);
console.log(`   技能总数: ${skills.length}`);
console.log(`   少爷: ${skills.filter(s => s.ownerId === "shao_ye").length} 个主动技能`);
console.log(`   大姐: ${skills.filter(s => s.ownerId === "da_jie").length} 个主动技能`);
console.log(`   二姐: ${skills.filter(s => s.ownerId === "er_jie").length} 个主动技能`);
console.log(`   小薇: ${skills.filter(s => s.ownerId === "xiao_wei").length} 个被动技能`);
