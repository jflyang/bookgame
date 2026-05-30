import type { Scenario, ScenarioStageDetail, StoryModule } from "@story-game/shared";

// ═══ Unique ID generation ═══

const ID_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Generate a globally unique stage ID: stage_ + 10 random chars. */
export function generateStageId(): string {
  let id = "stage_";
  for (let i = 0; i < 10; i++) id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return id;
}

/** Generate a globally unique module ID: mod_ + 10 random chars. */
export function generateModuleId(): string {
  let id = "mod_";
  for (let i = 0; i < 10; i++) id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return id;
}

/** Ensure a stage ID is unique across all existing stage IDs. Throws on collision. */
export function assertUniqueStageId(newId: string, existingIds: Set<string>): void {
  if (existingIds.has(newId)) {
    throw new Error(`Stage ID conflict: "${newId}" already exists. Please generate a new ID.`);
  }
}

/** Ensure a module ID is unique across all existing module IDs. Throws on collision. */
export function assertUniqueModuleId(newId: string, existingIds: Set<string>): void {
  if (existingIds.has(newId)) {
    throw new Error(`Module ID conflict: "${newId}" already exists. Please generate a new ID.`);
  }
}

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

function guessModuleType(
  stageId: string,
  stageDetails?: ScenarioStageDetail[]
): StoryModule["type"] {
  // Prefer stageType from stageDetail (post-migration)
  if (stageDetails) {
    const detail = stageDetails.find((d) => d.id === stageId);
    if (detail?.stageType) return detail.stageType;
  }
  // Fallback: legacy ID pattern matching (pre-migration stage IDs)
  if (/_b[1-9]/.test(stageId)) return "choice";
  if (stageId === "stage_8") return "choice";
  if (/\d+a$/.test(stageId)) return "serving";
  if (/\d+b$/.test(stageId)) return "punishment";
  const numMatch = stageId.match(/^stage_(\d+)/);
  if (numMatch) {
    const num = parseInt(numMatch[1]);
    if (num >= 25) return "event";
    if (num >= 23) return "daily";
    if (num >= 21) return "serving";
  }
  return "training";
}

export interface RebuiltFlow {
  linearPhases: Record<string, { title: string; sequence: string[]; afterAll?: string }>;
  finaleSequence: string[];
  dailyTriggers: { module: string; trigger: string }[];
}

/** Narrative block descriptor. */
interface NarrativeBlock {
  key: string;
  title: string;
  modules: string[];
}

/**
 * Rebuild flow structure from synced modules using narrative-aware grouping.
 *
 * Scans modules in scenario order and groups them into contiguous "blocks"
 * based on stageType transitions. A choice point splits into parallel branches;
 * serving/punishment blocks that follow a choice are parallel alternatives.
 * Later serving blocks represent convergence points.
 *
 * The result is a clean top-to-bottom flow:
 *   捕获调教 → [分支A·服从]  ─┐
 *            → [分支B·抵抗]  ─┼→ 初次征服 → 日常 → 终幕
 */
