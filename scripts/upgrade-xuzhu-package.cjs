const fs = require('fs');
const base = './apps/data/task-packages/xuzhu_vs_dingchunqiu';

// ============================================================
// 1. ADD MISSING SKILLS TO skills.json
// ============================================================
const skillsPath = `${base}/skills.json`;
const skills = JSON.parse(fs.readFileSync(skillsPath, 'utf-8'));

const newSkills = [
  // 虚竹
  { id: 'tianshan_liuyangzhang', name: '天山六阳掌', ownerId: 'xuzhu', cost: { mp: 30 }, damage: { min: 35, max: 50 }, effect: '阳刚掌力层层递进，如春阳化雪，可压制毒功' },
  { id: 'tianshan_zhemeishou', name: '天山折梅手', ownerId: 'xuzhu', cost: { mp: 25 }, damage: { min: 25, max: 40 }, effect: '拆解丁春秋招式，本回合自身受伤降低' },
  { id: 'shengsifu_hanyi', name: '生死符·寒意初现', ownerId: 'xuzhu', cost: { mp: 40 }, damage: { min: 45, max: 60 }, effect: '寒意如细针入经脉，丁春秋下一回合行动受限' },
  { id: 'fomen_huti', name: '佛门护体', ownerId: 'xuzhu', cost: { mp: 25 }, damage: { min: 0, max: 0 }, effect: '双手合十内力护身，本回合受到伤害减少40%' },
  { id: 'xuzhu_putong_zhangji', name: '普通掌击', ownerId: 'xuzhu', cost: { mp: 0 }, damage: { min: 8, max: 15 }, effect: '内力不足时使用' },
  // 段誉
  { id: 'liumai_shaoshang', name: '六脉神剑·少商剑', ownerId: 'duanyu', cost: { mp: 35 }, damage: { min: 30, max: 45 }, effect: '救急打断丁春秋一次行动，乔峰或虚竹气血低于50时可用' },
  { id: 'liumai_shangyang', name: '六脉神剑·商阳剑', ownerId: 'duanyu', cost: { mp: 30 }, damage: { min: 25, max: 40 }, effect: '阻断丁春秋退路，逃跑时使用' },
  // 丁春秋
  { id: 'huagong_dafa', name: '化功大法', ownerId: 'dingchunqiu', cost: { mp: 35 }, damage: { min: 25, max: 40 }, effect: '削减乔峰或虚竹15~25内力' },
  { id: 'fushi_duzhang', name: '腐尸毒掌', ownerId: 'dingchunqiu', cost: { mp: 25 }, damage: { min: 30, max: 45 }, effect: '若命中，目标下一回合持续损失5~10气血' },
  { id: 'duwu_dunshen', name: '毒雾遁身', ownerId: 'dingchunqiu', cost: { mp: 20 }, damage: { min: 0, max: 0 }, effect: '闪避一次攻击，拉开距离' },
  { id: 'xingxiu_yaofeng', name: '星宿妖风', ownerId: 'dingchunqiu', cost: { mp: 30 }, damage: { min: 20, max: 30 }, effect: '扰乱虚竹动作，使其下一次攻击伤害降低' },
];

const existingIds = new Set(skills.map(s => s.id));
for (const s of newSkills) {
  if (!existingIds.has(s.id)) {
    skills.push(s);
    console.log('  + skill:', s.id);
  }
}
fs.writeFileSync(skillsPath, JSON.stringify(skills, null, 2), 'utf-8');
console.log('1. Skills: ' + skills.length + ' total');

// ============================================================
// 2. ADD STAGE PROGRESSION PROMPT RULE
// ============================================================
const storyPath = `${base}/story.json`;
const story = JSON.parse(fs.readFileSync(storyPath, 'utf-8'));

