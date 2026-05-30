const fs = require('fs');
const rulesPath = 'C:/Users/Administrator/Documents/GitHub/game/apps/data/task-packages/story_a_CW69KOgU/prompts/rules.json';
const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));

// Remove combat relics
const cleaned = rules.filter(r =>
  !['rule_state_output', 'rule_history_state'].includes(r.id)
);

// Make rule_stage_progression generic
const stageRule = cleaned.find(r => r.id === 'rule_stage_progression');
if (stageRule) {
  stageRule.title = '剧情阶段推进规则';
  // Truncate old combat-specific content
  const cutoff = stageRule.content.indexOf('核心铁律');
  if (cutoff > 0) {
    stageRule.content = stageRule.content.slice(0, cutoff).trim();
  }
  // Replace with generic version
  stageRule.content = stageRule.content.replace(
    /本故事共\d+个阶段[。.]/,
    '本故事分为多个阶段，按顺序推进。'
  );
}

// Make knowledge_forcing generic
const knowRule = cleaned.find(r => r.id === 'rule_knowledge_forcing');
if (knowRule) {
  knowRule.title = '角色行动与反应使用规则';
  knowRule.content = `【角色行动与反应 — 必须使用】
你扮演的角色拥有特定的主动行动和被动反应，它们定义了角色的行为方式。
规则：
- 每次回复都应自然地融入角色可用的行动。
- 当角色受到特定行动影响时，表达出对应的被动反应。
- 不需要用户明确要求，你自然地运用这些行动来推动叙事。
- 回复中，凡是运用了角色行动或反应的内容，用 **粗体** 标出。`;
}

// Make group_chat_boundary generic
const groupRule = cleaned.find(r => r.id === 'rule_group_chat_boundary');
if (groupRule) {
  groupRule.title = '群聊边界规则';
}

// Make scenario_injection generic
const scenRule = cleaned.find(r => r.id === 'rule_scenario_injection');
if (scenRule) {
  scenRule.title = '剧情设定注入规则';
}

fs.writeFileSync(rulesPath, JSON.stringify(cleaned, null, 2), 'utf-8');
console.log('Rules cleaned:', cleaned.length, 'kept');
cleaned.forEach(r => console.log(' ', r.id.substring(0, 30).padEnd(32), r.title));
console.log('Done');