export function rebuildFlowFromModules(
  modules: StoryModule[],
  stageDetails?: ScenarioStageDetail[]
): RebuiltFlow {
  // Build stageId → (sortKey, stageType) lookup
  const stageInfo = new Map<string, { sortKey: number; stageType?: string }>();
  if (stageDetails) {
    for (const d of stageDetails) {
      stageInfo.set(d.id, { sortKey: d.sortKey ?? 9999, stageType: d.stageType });
    }
  }

  // Sort by sortKey
  const sorted = [...modules].sort((a, b) => {
    const sa = (a as any).sourceStage as string | undefined;
    const sb = (b as any).sourceStage as string | undefined;
    const ka = sa ? (stageInfo.get(sa)?.sortKey ?? 9999) : 9999;
    const kb = sb ? (stageInfo.get(sb)?.sortKey ?? 9999) : 9999;
    return ka - kb;
  });

  // ── Build narrative blocks by scanning sorted modules ──
  // Strategy: determine the "effective type" for each module.
  // choice modules inherit their nearest non-choice predecessor's type.
  // A new block starts when the effective type changes.
  //
  // After the main branch point (first choice), the first serving block
  // is "branch_obey", the first punishment block is "branch_resist",
  // and any subsequent serving/punishment blocks are "convergence".
  const blocks: NarrativeBlock[] = [];
  let seenBranchPoint = false;
  let effectiveType = "training"; // the resolved type, ignoring choice sub-stages

  for (const mod of sorted) {
    const info = stageInfo.get((mod as any).sourceStage || "");
    const rawType = info?.stageType || mod.type;

    // Resolve effective type: choice sub-stages inherit
    let newEffectiveType = effectiveType;
    if (rawType === "choice") {
      // First choice module → main branch point
      if (!seenBranchPoint) {
        newEffectiveType = "choice";
        seenBranchPoint = true;
      }
      // else: sub-branch choice → keep previous effective type
    } else if (rawType === "training") {
      newEffectiveType = "training";
    } else if (rawType === "serving") {
      newEffectiveType = "serving";
    } else if (rawType === "punishment") {
      newEffectiveType = "punishment";
    } else if (rawType === "daily") {
      newEffectiveType = "daily";
    } else if (rawType === "event" || rawType === "finale") {
      newEffectiveType = "finale";
    }

    // Detect block change: effective type changed → new block
    if (newEffectiveType !== effectiveType) {
      effectiveType = newEffectiveType;
    }

    const lastBlock = blocks[blocks.length - 1];
    const blockKey = effectiveType;
    if (!lastBlock || lastBlock.key !== blockKey) {
      blocks.push({ key: blockKey, title: "", modules: [] });
    }
    blocks[blocks.length - 1].modules.push(mod.id);
  }

  // ── Assign narrative role names to blocks ──
  let servingAfterBranch = 0;
  let punishmentAfterBranch = 0;
  for (const block of blocks) {
    if (block.key === "training") block.key = "capture";
    else if (block.key === "choice") block.key = "branch_point";
    else if (block.key === "serving") { servingAfterBranch++; block.key = servingAfterBranch === 1 ? "branch_obey" : "convergence"; }
    else if (block.key === "punishment") { punishmentAfterBranch++; block.key = punishmentAfterBranch === 1 ? "branch_resist" : "convergence"; }
    // daily, finale keep their names
  }

  // ── Assign titles ──
  const ROLE_TITLES: Record<string, string> = {
    capture:       "捕获调教",
    branch_point:  "⚡ 命运抉择",
    branch_obey:   "分支A · 服从路线",
    branch_resist: "分支B · 抵抗路线",
    convergence:   "初次征服",
    daily:         "日常",
    finale:        "终幕",
  };
  for (const block of blocks) {
    block.title = ROLE_TITLES[block.key] || block.key;
  }

  // Daily stays in main flow; only finale is separated
  const mainBlocks = blocks.filter(b => b.key !== "finale");
  const finaleModules = blocks.filter(b => b.key === "finale").flatMap(b => b.modules);

  const linearPhases: Record<string, { title: string; sequence: string[]; afterAll?: string }> = {};
  for (let i = 0; i < mainBlocks.length; i++) {
    const block = mainBlocks[i];
    let afterAll: string | undefined;

    if (block.key === "branch_point") {
      // Branch point: choice node handles splitting — don't set afterAll
      afterAll = undefined;
    } else if (block.key === "branch_obey" || block.key === "branch_resist") {
      // Branch blocks both converge to the same point
      // Find the convergence block
      const conv = mainBlocks.find(b => b.key === "convergence");
      afterAll = conv ? "convergence" : undefined;
    } else if (block.key === "convergence") {
      // Convergence → daily or next block
      const next = mainBlocks[i + 1];
      afterAll = next ? next.key : undefined;
    } else {
      // Default linear flow
      afterAll = i < mainBlocks.length - 1 ? mainBlocks[i + 1].key : undefined;
    }

    linearPhases[block.key] = {
      title: block.title,
      sequence: block.modules,
      afterAll,
    };
  }

  return {
    linearPhases,
    finaleSequence: finaleModules,
    dailyTriggers: [],  // daily now flows in linearPhases before finale
  };
}
