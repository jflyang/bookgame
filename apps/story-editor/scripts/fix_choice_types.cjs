/**
 * Fix: non-branch-point "choice" stages should inherit their parent's type.
 * Only stage 8 (命运抉择, isChoicePoint=true) should be "choice".
 * Other choice-marked stages (_b1/_b2 sub-stages) become serving or punishment.
 */
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "../../data/task-packages");

for (const entry of fs.readdirSync(DATA_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.includes("_backup")) continue;
  const pkgDir = path.join(DATA_DIR, entry.name);
  const scenarioPath = path.join(pkgDir, "scenario.json");
  const flowPath = path.join(pkgDir, "flow.json");
  if (!fs.existsSync(scenarioPath) || !fs.existsSync(flowPath)) continue;

  const scenario = JSON.parse(fs.readFileSync(scenarioPath, "utf-8"));
  const flow = JSON.parse(fs.readFileSync(flowPath, "utf-8"));
  const details = scenario.stageDetails || [];
  let fixed = 0;

  // Determine parent type for each choice sub-stage
  // Walk through stages in sortKey order
  const sorted = [...details].sort((a,b) => (a.sortKey||0) - (b.sortKey||0));
  let prevNonChoiceType = "training";
  const typeMap = {}; // stageId → new type

  for (const d of sorted) {
    if (d.stageType === "choice" && !d.isChoicePoint) {
      // Sub-branch choice → inherit parent type
      typeMap[d.id] = prevNonChoiceType;
      fixed++;
    } else if (d.stageType !== "choice") {
      prevNonChoiceType = d.stageType || "training";
    }
    // Main branch point (isChoicePoint=true) stays as "choice"
  }

  if (fixed === 0) continue;

  // Update stageDetails
  for (const d of details) {
    if (typeMap[d.id]) d.stageType = typeMap[d.id];
  }
  fs.writeFileSync(scenarioPath, JSON.stringify(scenario, null, 2), "utf-8");

  // Update flow.json modules
  let modFixed = 0;
  for (const mod of (flow.modules || [])) {
    const newType = typeMap[mod.sourceStage];
    if (newType && mod.type === "choice") {
      mod.type = newType;
      modFixed++;
    }
  }
  if (modFixed > 0) {
    fs.writeFileSync(flowPath, JSON.stringify(flow, null, 2), "utf-8");
  }

  console.log(entry.name + ": fixed " + fixed + " stage types, " + modFixed + " module types");
}
console.log("\nDone.");