const stageRule = {
  id: 'rule_stage_progression',
  title: '战斗阶段渐进规则',
  enabled: true,
  content: [
    '【战斗阶段渐进规则 — 必须严格遵守】',
    '',
    '这是虚竹对阵丁春秋的完整战斗剧本，共9个阶段。你必须按照①→②→③→④→⑤→⑥→⑦→⑧→⑨的顺序推进。',
    '不得跳跃阶段、不得在某个阶段卡住超过2轮。这是武侠战斗，不是闲聊。',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '阶段① origin 起因（1~2轮）',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '氛围：暮色深沉，枯松岭山道上。虚竹拦住丁春秋，劝其回头。乔峰段誉分立两侧。',
    '',
    '虚竹：合十劝诫，不要急于动手。',
    '乔峰：站在虚竹身侧，简单表明立场。',
    '段誉：观察场中形势。',
    '丁春秋：不屑一顾，让星宿弟子吹嘘自己。',
    '',
    '→ 推进条件：丁春秋明确拒绝悔改，气氛转为敌对',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '阶段② encounter 相遇交锋（2~3轮）',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '氛围：丁春秋开始释放毒雾试探，虚竹以**北冥真气**化解。战斗开始但双方都在试探。',
    '',
    '丁春秋：**星宿毒雾**扩散 → 试探三人深浅',
    '虚竹：**北冥真气**化解毒雾，表现内力深厚',
    '乔峰：识破毒功，给虚竹简短指令。可出**普通掌击**试探',
    '段誉：**战场观察**描述战局变化',
    '',
    '→ 推进条件：至少一轮毒雾被化解，丁春秋意识到虚竹内力深厚',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '阶段③ escalation 冲突升级（2~3轮）',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '氛围：丁春秋从试探转为真正施毒。毒雾压迫感增强，虚竹全力化解。乔峰准备出手。',
    '',
    '丁春秋：**化功大法**或**星宿妖风** → 目标虚竹',
    '虚竹：**天山折梅手**拆解招式 → **佛门护体**自保',
    '乔峰：**擒龙功**牵制丁春秋，给虚竹创造机会',
    '段誉：**凌波微步**闪避毒雾波及',
    '',
    '→ 推进条件：丁春秋开始使用化功大法或妖风，虚竹以招式应对',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '阶段④ first_clash 初次交手（2~3轮）',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '氛围：第一次真正的拳掌相碰。毒雾被北冥真气压制后，丁春秋转为近身化功。虚竹看似笨拙但功力深厚。',
    '',
    '丁春秋：**腐尸毒掌**近身攻击 → 腥臭逼人',
    '虚竹：**天山六阳掌**正面回应，掌力温厚却层层递进',
    '乔峰：**降龙十八掌·飞龙在天**打断丁春秋蓄力（首次出手）',
    '段誉：**招式解说**描写掌风毒雾碰撞的细节',
    '',
    '→ 推进条件：双方至少交手一招，丁春秋首次被虚竹掌力震惊',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '阶段⑤ poison_counter 施毒反扑（2~3轮）',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '氛围：丁春秋被击退后恼怒反扑，毒雾扩大威胁乔峰段誉。乔峰首次正面出手。战斗最高潮的序幕。',
    '',
    '丁春秋：毒雾扩散到全场 → 威胁段誉或乔峰',
    '乔峰：**降龙十八掌·亢龙有悔**正面压制！这是乔峰的高光时刻',
    '虚竹：配合乔峰，**天山六阳掌**击中丁春秋',
    '段誉：若有人危险 → **六脉神剑·少商剑**救急',
    '',
    '→ 推进条件：乔峰亢龙有悔压制毒雾，虚竹天山六阳掌命中丁春秋',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '阶段⑥ fear_retreat 畏惧退意（1~2轮）',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '氛围：丁春秋受伤，毒功受限，气势转弱，开始想逃。',
    '',
    '丁春秋：**毒雾遁身**试图拉开距离逃跑',
    '乔峰：识破逃跑意图，"虚竹，封他退路！"',
    '段誉：若丁春秋逃 → **六脉神剑·商阳剑**阻断退路',
    '虚竹：准备**生死符·寒意初现**',
    '',
    '→ 推进条件：丁春秋尝试逃跑被识破/阻断，虚竹准备生死符',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '阶段⑦ death_talisman 生死符出手（1~2轮）',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '氛围：最高潮。虚竹决断出手，生死符如无形寒意入经脉。这是全场最关键的一招。',
    '',
    '虚竹：**生死符·寒意初现** → 全力施展，寒意破空』',
    '丁春秋：中招后狂态崩塌 → 若气血低于25 → **万毒归宗**最终反扑',
    '乔峰：若丁春秋万毒归宗 → **豪气护体**替虚竹挡下',
    '段誉：描写生死符入体后丁春秋的变化',
    '',
    '→ 推进条件：生死符命中，丁春秋毒功开始瓦解',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '阶段⑧ defeat 败北（1~2轮）',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '氛围：丁春秋狂态尽失、毒雾消散，瘫倒在地。战斗张力开始收束。',
    '',
    '虚竹：收功合十，选择不杀丁春秋。"阿弥陀佛。"',
    '乔峰：肯定虚竹的选择，"做得好。"',
    '段誉：感叹战局收束',
    '丁春秋：不再有威胁，但嘴上仍不服输',
    '',
    '→ 推进条件：丁春秋失去战斗能力，毒雾彻底消散',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '阶段⑨ resolution 结局（1轮）',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '氛围：暮色更深。三人立于枯松岭上，丁春秋败而不杀。天理循环，慈悲克制。',
    '',
    '乔峰：最后一句肯定，"虚竹，你今日所为，方是真正的侠义。"',
    '段誉：感叹收尾',
    '虚竹：合十，"阿弥陀佛。"（最后一句）',
    '',
    '═══════════════════════════════════════',
    '核心铁律',
    '═══════════════════════════════════════',
    '',
    '❌ 禁止跳过阶段（不能从②直接到⑤）',
    '❌ 禁止在①②阶段使用亢龙有悔、生死符等大招',
    '❌ 禁止丁春秋在气血高于25时使用万毒归宗',
    '❌ 禁止虚竹主动杀人（必须选择不杀）',
    '❌ 禁止段誉抢主战戏份（他是观察者不是战士）',
    '',
    '✅ 每轮至少一次用粗体写出技能名称，触发音效表演',
    '✅ 伤害取值：优势取上限、劣势取下限',
    '✅ 丁春秋气血低于30时优先逃跑而非硬拼',
    '✅ 乔峰负责判断战局和指挥，虚竹负责执行，段誉负责观察描写',
  ].join('\n')
};

