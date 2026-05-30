/**
 * Add stageType to stageDetails based on module types from flow.json.
 * Run after unique_stage_ids.cjs migration.
 *
 *   node scripts/add_stage_types.cjs
 */
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "../../data/task-packages");

const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
const dirs = entries.filter(e => e.isDirectory() && !e.name.includes("_backup"));

for (const entry of dirs) {
  const pkgDir = path.join(DATA_DIR, entry.name);
  const scenarioPath = path.join(pkgDir, "scenario.json");
  const flowPath = path.join(pkgDir, "flow.json");
  
  if (!fs.existsSync(scenarioPath)) continue;
  
  const scenario = JSON.parse(fs.readFileSync(scenarioPath, "utf-8"));
  const details = scenario.stageDetails || [];
  if (details.length === 0) continue;
  
  // Check if already has stageType
  const missing = details.filter(d => !d.stageType);
  if (missing.length === 0) { console.log(entry.name + ": already has stageType"); continue; }
  
  // Build stageId → moduleType map from flow.json
  const stageTypeMap = {};
  if (fs.existsSync(flowPath)) {
    const flow = JSON.parse(fs.readFileSync(flowPath, "utf-8"));
    for (const mod of (flow.modules || [])) {
      if (mod.sourceStage && mod.type) {
        stageTypeMap[mod.sourceStage] = mod.type;
      }
    }
  }
  
  let updated = 0;
  for (const detail of details) {
    if (!detail.stageType) {
      detail.stageType = stageTypeMap[detail.id] || "training";
      updated++;
    }
  }
  
  fs.writeFileSync(scenarioPath, JSON.stringify(scenario, null, 2), "utf-8");
  console.log(entry.name + ": added stageType to " + updated + "/" + details.length + " stages");
}
console.log("\nDone.");
