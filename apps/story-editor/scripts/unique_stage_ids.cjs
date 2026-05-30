/**
 * Migrate all story packages to use globally unique stage IDs.
 *
 *   node scripts/unique_stage_ids.cjs
 *
 * - Replaces stage_1, stage_9a, stage_12a_b1, etc. with stage_XXXXXXXXXX
 * - Updates all references in scenario.json + flow.json
 * - Creates <name>_backup before modifying each package
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "../../data/task-packages");

function generateStageId() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "stage_";
  for (let i = 0; i < 10; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

/** Simple recursive copy for backup */
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function migratePackage(pkgDir) {
  const name = path.basename(pkgDir);
  if (name.includes("_backup")) return;

  const pkgJsonPath = path.join(pkgDir, "package.json");
  const scenarioPath = path.join(pkgDir, "scenario.json");
  const flowPath = path.join(pkgDir, "flow.json");

  if (!fs.existsSync(pkgJsonPath)) { console.log(`  SKIP ${name}: no package.json`); return; }
  if (!fs.existsSync(scenarioPath)) { console.log(`  SKIP ${name}: no scenario.json`); return; }

  console.log(`\n📦 ${name}`);

  // ── Backup ──
  const backupDir = pkgDir + "_backup";
  if (fs.existsSync(backupDir)) fs.rmSync(backupDir, { recursive: true, force: true });
  copyDirSync(pkgDir, backupDir);
  console.log("  ✓ backup created");

  // ── Read scenario ──
  const scenario = JSON.parse(fs.readFileSync(scenarioPath, "utf-8"));
  const oldStages = scenario.stages || [];
  if (oldStages.length === 0) { console.log("  SKIP: no stages"); return; }

  // ── Generate unique IDs ──
  const idMap = {}; // old_id → new_id
  for (const oldId of oldStages) {
    if (oldId.startsWith("stage_") && oldId.length < 20) {
      // Looks like a short local stage ID — needs replacement
      let newId;
      do { newId = generateStageId(); } while (Object.values(idMap).includes(newId));
      idMap[oldId] = newId;
    } else {
      // Already a long unique ID — keep it
      idMap[oldId] = oldId;
    }
  }
  console.log(`  ${Object.keys(idMap).filter(k => idMap[k] !== k).length} / ${oldStages.length} stages to rename`);

  if (Object.keys(idMap).every(k => idMap[k] === k)) {
    console.log("  ✓ already unique — no changes needed");
    return;
  }

  // ── Helper: replace all old stage IDs in a string ──
  function replaceInString(str) {
    if (typeof str !== "string") return str;
    let result = str;
    for (const [oldId, newId] of Object.entries(idMap)) {
      if (oldId === newId) continue;
      // Use global regex to replace all occurrences
      const escaped = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escaped, 'g'), newId);
    }
    return result;
  }

  // ── Update scenario.stages[] ──
  scenario.stages = oldStages.map(id => idMap[id] || id);
  console.log(`  ✓ scenario.stages updated`);

  // ── Update scenario.currentStage ──
  if (scenario.currentStage && idMap[scenario.currentStage]) {
    scenario.currentStage = idMap[scenario.currentStage];
    console.log(`  ✓ scenario.currentStage updated`);
  }

  // ── Update scenario.stageDetails[] ──
  const details = scenario.stageDetails || [];
  for (const detail of details) {
    if (idMap[detail.id] && idMap[detail.id] !== detail.id) {
      detail.id = idMap[detail.id];
    }
    // Set sortKey from index in stages array
    const idx = scenario.stages.indexOf(detail.id);
    if (idx >= 0) detail.sortKey = idx;

    // Update branches[].targetStage
    if (detail.branches) {
      for (const branch of detail.branches) {
        if (idMap[branch.targetStage] && idMap[branch.targetStage] !== branch.targetStage) {
          branch.targetStage = idMap[branch.targetStage];
        }
      }
    }

    // Update text fields that might reference stage IDs
    for (const field of ["description", "enterWhen", "guidance", "directive"]) {
      if (detail[field]) {
        detail[field] = replaceInString(detail[field]);
      }
    }
  }
  console.log(`  ✓ scenario.stageDetails updated`);

  // ── Update scenario text fields ──
  for (const field of ["premise", "currentGoal"]) {
    if (scenario[field]) {
      scenario[field] = replaceInString(scenario[field]);
    }
  }

  // ── Write scenario.json ──
  fs.writeFileSync(scenarioPath, JSON.stringify(scenario, null, 2), "utf-8");
  console.log("  ✓ scenario.json written");

  // ── Update flow.json ──
  if (!fs.existsSync(flowPath)) { console.log("  (no flow.json)"); return; }

  const flow = JSON.parse(fs.readFileSync(flowPath, "utf-8"));
  let flowChanged = false;

  // ═══ Build moduleIdMap BEFORE updating modules ═══
  // Maps old module IDs → new module IDs for sequence references
  const moduleIdMap = {};
  if (flow.modules) {
    for (const mod of flow.modules) {
      const oldModMatch = mod.id && mod.id.match(/^mod_(.+)$/);
      if (oldModMatch) {
        const stageIdInOldMod = oldModMatch[1];
        if (idMap[stageIdInOldMod] && idMap[stageIdInOldMod] !== stageIdInOldMod) {
          moduleIdMap["mod_" + stageIdInOldMod] = "mod_" + idMap[stageIdInOldMod];
        }
      }
    }
  }

  // modules[].sourceStage + modules[].id
  if (flow.modules) {
    for (const mod of flow.modules) {
      if (mod.sourceStage && idMap[mod.sourceStage] && idMap[mod.sourceStage] !== mod.sourceStage) {
        mod.sourceStage = idMap[mod.sourceStage];
        flowChanged = true;
      }

      // Update module ID: mod_<oldStageId> → mod_<newStageId>
      const oldModMatch = mod.id && mod.id.match(/^mod_(.+)$/);
      if (oldModMatch) {
        const oldStageId = oldModMatch[1];
        if (idMap[oldStageId] && idMap[oldStageId] !== oldStageId) {
          mod.id = "mod_" + idMap[oldStageId];
          flowChanged = true;
        }
      }

      // Update text fields in modules
      for (const field of ["title", "description", "guidance", "enterWhen", "exitCondition"]) {
        if (mod[field]) {
          const updated = replaceInString(mod[field]);
          if (updated !== mod[field]) { mod[field] = updated; flowChanged = true; }
        }
      }
    }
    console.log(`  ✓ flow.modules updated`);
  }

  // Update linearPhases.*.sequence[] — references module IDs
  if (flow.linearPhases) {
    for (const [phaseKey, phase] of Object.entries(flow.linearPhases)) {
      if (phase.sequence) {
        for (let i = 0; i < phase.sequence.length; i++) {
          const oldModId = phase.sequence[i];
          if (moduleIdMap[oldModId] && moduleIdMap[oldModId] !== oldModId) {
            phase.sequence[i] = moduleIdMap[oldModId];
            flowChanged = true;
          }
        }
      }
    }
    console.log(`  ✓ flow.linearPhases updated`);
  }

  // Update finaleSequence.sequence[]
  if (flow.finaleSequence?.sequence) {
    for (let i = 0; i < flow.finaleSequence.sequence.length; i++) {
      if (moduleIdMap[flow.finaleSequence.sequence[i]]) {
        flow.finaleSequence.sequence[i] = moduleIdMap[flow.finaleSequence.sequence[i]];
        flowChanged = true;
      }
    }
    console.log(`  ✓ flow.finaleSequence updated`);
  }

  // Update dailySystem
  if (flow.dailySystem) {
    if (flow.dailySystem.availableModules) {
      for (let i = 0; i < flow.dailySystem.availableModules.length; i++) {
        if (moduleIdMap[flow.dailySystem.availableModules[i]]) {
          flow.dailySystem.availableModules[i] = moduleIdMap[flow.dailySystem.availableModules[i]];
          flowChanged = true;
        }
      }
    }
    if (flow.dailySystem.triggerRules) {
      for (const rule of flow.dailySystem.triggerRules) {
        if (rule.module && moduleIdMap[rule.module]) {
          rule.module = moduleIdMap[rule.module];
          flowChanged = true;
        }
      }
    }
  }

  // Update flow.id / flow.title text
  if (flow.title) {
    const newTitle = replaceInString(flow.title);
    if (newTitle !== flow.title) { flow.title = newTitle; flowChanged = true; }
  }

  // ── Write flow.json ──
  // Remove stale nodes/edges (they reference old IDs — editor will regenerate)
  if (flow.nodes || flow.edges) {
    delete flow.nodes;
    delete flow.edges;
    flowChanged = true;
  }
  if (flowChanged) {
    fs.writeFileSync(flowPath, JSON.stringify(flow, null, 2), "utf-8");
    console.log("  ✓ flow.json written");
  } else {
    console.log("  (flow.json unchanged)");
  }

  // ── Update manifest.json (if has performance stageId refs) ──
  const manifestPath = path.join(pkgDir, "manifest.json");
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    let manifestChanged = false;
    const perfs = manifest.performances || {};
    for (const [key, p] of Object.entries(perfs)) {
      for (const t of (p.triggers || [])) {
        if (t.stageId && idMap[t.stageId] && idMap[t.stageId] !== t.stageId) {
          t.stageId = idMap[t.stageId];
          manifestChanged = true;
        }
      }
    }
    if (manifestChanged) {
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
      console.log("  ✓ manifest.json updated");
    }
  }
}