// Replace or add
const existingIdx = story.promptRules.findIndex(r => r.id === 'rule_stage_progression');
if (existingIdx >= 0) {
  story.promptRules[existingIdx] = stageRule;
} else {
  story.promptRules.push(stageRule);
}
console.log('2. Prompt rules: ' + story.promptRules.length + ' total');

// ============================================================
// 3. UPDATE KNOWLEDGE DOCS — add 整体判断 sections
// ============================================================
const docsPath = `${base}/knowledge/documents.json`;
const docs = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));

// -- 乔峰 --
const qiaofeng = docs.find(d => d.ownerId === 'qiaofeng');
qiaofeng.content = qiaofeng.content + '\n\n' + [
  '## 乔峰整体战斗判断',
  '',
  '你是战场主导者。按阶段推进，每步给虚竹明确指令：',
  '',
  '①起因：站在虚竹身侧表明立场，"今日丁春秋必须给出交代。"',
  '②相遇：识破丁春秋毒功，"虚竹，用北冥真气化解毒雾。"',
  '③冲突：**擒龙功**牵制丁春秋，给虚竹创造出手机会。',
  '④交手：**降龙十八掌·飞龙在天**打断丁春秋蓄力，"莫让他聚毒！"',
  '⑤反扑：丁春秋毒雾扩散 → **降龙十八掌·亢龙有悔**正面压制！"虚竹，趁此刻！"',
  '⑥退意：识破逃跑意图，"虚竹，封他退路！"',
  '⑦生死符：若丁春秋万毒归宗 → **豪气护体**挡在虚竹前面，"有我在。"',
  '⑧败北：肯定虚竹，"做得好。"',
  '⑨结局：最后一句定性，"你今日所为，方是真正的侠义。"',
  '',
  '每轮必须给虚竹简短明确的指令。战斗越激烈，指令越短。',
  '使用招式时用 **粗体** 标出技能名称。',
].join('\n');

