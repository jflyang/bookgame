const fs = require('fs');
const path = require('path');

const pkgDir = process.argv[2];
if (!pkgDir) {
  console.error('Usage: node migrate_v2_to_v3.cjs <story-package-dir>');
  process.exit(1);
}

const dir = path.resolve(pkgDir);
if (!fs.existsSync(path.join(dir, 'story.json'))) {
  console.error('story.json not found — already V3 or not a story package');
  process.exit(1);
}

console.log('Migrating:', dir);

// ═══ Read V2 files ═══
const story = JSON.parse(fs.readFileSync(path.join(dir, 'story.json'), 'utf-8'));

// ═══ 1. package.json ═══
const pkg = {
  schemaVersion: "3",
  id: story.id,
  title: story.title,
  description: story.description || "",
  createdAt: story.createdAt || new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2), 'utf-8');
console.log('  ✓ package.json');

// ═══ 2. scenario.json ═══
if (story.scenario) {
  fs.writeFileSync(path.join(dir, 'scenario.json'), JSON.stringify(story.scenario, null, 2), 'utf-8');
  console.log('  ✓ scenario.json');
}

// ═══ 3. characters.json ═══
if (fs.existsSync(path.join(dir, 'characters.json'))) {
  const chars = JSON.parse(fs.readFileSync(path.join(dir, 'characters.json'), 'utf-8'));
  // Remove combat fields
  const cleaned = chars.map(c => {
    const { rules, knowledgeBaseIds, attackableTargetIds, ...rest } = c;
    return { ...rest, rules: [], knowledgeBaseIds: [], attackableTargetIds: [] };
  });
  fs.writeFileSync(path.join(dir, 'characters.json'), JSON.stringify(cleaned, null, 2), 'utf-8');
  console.log('  ✓ characters.json');
}

// ═══ 4. flow.json ═══
if (story.flow || fs.existsSync(path.join(dir, 'flow.json'))) {
  let flowData = story.flow || {};
  // Merge with existing flow.json if present
  if (fs.existsSync(path.join(dir, 'flow.json'))) {
    const existingFlow = JSON.parse(fs.readFileSync(path.join(dir, 'flow.json'), 'utf-8'));
    flowData = { ...flowData, ...existingFlow };
  }
  // Include modules
  if (story.modules) flowData.modules = story.modules;
  else if (fs.existsSync(path.join(dir, 'modules.json'))) {
    flowData.modules = JSON.parse(fs.readFileSync(path.join(dir, 'modules.json'), 'utf-8'));
  }
  fs.writeFileSync(path.join(dir, 'flow.json'), JSON.stringify(flowData, null, 2), 'utf-8');
  console.log('  ✓ flow.json');
}

// ═══ 5. actions.json ═══
if (story.actions && story.actions.length > 0) {
  fs.writeFileSync(path.join(dir, 'actions.json'), JSON.stringify(story.actions, null, 2), 'utf-8');
  console.log('  ✓ actions.json (' + story.actions.length + ' actions)');
}

// ═══ 6. reactions.json ═══
if (story.reactions && story.reactions.length > 0) {
  fs.writeFileSync(path.join(dir, 'reactions.json'), JSON.stringify(story.reactions, null, 2), 'utf-8');
  console.log('  ✓ reactions.json (' + story.reactions.length + ' reactions)');
}

// ═══ 7. knowledge.json ═══
if (fs.existsSync(path.join(dir, 'knowledge', 'documents.json'))) {
  const docs = JSON.parse(fs.readFileSync(path.join(dir, 'knowledge', 'documents.json'), 'utf-8'));
  fs.writeFileSync(path.join(dir, 'knowledge.json'), JSON.stringify(docs, null, 2), 'utf-8');
  console.log('  ✓ knowledge.json');
}

// ═══ 8. rules.json ═══
if (fs.existsSync(path.join(dir, 'prompts', 'rules.json'))) {
  fs.copyFileSync(path.join(dir, 'prompts', 'rules.json'), path.join(dir, 'rules.json'));
  console.log('  ✓ rules.json');
}

// ═══ 9. setting.md ═══
if (fs.existsSync(path.join(dir, 'prompts', 'story-setting.md'))) {
  fs.copyFileSync(path.join(dir, 'prompts', 'story-setting.md'), path.join(dir, 'setting.md'));
  console.log('  ✓ setting.md');
} else if (story.storySettingPrompt) {
  fs.writeFileSync(path.join(dir, 'setting.md'), story.storySettingPrompt, 'utf-8');
  console.log('  ✓ setting.md (from story.json)');
}

// ═══ 10. manifest.json (simplify) ═══
if (fs.existsSync(path.join(dir, 'manifest.json'))) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf-8'));
  const simplified = {
    title: manifest.title || story.title,
    description: manifest.description || story.description,
    version: manifest.version || "3.0.0",
    performances: manifest.performances || {},
  };
  // Merge performances from story.manifest if present
  if (story.performances) {
    simplified.performances = { ...simplified.performances, ...story.performances };
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(simplified, null, 2), 'utf-8');
  console.log('  ✓ manifest.json (simplified)');
}

// ═══ 11. media/performances ═══
const oldAssets = path.join(dir, 'assets', 'performances');
const newMedia = path.join(dir, 'media', 'performances');
if (fs.existsSync(oldAssets) && !fs.existsSync(newMedia)) {
  fs.mkdirSync(path.join(dir, 'media'), { recursive: true });
  fs.renameSync(oldAssets, newMedia);
  console.log('  ✓ media/performances (renamed from assets/performances)');
} else if (!fs.existsSync(newMedia)) {
  fs.mkdirSync(newMedia, { recursive: true });
}

// ═══ 12. Cleanup V2 files ═══
const toRemove = [
  'story.json',
  'skills.json',
  'modules.json',
  'ui',
  'knowledge',
  'prompts',
  'assets',
];
for (const entry of toRemove) {
  const fullPath = path.join(dir, entry);
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log('  ✕ removed:', entry);
  }
}

console.log('\n✅ Migration complete! Package is now V3.');
console.log('   Schema version:', pkg.schemaVersion);
console.log('   Files:', fs.readdirSync(dir).filter(f => !f.startsWith('.')).join(', '));