// ═══ Main ═══

console.log("🔑 Global Unique Stage ID Migration");
console.log(`   Data dir: ${DATA_DIR}\n`);

if (!fs.existsSync(DATA_DIR)) {
  console.error(`Data directory not found: ${DATA_DIR}`);
  process.exit(1);
}

const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
const dirs = entries.filter(e => e.isDirectory() && !e.name.includes("_backup"));

let migrated = 0;
let skipped = 0;

for (const entry of dirs) {
  const pkgDir = path.join(DATA_DIR, entry.name);
  try {
    const scenarioPath = path.join(pkgDir, "scenario.json");
    if (!fs.existsSync(scenarioPath)) {
      console.log(`  SKIP ${entry.name}: no scenario.json`);
      skipped++;
      continue;
    }
    const scenario = JSON.parse(fs.readFileSync(scenarioPath, "utf-8"));
    const oldStages = scenario.stages || [];
    const needsMigration = oldStages.some(s => s.startsWith("stage_") && s.length < 20);
    if (needsMigration) {
      migratePackage(pkgDir);
      migrated++;
    } else {
      console.log(`  SKIP ${entry.name}: already unique`);
      skipped++;
    }
  } catch (err) {
    console.error(`  ERROR in ${entry.name}:`, err.message);
    skipped++;
  }
}

console.log(`\n✅ Done! Migrated: ${migrated}, Skipped: ${skipped}`);

if (migrated > 0) {
  console.log(`\n📂 Backups created at: ${DATA_DIR}/*_backup`);
  console.log("   Remove them with: rm -rf ../../data/task-packages/*_backup");
  console.log("\n⚠️  Next: rebuild shared types (cd ../shared && npm run build)");
  console.log("   Then restart the editor server.\n");
}
