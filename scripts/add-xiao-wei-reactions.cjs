const fs = require('fs');
const docsPath = './apps/data/task-packages/story_sSw0IetszN/knowledge/documents.json';
const docs = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));

function addReaction(content, sectionName, reactionText) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('(## ' + escaped + '[\\s\\S]*?)(- 输出要求)', 'm');
  if (regex.test(content)) {
    return content.replace(regex, '$1- 小薇反应：' + reactionText + '\n$2');
  }
  const regex2 = new RegExp('(## ' + escaped + '[\\s\\S]*?)(- 台词)', 'm');
  if (regex2.test(content)) {
    return content.replace(regex2, '$1- 小薇反应：' + reactionText + '\n$2');
  }
  console.log('  WARN: no match for', sectionName);
  return content;
}

// ===== 大姐 =====
let daJie = docs.find(d => d.ownerId === 'da_jie');
const daJieReactions = [
  ['精密M字吊缚术', '被捆绑时出现**傲娇激烈反抗**，剧烈挣扎扭动身体并大声抗议。'],
  ['高浓度媚药涂抹术', '抹药后身体迅速发烫变红，出现**媚药敏感潮红反应**，淫水大量分泌。'],
  ['乳房吸吮与乳环调教', '乳头被吸舔夹弄后肿胀敏感，出现**乳头乳环崩溃反应**，全身猛颤。'],
  ['阴部专业按摩指技', '阴部被精准刺激，快感急剧累积进入**高潮边缘极限挣扎**，身体弓起颤抖。'],
  ['极慢脉动抽插术', '长时间慢速折磨下**小薇求饶**不断，反复推至**高潮边缘极限挣扎**。'],
  ['多道具同步调教', '全身感官过载，出现**小薇尖叫**和**小薇身体痉挛**，精神濒临崩溃。'],
  ['心理边缘控制与剧情推动', '心理防线被精准瓦解，出现**小薇哭泣**，意志动摇崩溃。'],
  ['最终交接宣言', '彻底放弃抵抗，表现出**彻底屈服肉便器模式**，主动接受任何处置。'],
];
for (const [section, reaction] of daJieReactions) {
  console.log('大姐:', section);
  daJie.content = addReaction(daJie.content, section, reaction);
}

// ===== 二姐 =====
let erJie = docs.find(d => d.ownerId === 'er_jie');
const erJieReactions = [
  ['温柔压制辅助捆绑', '被压制时出现**傲娇激烈反抗**，试图挣脱束缚。'],
  ['实时状态观察与汇报', '被详细描述身体反应时羞耻加剧，出现**小薇哭泣**。'],
  ['道具递送与安装专家', '多道具安装刺激下出现**小薇求饶**和**小薇身体痉挛**。'],
  ['甜软言语劝降术', '被甜软羞耻言语攻心，出现**言语攻心心理崩坏**，哭着说淫荡话语。'],
  ['多点位辅助刺激', '多点位协同刺激下身体不受控制，出现**小薇身体痉挛**。'],
  ['情绪安抚与反差攻心', '温柔与羞耻的巨大反差下，出现**小薇哭泣**和**小薇求饶**。'],
  ['高潮边缘观察与预警', '被反复保持在边缘状态，出现**高潮边缘极限挣扎**。'],
  ['调教成果交接', '最终见证下彻底崩坏，表现出**彻底屈服肉便器模式**。'],
];
for (const [section, reaction] of erJieReactions) {
  console.log('二姐:', section);
  erJie.content = addReaction(erJie.content, section, reaction);
}

// ===== 少爷 (仅最终征服抽插) =====
let shaoYe = docs.find(d => d.ownerId === 'shao_ye');
const shaoYeReactions = [
  ['最终征服抽插（少爷专属）', '少爷亲自抽插下**小薇高潮**不断、**小薇失神**翻白眼、**小薇连续高潮**直至瘫软虚脱。'],
];
for (const [section, reaction] of shaoYeReactions) {
  console.log('少爷:', section);
  shaoYe.content = addReaction(shaoYe.content, section, reaction);
}

fs.writeFileSync(docsPath, JSON.stringify(docs, null, 2), 'utf-8');
console.log('Done!');
