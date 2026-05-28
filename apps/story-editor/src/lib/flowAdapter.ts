import type { FlowDefinition, FlowServingLoop, StoryModule } from "@story-game/shared";
import type { FlowEditorState } from "./flowTypes.js";

/** Fallback: auto-generate acts from modules when flow has empty linearPhases. */
function fallbackFromModules(modules: StoryModule[]): FlowEditorState {
  const sorted = [...modules].sort((a, b) => {
    const sa = (a as any).sourceStage || "";
    const sb = (b as any).sourceStage || "";
    const ma = sa.match(/^stage_(\d+)([a-z])?$/);
    const mb = sb.match(/^stage_(\d+)([a-z])?$/);
    if (!ma || !mb) return sa.localeCompare(sb);
    const na = parseInt(ma[1]), nb = parseInt(mb[1]);
    if (na !== nb) return na - nb;
    return (ma[2] || "").localeCompare(mb[2] || "");
  });

  // Group by type transitions
  const TYPE_GROUP: Record<string, string> = {
    training:    "act1_capture",
    choice:      "act1_capture",
    serving:     "act2_serve",
    punishment:  "act3_punish",
    daily:       "act_daily",
    event:       "act_finale",
  };

  const acts: Record<string, string[]> = {};
  for (const mod of sorted) {
    const groupKey = TYPE_GROUP[mod.type || "training"] || "act_other";
    if (!acts[groupKey]) acts[groupKey] = [];
    acts[groupKey].push(mod.id);
  }

  const actAfterAll: Record<string, string | null> = {};
  const mainActKeys = Object.keys(acts).filter((k) => k !== "act_daily" && k !== "act_finale");
  mainActKeys.forEach((key, i) => {
    actAfterAll[key] = i < mainActKeys.length - 1 ? mainActKeys[i + 1] : "act_finale";
  });

  const dailyTriggers = (acts["act_daily"] || []).map((id) => ({ module: id, trigger: "" }));
  const finaleSequence = acts["act_finale"] || [];

  // Remove daily/finale from acts (they go into their own sections)
  const cleanedActs: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(acts)) {
    if (k !== "act_daily" && k !== "act_finale") cleanedActs[k] = v;
  }

  return {
    modules,
    acts: cleanedActs,
    actAfterAll,
    servingLoop: null,
    finaleSequence,
    dailyTriggers,
  };
}

/**
 * Convert FlowDefinition + StoryModule[] → FlowEditorState
 * Extracts acts, serving loop, finale sequence, daily triggers from flow.json
 */
export function flowToEditorState(flow: FlowDefinition, modules: StoryModule[]): FlowEditorState {
  const acts: Record<string, string[]> = {};
  const actAfterAll: Record<string, string | null> = {};
  for (const [key, phase] of Object.entries(flow.linearPhases)) {
    acts[key] = phase.sequence;
    actAfterAll[key] = (phase as any).afterAll || null;
  }

  // Fallback: auto-generate from modules when flow has no structure
  if (Object.keys(acts).length === 0 && modules.length > 0) {
    return fallbackFromModules(modules);
  }

  const finaleSequence = flow.finaleSequence?.sequence || [];

  const dailyTriggers = (flow.dailySystem?.triggerRules || []).map((r) => ({
    module: r.module,
    trigger: r.trigger,
  }));

  return {
    modules,
    acts,
    actAfterAll,
    servingLoop: flow.servingLoop || null,
    finaleSequence,
    dailyTriggers,
  };
}

/**
 * Convert FlowEditorState back → { flow: FlowDefinition, modules: StoryModule[] }
 * Reconstructs the flow.json structure from the editor state.
 */
export function editorStateToFlow(state: FlowEditorState, flowId: string, flowTitle: string): { flow: FlowDefinition; modules: StoryModule[] } {
  const flow: FlowDefinition = {
    id: flowId,
    title: flowTitle,
    description: "",
    linearPhases: {},
    finaleSequence: state.finaleSequence.length > 0
      ? { title: "终幕", sequence: state.finaleSequence, description: "" }
      : undefined,
    dailySystem: state.dailyTriggers.length > 0
      ? {
          title: "日常体系",
          description: "",
          availableModules: state.dailyTriggers.map((d) => d.module),
          triggerRules: state.dailyTriggers.map((d) => ({ module: d.module, trigger: d.trigger })),
        }
      : undefined,
  };

  // Rebuild linear phases — afterAll derived from act insertion order
  const actTitles: Record<string, string> = {
    act1_capture: "第一幕",
    act2_initiation: "第二幕",
    act2_serve: "第二幕",
    act3_punishment: "第三幕",
    act3_punish: "第三幕",
    act4_willbreak: "第四幕",
    act4_daily: "日常",
  };
  const actKeys = Object.keys(state.acts);
  for (let i = 0; i < actKeys.length; i++) {
    const key = actKeys[i];
    const sequence = state.acts[key];
    if (sequence.length > 0) {
      flow.linearPhases[key] = {
        title: actTitles[key] || key,
        sequence,
        afterAll: i < actKeys.length - 1 ? actKeys[i + 1] : (flow.servingLoop ? "serving_loop" : undefined),
      };
    }
  }

  // Rebuild serving loop
  if (state.servingLoop) {
    flow.servingLoop = state.servingLoop;
  }

  return { flow, modules: state.modules };
}
