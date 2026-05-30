/** Narrative block detection from scenario + modules. */
import type { ScenarioStageDetail, StoryModule } from "@story-game/shared";

export interface RebuiltFlow {
  linearPhases: Record<string, { title: string; sequence: string[]; afterAll?: string }>;
  finaleSequence: string[];
  dailyTriggers: { module: string; trigger: string }[];
}

interface NarrativeBlock {
  key: string;
  title: string;
  modules: string[];
}

const ROLE_TITLES: Record<string, string> = {
  capture:       "捕获调教",
  branch_point:  "⚡ 命运抉择",
  branch_obey:   "分支A · 服从路线",
  branch_resist: "分支B · 抵抗路线",
  convergence:   "初次征服",
  daily:         "日常",
  finale:        "终幕",
};

/**
 * Rebuild flow structure from synced modules using narrative-aware grouping.
 *
 * Scans modules in scenario order and groups into contiguous "blocks"
 * based on stageType transitions. The main choice point creates parallel
 * branches; later serving/punishment blocks represent convergence.
 */
export function rebuildFlowFromModules(
  modules: StoryModule[],
  stageDetails?: ScenarioStageDetail[]
): RebuiltFlow {
  const stageInfo = new Map<string, { sortKey: number; stageType?: string }>();
  if (stageDetails) {
    for (const d of stageDetails) stageInfo.set(d.id, { sortKey: d.sortKey ?? 9999, stageType: d.stageType });
  }

  // Sort by sortKey
  const sorted = [...modules].sort((a, b) => {
    const sa = (a as any).sourceStage as string | undefined;
    const sb = (b as any).sourceStage as string | undefined;
    return (sa ? (stageInfo.get(sa)?.sortKey ?? 9999) : 9999) -
           (sb ? (stageInfo.get(sb)?.sortKey ?? 9999) : 9999);
  });

  // Build narrative blocks — choice sub-stages inherit parent type
  const blocks: NarrativeBlock[] = [];
  let seenBranchPoint = false;
  let effectiveType = "training";

  for (const mod of sorted) {
    const info = stageInfo.get((mod as any).sourceStage || "");
    const rawType = info?.stageType || mod.type;

    let newType = effectiveType;
    if (rawType === "choice") {
      if (!seenBranchPoint) { newType = "choice"; seenBranchPoint = true; }
    } else if (rawType === "training") newType = "training";
    else if (rawType === "serving") newType = "serving";
    else if (rawType === "punishment") newType = "punishment";
    else if (rawType === "daily") newType = "daily";
    else if (rawType === "event" || rawType === "finale") newType = "finale";

    if (newType !== effectiveType) effectiveType = newType;

    const last = blocks[blocks.length - 1];
    if (!last || last.key !== effectiveType) blocks.push({ key: effectiveType, title: "", modules: [] });
    last.modules.push(mod.id);
  }

  // Assign narrative role names
  let servingCount = 0, punishmentCount = 0;
  for (const block of blocks) {
    if (block.key === "training") block.key = "capture";
    else if (block.key === "choice") block.key = "branch_point";
    else if (block.key === "serving") { servingCount++; block.key = servingCount === 1 ? "branch_obey" : "convergence"; }
    else if (block.key === "punishment") { punishmentCount++; block.key = punishmentCount === 1 ? "branch_resist" : "convergence"; }
    block.title = ROLE_TITLES[block.key] || block.key;
  }

  // Daily stays in main flow; only finale is separated
  const mainBlocks = blocks.filter(b => b.key !== "finale");
  const finaleModules = blocks.filter(b => b.key === "finale").flatMap(b => b.modules);

  const linearPhases: Record<string, { title: string; sequence: string[]; afterAll?: string }> = {};
  for (let i = 0; i < mainBlocks.length; i++) {
    const block = mainBlocks[i];
    let afterAll: string | undefined;
    if (block.key === "branch_point") { afterAll = undefined; }
    else if (block.key === "branch_obey" || block.key === "branch_resist") {
      afterAll = mainBlocks.find(b => b.key === "convergence") ? "convergence" : undefined;
    } else if (block.key === "convergence") {
      afterAll = mainBlocks[i + 1]?.key;
    } else {
      afterAll = mainBlocks[i + 1]?.key;
    }
    linearPhases[block.key] = { title: block.title, sequence: block.modules, afterAll };
  }

  return { linearPhases, finaleSequence: finaleModules, dailyTriggers: [] };
}
