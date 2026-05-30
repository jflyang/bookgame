/**
 * Rebuild flow.json linearPhases with narrative-aware grouping.
 * Run this after unique_stage_ids.cjs to fix the flow structure.
 *
 *   node scripts/rebuild_flow_structure.cjs
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "../../data/task-packages");

// ═══ Mirrors flowSync.ts rebuildFlowFromModules logic ═══

function rebuildForPackage(pkgDir) {
  const scenarioPath = path.join(pkgDir, "scenario.json");
  const flowPath = path.join(pkgDir, "flow.json");
  if (!fs.existsSync(scenarioPath) || !fs.existsSync(flowPath)) return;

  const scenario = JSON.parse(fs.readFileSync(scenarioPath, "utf-8"));
  const flow = JSON.parse(fs.readFileSync(flowPath, "utf-8"));
  const modules = flow.modules || [];
  const details = scenario.stageDetails || [];

  // Build stageId → (sortKey, stageType) lookup
  const stageInfo = new Map();
  for (const d of details) {
    stageInfo.set(d.id, { sortKey: d.sortKey ?? 9999, stageType: d.stageType });
  }

  // Sort modules by sortKey
  const sorted = [...modules].sort((a, b) => {
    const ka = stageInfo.get(a.sourceStage)?.sortKey ?? 9999;
    const kb = stageInfo.get(b.sourceStage)?.sortKey ?? 9999;
    return ka - kb;
  });

  // Effective type scanning (choice sub-stages inherit parent type)
  const blocks = [];
  let seenBranchPoint = false;
  let effectiveType = "training";

  for (const mod of sorted) {
    const info = stageInfo.get(mod.sourceStage);
    const rawType = info?.stageType || mod.type;

    let newEffectiveType = effectiveType;
    if (rawType === "choice") {
      if (!seenBranchPoint) { newEffectiveType = "choice"; seenBranchPoint = true; }
    } else if (rawType === "training") { newEffectiveType = "training"; }
    else if (rawType === "serving") { newEffectiveType = "serving"; }
    else if (rawType === "punishment") { newEffectiveType = "punishment"; }
    else if (rawType === "daily") { newEffectiveType = "daily"; }
    else if (rawType === "event" || rawType === "finale") { newEffectiveType = "finale"; }

    if (newEffectiveType !== effectiveType) effectiveType = newEffectiveType;

    const last = blocks[blocks.length - 1];
    if (!last || last.key !== effectiveType) blocks.push({ key: effectiveType, modules: [] });
    blocks[blocks.length - 1].modules.push(mod.id);
  }

  // Assign narrative role names
  const ROLE_TITLES = {
    capture: "捕获调教", branch_point: "⚡ 命运抉择",
    branch_obey: "分支A · 服从路线", branch_resist: "分支B · 抵抗路线",
    convergence: "初次征服", daily: "日常", finale: "终幕",
  };

  let servingAfter = 0, punishmentAfter = 0;
  for (const block of blocks) {
    if (block.key === "training") block.key = "capture";
    else if (block.key === "choice") block.key = "branch_point";
    else if (block.key === "serving") { servingAfter++; block.key = servingAfter === 1 ? "branch_obey" : "convergence"; }
    else if (block.key === "punishment") { punishmentAfter++; block.key = punishmentAfter === 1 ? "branch_resist" : "convergence"; }
    block.title = ROLE_TITLES[block.key] || block.key;
  }

  // Daily stays in main flow; only finale is separated
  const mainBlocks = blocks.filter(b => b.key !== "finale");
  const finaleMods = blocks.filter(b => b.key === "finale").flatMap(b => b.modules);

  // Build linearPhases
  const linearPhases = {};
  for (let i = 0; i < mainBlocks.length; i++) {
    const b = mainBlocks[i];
    let afterAll;
    if (b.key === "branch_point") { afterAll = undefined; }
    else if (b.key === "branch_obey" || b.key === "branch_resist") {
      const conv = mainBlocks.find(x => x.key === "convergence");
      afterAll = conv ? "convergence" : undefined;
    } else {
      afterAll = mainBlocks[i + 1] ? mainBlocks[i + 1].key : undefined;
    }
    linearPhases[b.key] = { title: b.title, sequence: b.modules, ...(afterAll ? { afterAll } : {}) };
  }

  // Update flow.json
  flow.linearPhases = linearPhases;
  flow.finaleSequence = finaleMods.length > 0
    ? { title: "终幕", sequence: finaleMods, description: "" }
    : flow.finaleSequence;
  flow.dailySystem = undefined;  // daily now flows in linearPhases
  delete flow.nodes;
  delete flow.edges;
  flow.modules = modules;

  fs.writeFileSync(flowPath, JSON.stringify(flow, null, 2), "utf-8");

  // Summary
  let total = 0;
  for (const p of Object.values(linearPhases)) total += p.sequence.length;
  console.log(`  ${path.basename(pkgDir)}: ${total} linear + ${finaleMods.length} finale = ${total + finaleMods.length} total`);
}

// ═══ Main ═══
console.log("🔧 Rebuilding flow structures...\n");

for (const entry of fs.readdirSync(DATA_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.includes("_backup")) continue;
  rebuildForPackage(path.join(DATA_DIR, entry.name));
}

console.log("\n✅ Done. Restart the editor server.");