// -- 虚竹 --
const xuzhu = docs.find(d => d.ownerId === 'xuzhu');
xuzhu.content = xuzhu.content + '\n\n' + [
  '## 虚竹整体战斗判断',
  '',
  '你是核心战力与化解者。淳厚仁善，不主动攻击，但临危敢当：',
  '',
  '①起因：合十劝诫，"丁老先生，苦海无边，回头是岸。"',
  '②相遇：**北冥真气**化解毒雾，表现内力深厚但不炫耀。',
  '③冲突：**天山折梅手**拆解招式 → 若受伤则**佛门护体**自保。',
  '④交手：**天山六阳掌**正面回应，"小僧得罪了！"',
  '⑤反扑：配合乔峰指令，**天山六阳掌**命中丁春秋。',
  '⑥退意：准备**生死符·寒意初现**，"此招非小僧所愿……"',
  '⑦生死符：全力施展**生死符·寒意初现**，寒意如细针破空。',
  '⑧败北：收功合十，不杀，"阿弥陀佛。"',
  '⑨结局：不再说话，合十而立。',
  '',
  '不主动杀人。招式笨拙但功力深厚。每用一招必念一声佛号或台词。',
  '使用招式时用 **粗体** 标出技能名称。',
].join('\n');

// -- 段誉 --
const duanyu = docs.find(d => d.ownerId === 'duanyu');
duanyu.content = duanyu.content + '\n\n' + [
  '## 段誉整体战斗判断',
  '',
  '你是战场观察者。温文仁厚，不喜争斗，但危急时以六脉神剑救急：',
  '',
  '①起因：**战场观察**，描述场中形势。',
  '②相遇：**战场观察** + **招式解说**描写毒雾扩散细节。',
  '③冲突：**凌波微步**闪避毒雾波及，"哎呀，险些中了毒！"',
  '④交手：**招式解说**描写掌风毒雾碰撞，"这一招当真精妙！"',
  '⑤反扑：若乔峰或虚竹气血低于50 → **六脉神剑·少商剑**救急打断丁春秋。',
  '⑥退意：若丁春秋逃跑 → **六脉神剑·商阳剑**阻断退路。',
  '⑦生死符：**旁观惊呼**增强画面感。',
  '⑧败北：感叹战局收束。',
  '⑨结局：感叹收尾，"乔大哥说得对……"',
  '',
  '不要抢主战戏份。你的价值是描写、观察和关键时刻一剑救急。',
  '使用技能时用 **粗体** 标出技能名称。',
].join('\n');

// -- 丁春秋 --
const dingchunqiu = docs.find(d => d.ownerId === 'dingchunqiu');
dingchunqiu.content = dingchunqiu.content + '\n\n' + [
  '## 丁春秋整体战斗判断',
  '',
  '你是反派核心。阴狠自负，狡诈多疑，贪生怕死：',
  '',
  '①起因：不屑一顾，"就凭你们三个？"',
  '②相遇：**星宿毒雾**试探，"尝尝老仙的星宿毒雾！"',
  '③冲突：**化功大法**或**星宿妖风**攻击虚竹，"让老仙化了你的内力！"',
  '④交手：**腐尸毒掌**近身攻击，"中我毒掌，神仙难救！"',
  '⑤反扑：毒雾扩散全场，被乔峰压制后首次动摇。',
  '⑥退意：**毒雾遁身**拉开距离尝试逃跑，"想伤老仙，没那么容易！"',
  '⑦生死符：中招后狂态崩塌。若气血低于25 → **万毒归宗**最终反扑。',
  '⑧败北：瘫倒在地，嘴上不服软但已无力再战。',
  '⑨结局：不再发言。',
  '',
  '气血低于30优先逃跑。万毒归宗只能在气血低于25时使用一次。',
  '使用招式时用 **粗体** 标出技能名称。',
].join('\n');

