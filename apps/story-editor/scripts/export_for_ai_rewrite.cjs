/**
 * export_for_ai_rewrite.cjs
 * 
 * 导出当前故事包的模块结构为 Markdown 文档，供 Claude Code 重写模块细节。
 * 
 * 用法：
 *   node scripts/export_for_ai_rewrite.cjs <故事包目录路径> [输出文件路径]
 * 
 * 示例：
 *   node scripts/export_for_ai_rewrite.cjs ../../data/task-packages/story_sSw0IetszN
 *   node scripts/export_for_ai_rewrite.cjs ../../data/task-packages/story_sSw0IetszN ./rewrite-task.md
 */

const fs = require("fs");
const path = require("path");

const packageDir = process.argv[2];
if (!packageDir) {
  console.error("用法: node scripts/export_for_ai_rewrite.cjs <故事包目录路径> [输出文件]");
  process.exit(1);
}

const resolvedDir = path.resolve(packageDir);

// Read package files
function readJSON(file) {
  const p = path.join(resolvedDir, file);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

const pkg = readJSON("package.json");
const outputFile = process.argv[3] || path.join(resolvedDir, `${(pkg?.title || "故事包").replace(/[\\/:*?"<>|]/g, "_")}-重写任务.md`);
const scenario = readJSON("scenario.json");
const flow = readJSON("flow.json");
const characters = readJSON("characters.json");
const setting = fs.existsSync(path.join(resolvedDir, "setting.md"))
  ? fs.readFileSync(path.join(resolvedDir, "setting.md"), "utf-8")
  : "";

// Determine module order from flow.json
let modules = [];
if (flow && flow.nodes) {
  // ReactFlow format — extract modules from nodes
  const nodes = flow.nodes;
  const groups = nodes.filter(n => n.type === "phaseGroup");
  
  groups.forEach(g => {
    const children = nodes
      .filter(n => n.parentId === g.id && (n.type === "module" || n.type === "choice"))
      .sort((a, b) => a.position.x - b.position.x);
    
    children.forEach(child => {
      modules.push({
        actKey: g.data.actKey || g.id,
        actLabel: g.data.label || g.data.actKey || g.id,
        nodeId: child.id,
        moduleRef: child.data.moduleRef || "",
        label: child.data.label || "",
        colorKey: child.data.colorKey || "",
        moduleData: child.data.moduleData || null,
      });
    });
  });
} else if (flow && flow.linearPhases) {
  // FlowDefinition format
  for (const [actKey, phase] of Object.entries(flow.linearPhases)) {
    const seq = phase.sequence || [];
    seq.forEach(modId => {
      modules.push({ actKey, actLabel: phase.title || actKey, moduleRef: modId, label: modId, colorKey: "", moduleData: null });
    });
  }
}

// Also read modules.json for full module data
const modulesFile = readJSON("modules.json");
const moduleMap = new Map();
if (modulesFile && Array.isArray(modulesFile)) {
  modulesFile.forEach(m => moduleMap.set(m.id, m));
}

// Build output
let md = `# AI 重写任务：${pkg?.title || "故事包"}\n\n`;
md += `> 本文档由 \`export_for_ai_rewrite.cjs\` 自动生成\n`;
md += `> 故事包路径: \`${resolvedDir}\`\n`;
md += `> 生成时间: ${new Date().toISOString()}\n\n`;

md += `---\n\n## 故事设定\n\n`;
if (setting) {
  md += setting + "\n\n";
} else {
  md += "(无 setting.md)\n\n";
}

md += `---\n\n## 角色列表\n\n`;
if (characters && characters.length > 0) {
  characters.forEach(c => {
    md += `### ${c.name} (${c.role})\n\n`;
    if (c.personaPrompt) md += `**人设提示词**:\n\`\`\`\n${c.personaPrompt}\n\`\`\`\n\n`;
  });
} else {
  md += "(无角色数据)\n\n";
}

md += `\n---\n\n## 当前模块顺序（按流程执行顺序）\n\n`;
md += `以下是重排后的模块顺序。**标题和顺序是正确的**，但 guidance/description/enterWhen/exitCondition 等内部细节可能需要根据新的前后文关系重写。\n\n`;

let currentAct = "";
modules.forEach((m, i) => {
  if (m.actLabel !== currentAct) {
    currentAct = m.actLabel;
    md += `\n### 📁 ${currentAct}\n\n`;
  }
  
  const fullMod = moduleMap.get(m.moduleRef) || m.moduleData || {};
  md += `#### ${i + 1}. ${m.label || fullMod.title || m.moduleRef}\n\n`;
  md += `- **模块ID**: \`${m.moduleRef || m.nodeId}\`\n`;
  md += `- **类型**: ${m.colorKey || fullMod.type || "training"}\n`;
  if (fullMod.sourceStage) md += `- **来源阶段**: \`${fullMod.sourceStage}\`\n`;
  if (fullMod.enterWhen) md += `- **进入条件**: ${fullMod.enterWhen}\n`;
  if (fullMod.exitCondition) md += `- **退出条件**: ${fullMod.exitCondition}\n`;
  if (fullMod.directive) md += `- **强制指令 (directive)**: ${fullMod.directive}\n`;
  md += `\n`;
  
  if (fullMod.description) {
    md += `**描述**:\n${fullMod.description}\n\n`;
  }
  if (fullMod.guidance) {
    md += `**AI 引导语 (guidance)**:\n\`\`\`\n${fullMod.guidance}\n\`\`\`\n\n`;
  }
  md += `---\n\n`;
});

// Scenario stage details (for reference)
if (scenario && scenario.stageDetails && scenario.stageDetails.length > 0) {
  md += `\n## 参考：Scenario 阶段详情\n\n`;
  scenario.stageDetails.forEach(s => {
    md += `### ${s.id}: ${s.title || "(无标题)"}\n\n`;
    if (s.enterWhen) md += `- **进入条件**: ${s.enterWhen}\n`;
    if (s.isChoicePoint) md += `- **✦ 抉择点**\n`;
    if (s.directive) md += `- **强制指令**: ${s.directive}\n`;
    if (s.guidance) md += `\n**引导语**:\n\`\`\`\n${s.guidance}\n\`\`\`\n`;
    if (s.branches && s.branches.length > 0) {
      md += `\n**分支**:\n`;
      s.branches.forEach((b, bi) => {
        md += `  ${bi + 1}. ${b.choiceText || "选项"} → ${b.targetStage || "?"}\n`;
      });
    }
    md += `\n`;
  });
}

md += `\n---\n\n## 操作指令\n\n`;
md += `请根据上面的模块顺序，为每个模块重写以下字段：\n\n`;
md += `1. **guidance** — AI 引导语（最重要）：描述此阶段的具体剧情走向、角色行为、氛围、推进条件\n`;
md += `2. **description** — 模块描述：简短说明此阶段的核心事件\n`;
md += `3. **enterWhen** — 进入条件：从上一个模块过渡到此模块的叙事条件\n`;
md += `4. **exitCondition** — 退出条件：此模块可以结束的叙事条件\n\n`;
md += `### 重写原则\n\n`;
md += `- **只修改不符合当前时间线/顺序逻辑的地方，其他内容保持原样不动**\n`;
md += `- 如果某个模块的 guidance/description/enterWhen/exitCondition 在新顺序下仍然合理，则完全保留原文\n`;
md += `- 只调整因为前后模块变化而导致衔接不通顺的部分\n`;
md += `- 保持模块标题不变\n`;
md += `- 保持整体叙事风格和用词习惯不变\n\n`;
md += `### 输出要求\n\n`;
md += `将重写结果保存到桌面：\n\n`;
md += `\`\`\`\nC:\\Users\\Administrator\\Desktop\\modules_rewritten.json\n\`\`\`\n\n`;
md += `**不要覆盖原文件**。用户会通过编辑器的"导入modules"功能手动导入。\n\n`;
md += `文件内容为完整的 modules JSON 数组，保留所有原有字段（id、title、type、sourceStage、reusable 等），只更新需要调整的 guidance、description、enterWhen、exitCondition。\n\n`;
md += `### 输出格式\n\n`;
md += `\`\`\`json\n[\n  {\n    "id": "mod_xxxxxxxxxx",\n    "sourceStage": "stage_xxx",\n    "title": "保持原标题不变",\n    "type": "training",\n    "reusable": false,\n    "description": "重写后的描述...",\n    "guidance": "重写后的引导语...",\n    "enterWhen": "重写后的进入条件...",\n    "exitCondition": "重写后的退出条件..."\n  },\n  ...\n]\n\`\`\`\n`;

fs.writeFileSync(outputFile, md, "utf-8");
console.log(`✅ 导出完成: ${outputFile}`);
console.log(`   模块数量: ${modules.length}`);
console.log(`   角色数量: ${characters?.length || 0}`);
console.log(`\n下一步: 把此文件喂给 Claude Code，让它重写模块细节。`);
