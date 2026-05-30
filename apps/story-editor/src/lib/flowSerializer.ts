/**
 * flowSerializer.ts — Serialize ReactFlow nodes/edges back to FlowDefinition.
 *
 * This is the inverse of flowLayout.ts:
 *   flowLayout: FlowEditorState → nodes/edges (for display)
 *   flowSerializer: nodes/edges → FlowEditorState → FlowDefinition (for saving)
 *
 * ⚠️ HIGH RISK: Changes here can cause data loss on save.
 * Always test: save → reopen → verify flow.json integrity.
 */

import type { FlowNode, FlowEdge } from "./flowTypes.js";
import type { StoryModule, FlowDefinition, FlowServingLoop } from "@story-game/shared";
import { editorStateToFlow } from "./flowAdapter.js";

/**
 * Reconstruct FlowDefinition from ReactFlow canvas state.
 * Traverses node hierarchy and edge connections to rebuild:
 * - acts (from phaseGroup children)
 * - servingLoop (from loop children + edge analysis)
 * - finaleSequence (from finale group children)
 * - dailyTriggers (from dailyTrigger nodes)
 */
export function serializeFlowData(
  nodes: FlowNode[],
  edges: FlowEdge[],
  modules: StoryModule[],
  flowId: string,
  flowTitle: string,
): { flow: FlowDefinition; modules: StoryModule[] } {
  const acts: Record<string, string[]> = {};
  const finaleSequence: string[] = [];
  let servingLoop: FlowServingLoop | null = null;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const groupNodes = nodes.filter((n) => n.type === "phaseGroup");
  const loopNode = nodes.find((n) => n.type === "loop");

  // ═══════════════════════════════════════════
  // Reconstruct acts from phaseGroup children
  // ═══════════════════════════════════════════
  groupNodes.forEach((g) => {
    const children = nodes.filter((n) => n.parentId === g.id && (n.type === "module" || n.type === "choice"));
    const actKey = g.data.actKey || g.id;
    children.sort((a, b) => a.position.x - b.position.x);

    if (actKey === "finale") {
      children.forEach((c) => {
        if (c.data.moduleRef) finaleSequence.push(c.data.moduleRef);
      });
    } else {
      acts[actKey] = children.map((c) => c.data.moduleRef || c.id).filter(Boolean);
    }
  });

  // ═══════════════════════════════════════════
  // Reconstruct serving loop FROM EDGES
  // Edges are the source of truth for cycle flow
  // ═══════════════════════════════════════════
  if (loopNode) {
    servingLoop = reconstructServingLoop(loopNode, nodes, edges, nodeMap);
  }

  // Extract daily triggers from current nodes
  const dailyTriggers = nodes
    .filter((n) => n.type === "dailyTrigger" && n.data.moduleRef)
    .map((n) => ({ module: n.data.moduleRef!, trigger: n.data.triggerRule || "" }));

  const state = { modules, acts, servingLoop, finaleSequence, dailyTriggers };
  return editorStateToFlow(state, flowId, flowTitle);
}

/**
 * Reconstruct serving loop data from loop node children and edge connections.
 */
function reconstructServingLoop(
  loopNode: FlowNode,
  nodes: FlowNode[],
  edges: FlowEdge[],
  nodeMap: Map<string, FlowNode>,
): FlowServingLoop {
  const loopChildren = nodes.filter((n) => n.parentId === loopNode.id);
  const serveModuleByCycle: Record<string, string> = {};
  const punishModuleByCycle: Record<string, string> = {};

  // Separate children by type
  const serveModules = loopChildren.filter((n) => n.type === "module" && n.data.colorKey === "serving");
  const punishModules = loopChildren.filter((n) => n.type === "module" && n.data.colorKey === "punishment");
  const judgmentNodes = loopChildren.filter((n) => n.type === "judgment");

  // Sort by x position to get cycle order
  serveModules.sort((a, b) => a.position.x - b.position.x);
  punishModules.sort((a, b) => a.position.x - b.position.x);

  // Map serves: assign cycle numbers by position order
  serveModules.forEach((mod, i) => {
    const key = i < serveModules.length - 1 ? String(i + 1) : "default";
    serveModuleByCycle[key] = mod.data.moduleRef || mod.id;
  });

  // Map punishes: check edges for judgment branch_1 connections
  punishModules.forEach((mod, i) => {
    const punishEdge = edges.find((e) => e.target === mod.id && e.sourceHandle === "branch_1");
    if (punishEdge) {
      const judgeNode = nodeMap.get(punishEdge.source);
      if (judgeNode) {
        const judgeIdx = judgmentNodes.indexOf(judgeNode);
        const key = judgeIdx >= 0 && judgeIdx < serveModules.length - 1
          ? String(judgeIdx + 1) : "default";
        punishModuleByCycle[key] = mod.data.moduleRef || mod.id;
      } else {
        punishModuleByCycle[String(i + 1)] = mod.data.moduleRef || mod.id;
      }
    } else {
      const key = i < punishModules.length - 1 ? String(i + 1) : "default";
      punishModuleByCycle[key] = mod.data.moduleRef || mod.id;
    }
  });

  // Check for modules connected to judgment branch_1 outside the loop container
  edges.filter((e) => e.sourceHandle === "branch_1").forEach((e) => {
    const targetMod = nodes.find((n) => n.id === e.target && (n.type === "module" || n.type === "choice"));
    if (targetMod && !loopChildren.includes(targetMod)) {
      const judgeNode = nodeMap.get(e.source);
      if (judgeNode) {
        const judgeIdx = judgmentNodes.indexOf(judgeNode);
        const key = judgeIdx >= 0 && judgeIdx < serveModules.length - 1
          ? String(judgeIdx + 1) : "default";
        if (!punishModuleByCycle[key]) {
          punishModuleByCycle[key] = targetMod.data.moduleRef || targetMod.id;
        }
      }
    }
  });

  // Rebuild judgmentNode from first judgment in loop
  let judgmentNode = (loopNode.data.loopData as any)?.judgmentNode || {
    id: "judge_default",
    type: "judgment" as const,
    judge: "emperor",
    description: "",
    scoringMethods: {},
    routes: {},
  };

  const firstJudgment = judgmentNodes[0];
  if (firstJudgment?.data) {
    judgmentNode = {
      ...judgmentNode,
      id: firstJudgment.id,
      judge: (firstJudgment.data.judgmentData as any)?.judge || judgmentNode.judge,
      description: (firstJudgment.data.judgmentData as any)?.description || judgmentNode.description,
      scoringMethods: (firstJudgment.data.judgmentData as any)?.scoringMethods || judgmentNode.scoringMethods,
    };
  }

  return {
    id: loopNode.data.loopData?.id || "serving_loop",
    title: (loopNode.data.loopData as any)?.title || loopNode.data.label || "侍寝循环",
    description: (loopNode.data.loopData as any)?.description || "",
    initialCycle: (loopNode.data.loopData as any)?.initialCycle || 1,
    maxCycles: (loopNode.data.loopData as any)?.maxCycles ?? null,
    serveModuleByCycle,
    punishModuleByCycle,
    judgmentNode,
  } as FlowServingLoop;
}