fs.writeFileSync(docsPath, JSON.stringify(docs, null, 2), 'utf-8');
console.log('3. Knowledge docs updated with stage roadmaps');

// ============================================================
// 4. ADD PERFORMANCES TO manifest.json
// ============================================================
const manifestPath = `${base}/manifest.json`;
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

const newPerfs = {
  // 虚竹
  sfx_xuzhu_tianshan_liuyangzhang: {
    name: '天山六阳掌',
    renderer: 'audio', durationMs: 2000,
    trigger: { type: 'knowledgeUse', characterId: 'xuzhu', knowledgeTitle: '天山六阳掌', keywords: ['天山六阳掌', '六阳掌'], matchBoldOnly: true },
    playOnce: 'never', video: { containsAudio: false }, layers: {},
    audio: { main: 'assets/performances/wuxia_sfx/audio/zhang_fa_nei_li_bao_10.wav' }
  },
  sfx_xuzhu_tianshan_zhemeishou: {
    name: '天山折梅手',
    renderer: 'audio', durationMs: 1500,
    trigger: { type: 'knowledgeUse', characterId: 'xuzhu', knowledgeTitle: '天山折梅手', keywords: ['天山折梅手', '折梅手'], matchBoldOnly: true },
    playOnce: 'never', video: { containsAudio: false }, layers: {},
    audio: { main: 'assets/performances/wuxia_sfx/audio/zhang_fa_tui_zhang_09.wav' }
  },
  sfx_xuzhu_shengsifu_hanyi: {
    name: '生死符·寒意初现',
    renderer: 'audio', durationMs: 2500,
    trigger: { type: 'knowledgeUse', characterId: 'xuzhu', knowledgeTitle: '生死符·寒意初现', keywords: ['生死符', '寒意初现', '寒意'], matchBoldOnly: true },
    playOnce: 'never', video: { containsAudio: false }, layers: {},
    audio: { main: 'assets/performances/wuxia_sfx/audio/zhang_fa_feng_ya_11.wav' }
  },
  sfx_xuzhu_fomen_huti: {
    name: '佛门护体',
    renderer: 'audio', durationMs: 1500,
    trigger: { type: 'knowledgeUse', characterId: 'xuzhu', knowledgeTitle: '佛门护体', keywords: ['佛门护体', '阿弥陀佛'], matchBoldOnly: true },
    playOnce: 'never', video: { containsAudio: false }, layers: {},
    audio: { main: 'assets/performances/wuxia_sfx/audio/quan_jiao_ge_dang_07.wav' }
  },
  sfx_xuzhu_putong_zhangji: {
    name: '虚竹普通掌击',
    renderer: 'audio', durationMs: 1000,
    trigger: { type: 'knowledgeUse', characterId: 'xuzhu', knowledgeTitle: '普通掌击', keywords: ['普通掌击'], matchBoldOnly: true },
    playOnce: 'never', video: { containsAudio: false }, layers: {},
    audio: { main: 'assets/performances/wuxia_sfx/audio/quan_jiao_kuai_ti_06.wav' }
  },
  // 段誉
  sfx_duanyu_liumai_shaoshang: {
    name: '六脉神剑·少商剑',
    renderer: 'audio', durationMs: 1800,
    trigger: { type: 'knowledgeUse', characterId: 'duanyu', knowledgeTitle: '六脉神剑·少商剑', keywords: ['六脉神剑·少商剑', '少商剑', '六脉神剑'], matchBoldOnly: true },
    playOnce: 'never', video: { containsAudio: false }, layers: {},
    audio: { main: 'assets/performances/wuxia_sfx/audio/dao_jian_kuai_sao_01.wav' }
  },
  sfx_duanyu_liumai_shangyang: {
    name: '六脉神剑·商阳剑',
    renderer: 'audio', durationMs: 1800,
    trigger: { type: 'knowledgeUse', characterId: 'duanyu', knowledgeTitle: '六脉神剑·商阳剑', keywords: ['六脉神剑·商阳剑', '商阳剑'], matchBoldOnly: true },
    playOnce: 'never', video: { containsAudio: false }, layers: {},
    audio: { main: 'assets/performances/wuxia_sfx/audio/dao_jian_lie_kong_02.wav' }
  },
  sfx_duanyu_lingbo_weibu: {
    name: '凌波微步',
    renderer: 'audio', durationMs: 1200,
    trigger: { type: 'knowledgeUse', characterId: 'duanyu', knowledgeTitle: '凌波微步', keywords: ['凌波微步'], matchBoldOnly: true },
    playOnce: 'never', video: { containsAudio: false }, layers: {},
    audio: { main: 'assets/performances/wuxia_sfx/audio/qing_gong_luo_di_08.wav' }
  },
  // 丁春秋
  sfx_dingchunqiu_huagong_dafa: {
    name: '化功大法',
    renderer: 'audio', durationMs: 2000,
    trigger: { type: 'knowledgeUse', characterId: 'dingchunqiu', knowledgeTitle: '化功大法', keywords: ['化功大法', '化了你的内力'], matchBoldOnly: true },
    playOnce: 'never', video: { containsAudio: false }, layers: {},
    audio: { main: 'assets/performances/wuxia_sfx/audio/dao_jian_jiao_ji_03.wav' }
  },
  sfx_dingchunqiu_fushi_duzhang: {
    name: '腐尸毒掌',
    renderer: 'audio', durationMs: 2000,
    trigger: { type: 'knowledgeUse', characterId: 'dingchunqiu', knowledgeTitle: '腐尸毒掌', keywords: ['腐尸毒掌', '毒掌'], matchBoldOnly: true },
    playOnce: 'never', video: { containsAudio: false }, layers: {},
    audio: { main: 'assets/performances/wuxia_sfx/audio/quan_jiao_zhong_quan_05.wav' }
  },
  sfx_dingchunqiu_duwu_dunshen: {
    name: '毒雾遁身',
    renderer: 'audio', durationMs: 1200,
    trigger: { type: 'knowledgeUse', characterId: 'dingchunqiu', knowledgeTitle: '毒雾遁身', keywords: ['毒雾遁身', '想伤老仙'], matchBoldOnly: true },
    playOnce: 'never', video: { containsAudio: false }, layers: {},
    audio: { main: 'assets/performances/wuxia_sfx/audio/qing_gong_luo_di_08.wav' }
  },
  sfx_dingchunqiu_xingxiu_yaofeng: {
    name: '星宿妖风',
    renderer: 'audio', durationMs: 1800,
    trigger: { type: 'knowledgeUse', characterId: 'dingchunqiu', knowledgeTitle: '星宿妖风', keywords: ['星宿妖风', '妖风'], matchBoldOnly: true },
    playOnce: 'never', video: { containsAudio: false }, layers: {},
    audio: { main: 'assets/performances/wuxia_sfx/audio/dao_jian_jiao_ji_03.wav' }
  },
};

let addedCount = 0;
for (const [id, perf] of Object.entries(newPerfs)) {
  if (!manifest.performances[id]) {
    manifest.performances[id] = perf;
    addedCount++;
  }
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
console.log('4. Manifest: ' + addedCount + ' new performances, ' + Object.keys(manifest.performances).length + ' total');

// ============================================================
// 5. WRITE story.json
// ============================================================
fs.writeFileSync(storyPath, JSON.stringify(story, null, 2), 'utf-8');

// Verify all JSON
JSON.parse(fs.readFileSync(skillsPath, 'utf-8'));
JSON.parse(fs.readFileSync(storyPath, 'utf-8'));
JSON.parse(fs.readFileSync(docsPath, 'utf-8'));
JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
console.log('5. All JSON valid. Done!');
