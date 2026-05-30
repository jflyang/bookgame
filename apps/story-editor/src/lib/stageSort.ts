import type { ScenarioStageDetail, StoryModule } from "@story-game/shared";

/**
 * Infer module type from a stage ID or stageDetail's stageType.
 * Prefers stageType from stageDetail (post-migration); falls back to
 * legacy ID pattern matching for pre-migration stage IDs.
 */
export function guessModuleType(
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

/** Parse stage ID into sortable tuple: [stageNumber, letterSuffix, subBranchNumber] */
export function stageSortKey(stageId: string): [number, string, number] {
  const full = stageId.match(/^stage_(\d+)([a-z]?)(?:_b(\d+))?$/);
  if (full) {
    return [parseInt(full[1]), full[2] || "", full[3] ? parseInt(full[3]) : 0];
  }
  return [0, stageId, 0];
}
