import type { Scenario, ScenarioStageDetail, StoryModule } from "@story-game/shared";
import { generateModuleId } from "./idGen.js";
import { guessModuleType } from "./stageSort.js";

export interface SyncReport {
  scenarioStageCount: number;
  flowModuleCount: number;       // modules with sourceStage
  missingModules: string[];      // stageIds with no matching module
  matchedModules: number;        // count of stageIds with matching modules
  extraModules: string[];        // modules with sourceStage not in scenario
  unassignedModules: number;     // modules not placed in any phase group
  hasMismatch: boolean;
}

/**
 * Compare scenario stages with flow modules (via module.sourceStage)
 * and detect modules not assigned to any phase group.
 *
 * @param assignedIds  Set of module IDs that appear in flow structure
 *                     (linearPhases + finaleSequence + dailySystem).
 *                     Omit to skip phase-assignment check.
 */
export function detectMismatch(
  scenario: Scenario | undefined,
  modules: StoryModule[],
  assignedIds?: Set<string>
): SyncReport {
  const stageIds = new Set(scenario?.stages || []);
  const moduleStageIds = new Set(
    modules.filter((m) => m.sourceStage).map((m) => m.sourceStage!)
  );

  const missingModules: string[] = [];
  for (const sid of stageIds) {
    if (!moduleStageIds.has(sid)) missingModules.push(sid);
  }

  const extraModules: string[] = [];
  for (const mid of moduleStageIds) {
    if (!stageIds.has(mid)) extraModules.push(mid);
  }

  const matchedModules = [...stageIds].filter((sid) => moduleStageIds.has(sid)).length;

  // Unassigned: modules that exist but aren't in any phase group
  let unassignedModules = 0;
  if (assignedIds) {
    for (const mod of modules) {
      if (!assignedIds.has(mod.id)) unassignedModules++;
    }
  }

  return {
    scenarioStageCount: stageIds.size,
    flowModuleCount: moduleStageIds.size,
    missingModules,
    matchedModules,
    extraModules,
    unassignedModules,
    hasMismatch: missingModules.length > 0 || extraModules.length > 0 || unassignedModules > 0,
  };
}

/**
 * Generate/update flow modules from scenario data.
 * - Creates new modules for stages without matching modules
 * - Updates existing modules' titles/descriptions from stageDetails
 * - Preserves existing modules' data where stageDetail is sparse
 */
export function syncFromScenario(
  scenario: Scenario | undefined,
  existingModules: StoryModule[]
): StoryModule[] {
  if (!scenario) return existingModules;

  const stageDetails = scenario?.stageDetails || [];
  const detailMap = new Map(stageDetails.map((d) => [d.id, d]));
  const existingMap = new Map(
    existingModules.map((m) => [m.sourceStage, m])
  );

  const result: StoryModule[] = [];

  for (const stageId of scenario.stages) {
    const detail = detailMap.get(stageId);
    const existing = existingMap.get(stageId);

    if (existing) {
      // Update from stageDetail
      result.push({
        ...existing,
        title: detail?.title || existing.title,
        description: detail?.description || existing.description || "",
        guidance: detail?.guidance || existing.guidance || "",
        enterWhen: detail?.enterWhen || existing.enterWhen || "",
      });
    } else {
      // Create new module with unique ID
      const existingModIds = new Set(result.map((m) => m.id));
      let modId: string;
      do {
        modId = generateModuleId();
      } while (existingModIds.has(modId)); // ensure no local collision
      result.push({
        id: modId,
        sourceStage: stageId,
        title: detail?.title || stageId,
        type: guessModuleType(stageId, stageDetails),
        reusable: false,
        description: detail?.description || "",
        guidance: detail?.guidance || "",
        enterWhen: detail?.enterWhen || "",
        exitCondition: "",
      });
    }
  }

  // Also keep extra modules (with sourceStage not in scenario) at the end
  for (const mod of existingModules) {
    if (!mod.sourceStage || !scenario.stages.includes(mod.sourceStage)) {
      // Check it's not already in result
      if (!result.find((m) => m.id === mod.id)) {
        result.push(mod);
      }
    }
  }

  return result;
}

// Re-export for convenience
export { RebuiltFlow, rebuildFlowFromModules } from "./storyStructure.js";
