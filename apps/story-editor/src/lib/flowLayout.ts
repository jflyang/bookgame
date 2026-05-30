import type { FlowNode, FlowEdge, FlowEditorState } from "./flowTypes.js";

// Auto-layout: simple layered layout
// Linear phases go left-to-right, acts go top-to-bottom
// Serving loop in center, finale on right

const NODE_W = 200;
const NODE_H = 80;
const H_GAP = 60;   // horizontal gap between nodes
const V_GAP = 100;   // vertical gap between acts
const ACT_PAD = 50;  // padding inside act groups

// ═══════════════════════════════════════════════════════════
// B2: Extracted layout sub-functions
// ═══════════════════════════════════════════════════════════

interface LayoutContext {
  nodes: FlowNode[];
  edges: FlowEdge[];
  y: number;
  prevId: string;
}

/** Layout acts (phase groups) with parallel branch detection (A3). */
function layoutActs(
  state: FlowEditorState,
  actKeys: string[],
  actLabels: string[],
  ctx: LayoutContext,
  startId: string,
): void {
  // A3: Detect parallel branch targets
  const parallelPairs: Map<string, string> = new Map();
  const parallelProcessed = new Set<string>();

  actKeys.forEach((actKey) => {
    const modIds = state.acts[actKey] || [];
    if (modIds.length === 0) return;
    const lastModId = modIds[modIds.length - 1];
    const lastMod = state.modules.find((m) => m.id === lastModId);
    if (lastMod?.type !== "choice") return;

    const afterAll = state.actAfterAll?.[actKey];
    if (!afterAll || !state.acts[afterAll]) return;

    const actIdx = actKeys.indexOf(actKey);
    for (let j = actIdx + 1; j < actKeys.length; j++) {
      const altKey = actKeys[j];
      if (altKey !== afterAll && state.acts[altKey] && state.acts[altKey].length > 0) {
        if (!parallelProcessed.has(afterAll) && !parallelProcessed.has(altKey)) {
          parallelPairs.set(afterAll, altKey);
          parallelProcessed.add(afterAll);
          parallelProcessed.add(altKey);
        }
        break;
      }
    }
  });

  actKeys.forEach((actKey, ai) => {
    const modIds = state.acts[actKey] || [];
    if (modIds.length === 0) return;
    // Skip right-side of parallel pair (already placed)
    if ([...parallelPairs.values()].includes(actKey)) return;

    const isParallelLeft = parallelPairs.has(actKey);
    const pairedActKey = isParallelLeft ? parallelPairs.get(actKey)! : null;
    const pairedModIds = pairedActKey ? (state.acts[pairedActKey] || []) : [];

    const groupId = `node_group_${actKey}`;
    const totalW = modIds.length * NODE_W + (modIds.length - 1) * H_GAP + ACT_PAD * 2;
    ctx.nodes.push({
      id: groupId, type: "phaseGroup",
      position: { x: 40, y: ctx.y },
      data: { label: actLabels[ai] || actKey, actKey },
      style: { width: totalW, height: NODE_H + ACT_PAD * 2 + 30 },
    });

    let x = 40 + ACT_PAD;
    modIds.forEach((modId, mi) => {
      const mod = state.modules.find((m) => m.id === modId);
      const nodeId = `node_${modId}`;
      const isChoice = mod?.type === "choice";
      const nodeType = isChoice ? "choice" : "module";

      const nodeData: any = {
        label: mod?.title || modId,
        moduleRef: modId, moduleData: mod,
        colorKey: mod?.type || "training",
      };

      if (isChoice) {
        const afterAll = state.actAfterAll?.[actKey];
        nodeData.branches = [
          { choiceText: "服从路线", targetStage: afterAll || "", description: "默认路径" },
          { choiceText: "抵抗路线", targetStage: "", description: "选择抵抗" },
        ];
      }

      ctx.nodes.push({
        id: nodeId, type: nodeType,
        position: { x, y: ctx.y + ACT_PAD + 15 },
        data: nodeData,
        parentId: groupId, extent: "parent",
      });

      if (mi > 0) {
        const prevModId = modIds[mi - 1];
        ctx.edges.push({ id: `edge_node_${prevModId}_${nodeId}`, source: `node_${prevModId}`, target: nodeId });
      }
      if (mi === modIds.length - 1) ctx.prevId = nodeId;
      x += NODE_W + H_GAP;
    });

    if (ai === 0) {
      const firstNodeId = `node_${modIds[0]}`;
      ctx.edges.push({ id: `edge_start_${firstNodeId}`, source: startId, target: firstNodeId });
    }

    // Place parallel pair to the right
    if (isParallelLeft && pairedActKey && pairedModIds.length > 0) {
      const pairedGroupId = `node_group_${pairedActKey}`;
      const pairedTotalW = pairedModIds.length * NODE_W + (pairedModIds.length - 1) * H_GAP + ACT_PAD * 2;
      const pairedX = 40 + totalW + H_GAP * 2;
      const pairedAi = actKeys.indexOf(pairedActKey);

      ctx.nodes.push({
        id: pairedGroupId, type: "phaseGroup",
        position: { x: pairedX, y: ctx.y },
        data: { label: actLabels[pairedAi] || pairedActKey, actKey: pairedActKey },
        style: { width: pairedTotalW, height: NODE_H + ACT_PAD * 2 + 30 },
      });

      let px = pairedX + ACT_PAD;
      pairedModIds.forEach((modId, mi) => {
        const mod = state.modules.find((m) => m.id === modId);
        const nodeId = `node_${modId}`;
        const nodeType = mod?.type === "choice" ? "choice" : "module";

        ctx.nodes.push({
          id: nodeId, type: nodeType,
          position: { x: px, y: ctx.y + ACT_PAD + 15 },
          data: { label: mod?.title || modId, moduleRef: modId, moduleData: mod, colorKey: mod?.type || "training" },
          parentId: pairedGroupId, extent: "parent",
        });

        if (mi > 0) {
          const prevModId = pairedModIds[mi - 1];
          ctx.edges.push({ id: `edge_node_${prevModId}_${nodeId}`, source: `node_${prevModId}`, target: nodeId });
        }
        px += NODE_W + H_GAP;
      });
    }

    ctx.y += NODE_H + ACT_PAD * 2 + 30 + V_GAP;
  });
}

/** Layout inter-act connections (branches and linear). */
function layoutBranches(state: FlowEditorState, ctx: LayoutContext): void {
  const actKeysList = Object.keys(state.acts);
  const actLastNodes: Record<string, string> = {};
  const actFirstNodes: Record<string, string> = {};

  actKeysList.forEach((key) => {
    const modIds = state.acts[key];
    if (modIds && modIds.length > 0) {
      actLastNodes[key] = `node_${modIds[modIds.length - 1]}`;
      actFirstNodes[key] = `node_${modIds[0]}`;
    }
  });

  actKeysList.forEach((curKey, i) => {
    const lastNodeId = actLastNodes[curKey];
    if (!lastNodeId) return;

    const lastModId = state.acts[curKey][state.acts[curKey].length - 1];
    const lastMod = state.modules.find((m) => m.id === lastModId);
    const afterAll = state.actAfterAll?.[curKey];

    if (lastMod?.type === "choice") {
      const branches: { targetKey: string; handleId: string; label: string }[] = [];

      if (afterAll && actFirstNodes[afterAll]) {
        branches.push({ targetKey: afterAll, handleId: "branch_0", label: "服从路线" });
      }

      for (let j = i + 1; j < actKeysList.length; j++) {
        const altKey = actKeysList[j];
        if (altKey !== afterAll && actFirstNodes[altKey]) {
          branches.push({ targetKey: altKey, handleId: "branch_1", label: "抵抗路线" });
          break;
        }
      }

      if (branches.length < 2) {
        for (let j = 0; j < actKeysList.length; j++) {
          const altKey = actKeysList[j];
          if (altKey !== curKey && !branches.find((b) => b.targetKey === altKey) && actFirstNodes[altKey]) {
            branches.push({ targetKey: altKey, handleId: `branch_${branches.length}`, label: `路线 ${branches.length + 1}` });
            if (branches.length >= 2) break;
          }
        }
      }

      branches.forEach((b) => {
        const existing = ctx.edges.find((e) => e.source === lastNodeId && e.target === actFirstNodes[b.targetKey]);
        if (!existing && lastNodeId !== actFirstNodes[b.targetKey]) {
          ctx.edges.push({
            id: `edge_choice_${curKey}_to_${b.targetKey}`,
            source: lastNodeId, target: actFirstNodes[b.targetKey],
            sourceHandle: b.handleId, label: b.label,
          });
        }
      });
    } else {
      const targetKey = afterAll || (i + 1 < actKeysList.length ? actKeysList[i + 1] : null);
      if (targetKey && actFirstNodes[targetKey] && lastNodeId !== actFirstNodes[targetKey]) {
        const existing = ctx.edges.find((e) => e.source === lastNodeId && e.target === actFirstNodes[targetKey]);
        if (!existing) {
          ctx.edges.push({ id: `edge_act_${curKey}_to_${targetKey}`, source: lastNodeId, target: actFirstNodes[targetKey] });
        }
      }
    }
  });
}

/** Layout serving loop section. */
function layoutServingLoop(state: FlowEditorState, ctx: LayoutContext): void {
  if (!state.servingLoop) return;

  const loopId = "node_serving_loop";
  const loop = state.servingLoop;
  const serveKeys = ["1", "2", "3", "4", "default"].filter((k) => loop.serveModuleByCycle[k]);
  const cycleCount = serveKeys.length;

  const COL_W = 220;
  const COL_GAP = 40;
  const loopW = cycleCount * COL_W * 4 + (cycleCount - 1) * COL_GAP + ACT_PAD * 2;
  const loopH = 260;

  ctx.nodes.push({
    id: loopId, type: "loop",
    position: { x: 40, y: ctx.y },
    data: { label: loop.title || "侍寝循环", loopData: loop },
    style: { width: Math.max(loopW, 600), height: loopH },
  });

  const cycleJudgmentIds: string[] = [];
  const cycleServeIds: string[] = [];
  let colIndex = 0;

  serveKeys.forEach((key) => {
    const serveModId = loop.serveModuleByCycle[key];
    if (!serveModId) return;

    const serveMod = state.modules.find((m) => m.id === serveModId);
    const baseX = 40 + ACT_PAD + colIndex * (COL_W * 4 + COL_GAP);
    const isDefault = key === "default";

    // Serve module
    const serveNodeId = `node_${serveModId}`;
    const labelPrefix = isDefault ? "默认侍寝" : `第${key}轮侍寝`;
    ctx.nodes.push({
      id: serveNodeId, type: "module",
      position: { x: baseX, y: ctx.y + 15 },
      data: { label: `${labelPrefix}: ${serveMod?.title || serveModId}`, moduleRef: serveModId, moduleData: serveMod, colorKey: "serving" },
      parentId: loopId, extent: "parent", style: { width: COL_W },
    });
    cycleServeIds.push(serveNodeId);

    // Event trigger
    const eventId = `node_event_cycle_${key}`;
    const demands: Record<string, { label: string; desc: string }> = {
      "1": { label: "禁止高潮", desc: "帝王铁律：侍寝全程禁止高潮，违者重罚" },
      "2": { label: "同意口交", desc: "帝王要求：屈膝跪地，以口舌侍奉龙根" },
      "3": { label: "服从后入", desc: "帝王要求：趴伏于地，不得回头，接受后入临幸" },
      "4": { label: "羞耻称谓", desc: "帝王要求：自称「贱婢」「奴家」，每句必称陛下" },
      "default": { label: "终极服从", desc: "帝王要求：无条件绝对服从，不得有任何抗拒" },
    };
    const demand = demands[key] || { label: "帝王指令", desc: `帝王要求：第${key}项考验` };
    ctx.nodes.push({
      id: eventId, type: "eventTrigger",
      position: { x: baseX + COL_W + COL_GAP, y: ctx.y + 15 },
      data: { label: demand.label, eventDescription: demand.desc, colorKey: "judgment" },
      parentId: loopId, extent: "parent", style: { width: COL_W },
    });
    ctx.edges.push({ id: `edge_serve_${key}_event`, source: serveNodeId, target: eventId, label: "侍寝中" });

    // Judgment node
    const judgeId = `node_judge_cycle_${key}`;
    const yesLabel = key === "1" ? "忍住了" : "同意";
    const noLabel = key === "1" ? "没忍住" : "拒绝";
    ctx.nodes.push({
      id: judgeId, type: "judgment",
      position: { x: baseX + COL_W * 2 + COL_GAP * 2, y: ctx.y + 15 },
      data: {
        label: key === "1" ? "忍住了?" : "服从?",
        branches: [
          { choiceText: yesLabel, targetStage: "next_cycle", description: "通过→下一轮" },
          { choiceText: noLabel, targetStage: "punish_pool", description: "失败→惩戒" },
        ],
        colorKey: "judgment",
      },
      parentId: loopId, extent: "parent", style: { width: COL_W },
    });
    cycleJudgmentIds.push(judgeId);
    ctx.edges.push({ id: `edge_event_${key}_judge`, source: eventId, target: judgeId });

    // Random event (punishment)
    const randomId = `node_random_cycle_${key}`;
    ctx.nodes.push({
      id: randomId, type: "randomEvent",
      position: { x: baseX + COL_W * 2 + COL_GAP * 2, y: ctx.y + 155 },
      data: {
        label: "随机惩戒",
        randomPool: [
          { id: "mod_stage_22", title: "三塞悬吊" }, { id: "mod_stage_24", title: "双龙边缘" },
          { id: "mod_stage_27", title: "媚药煎熬" }, { id: "mod_stage_28", title: "多重惩罚套餐" },
          { id: "mod_stage_30", title: "终极全具强制" },
        ],
        colorKey: "punishment",
      },
      parentId: loopId, extent: "parent", style: { width: COL_W },
    });

    ctx.edges.push({ id: `edge_judge_no_${key}_random`, source: judgeId, target: randomId, sourceHandle: "branch_1", label: noLabel, style: { stroke: "#ef4444" } });
    ctx.edges.push({ id: `edge_random_${key}_back`, source: randomId, target: serveNodeId, label: "惩戒完毕", style: { stroke: "#f97316" } });

    colIndex++;
  });

  // Connect Judgment(是) → next cycle's Serve
  for (let i = 0; i < cycleJudgmentIds.length - 1; i++) {
    ctx.edges.push({
      id: `edge_judge_yes_${serveKeys[i]}_to_${serveKeys[i + 1]}`,
      source: cycleJudgmentIds[i], target: cycleServeIds[i + 1],
      sourceHandle: "branch_0", label: i === 0 ? "忍住了" : "同意", style: { stroke: "#22c55e" },
    });
  }

  // Connect from last act to first serve
  if (ctx.prevId && cycleServeIds.length > 0) {
    ctx.edges.push({ id: `edge_prev_to_loop`, source: ctx.prevId, target: cycleServeIds[0], label: "进入侍寝循环" });
  }

  state._loopChoiceNodes = cycleJudgmentIds;
  ctx.prevId = cycleServeIds[cycleServeIds.length - 1] || ctx.prevId;
  ctx.y += loopH + V_GAP;
}

/** Layout finale sequence. */
function layoutFinale(state: FlowEditorState, ctx: LayoutContext): void {
  if (!state.finaleSequence || state.finaleSequence.length === 0) return;

  const finaleGroupId = "node_group_finale";
  const totalW = state.finaleSequence.length * NODE_W + (state.finaleSequence.length - 1) * H_GAP + ACT_PAD * 2;
  ctx.nodes.push({
    id: finaleGroupId, type: "phaseGroup",
    position: { x: 40, y: ctx.y },
    data: { label: "终幕", actKey: "finale" },
    style: { width: totalW, height: NODE_H + ACT_PAD * 2 + 30 },
  });

  // Edge from last section → first finale module
  if (ctx.prevId) {
    const firstFinaleId = `node_${state.finaleSequence[0]}`;
    if (ctx.prevId !== firstFinaleId) {
      ctx.edges.push({ id: `edge_act_to_finale`, source: ctx.prevId, target: firstFinaleId, label: "进入终幕" });
    }
  }

  let fx = 40 + ACT_PAD;
  const fy = ctx.y + ACT_PAD + 15;
  state.finaleSequence.forEach((modId, fi) => {
    const mod = state.modules.find((m) => m.id === modId);
    const nodeId = `node_${modId}`;
    ctx.nodes.push({
      id: nodeId, type: "module",
      position: { x: fx, y: fy },
      data: { label: mod?.title || modId, moduleRef: modId, moduleData: mod, colorKey: "finale" },
      parentId: finaleGroupId, extent: "parent",
    });
    if (fi > 0) {
      ctx.edges.push({ id: `edge_finale_${fi}`, source: `node_${state.finaleSequence![fi - 1]}`, target: nodeId });
    }
    if (fi === state.finaleSequence!.length - 1) ctx.prevId = nodeId;
    fx += NODE_W + H_GAP;
  });

  // Connect last loop judgment → first finale module
  if (state._loopChoiceNodes && state._loopChoiceNodes.length > 0) {
    const lastJudgeId = state._loopChoiceNodes[state._loopChoiceNodes.length - 1];
    const finaleFirstId = `node_${state.finaleSequence[0]}`;
    ctx.edges.push({
      id: `edge_final_yes_finale`, source: lastJudgeId, sourceHandle: "branch_0",
      target: finaleFirstId, label: "全部通过",
      data: { routeKey: "satisfied" }, style: { stroke: "#22c55e" },
    });
  }

  ctx.y += NODE_H + ACT_PAD * 2 + 30 + V_GAP;
}

/** Layout daily trigger nodes on the far right. */
function layoutDailyTriggers(state: FlowEditorState, actKeys: string[], ctx: LayoutContext): void {
  if (!state.dailyTriggers || state.dailyTriggers.length === 0) return;

  let maxRight = 0;
  for (const n of ctx.nodes) {
    const right = n.position.x + (n.style?.width ? (typeof n.style.width === "number" ? n.style.width : parseInt(String(n.style.width), 10) || 200) : 200);
    if (right > maxRight) maxRight = right;
  }
  const dailyX = maxRight + 120;
  let dy = 120;

  state.dailyTriggers.forEach((dt) => {
    const mod = state.modules.find((m) => m.id === dt.module);
    const nodeId = `daily_${dt.module}`;
    ctx.nodes.push({
      id: nodeId, type: "dailyTrigger",
      position: { x: dailyX, y: dy },
      data: { label: mod?.title || dt.module, moduleRef: dt.module, moduleData: mod, triggerRule: dt.trigger },
    });

    const trigger = dt.trigger;
    let sourceGroupId: string | null = actKeys.length > 0 ? `node_group_${actKeys[0]}` : null;
    if (trigger.includes("惩戒") && actKeys.length >= 3) {
      sourceGroupId = `node_group_${actKeys[2]}`;
    }

    if (sourceGroupId) {
      ctx.edges.push({
        id: `edge_daily_${sourceGroupId}_${nodeId}`, source: sourceGroupId, target: nodeId,
        label: dt.trigger.slice(0, 20), style: { strokeDasharray: "5 5", stroke: "#9ca3af" },
      });
    }
    dy += 80;
  });
}

// ═══════════════════════════════════════════════════════════
// Main orchestrator
// ═══════════════════════════════════════════════════════════

export function autoLayout(state: FlowEditorState): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  // Start node
  const startId = "node_start";
  nodes.push({ id: startId, type: "start", position: { x: 400, y: 10 }, data: { label: "START" } });

  const ctx: LayoutContext = { nodes, edges, y: 80, prevId: startId };

  // A2: If no acts defined but modules exist, arrange vertically
  const actKeys = Object.keys(state.acts);
  if (actKeys.length === 0 && state.modules.length > 0) {
    let vy = 100;
    state.modules.forEach((mod, mi) => {
      const nodeId = `node_${mod.id}`;
      nodes.push({
        id: nodeId, type: mod.type === "choice" ? "choice" : "module",
        position: { x: 340, y: vy },
        data: { label: mod.title || mod.id, moduleRef: mod.id, moduleData: mod, colorKey: mod.type || "training" },
      });
      if (mi === 0) {
        edges.push({ id: `edge_start_${nodeId}`, source: startId, target: nodeId });
      } else {
        const prevModId = state.modules[mi - 1].id;
        edges.push({ id: `edge_${prevModId}_${mod.id}`, source: `node_${prevModId}`, target: nodeId });
      }
      ctx.prevId = nodeId;
      vy += NODE_H + V_GAP;
    });
    const endId = "node_end";
    nodes.push({ id: endId, type: "end", position: { x: 400, y: vy }, data: { label: "END" } });
    edges.push({ id: `edge_${ctx.prevId}_end`, source: ctx.prevId, target: endId });
    return { nodes, edges };
  }

  // Compute act labels
  const actLabels = actKeys.map((k) => {
    const numMatch = k.match(/^act(\d+)/);
    const num = numMatch ? numMatch[1] : "";
    const modIds = state.acts[k] || [];
    const firstMod = modIds.length > 0 ? state.modules.find((m) => m.id === modIds[0]) : null;
    return firstMod?.title || `Act ${num}`;
  });

  // Layout phases
  layoutActs(state, actKeys, actLabels, ctx, startId);
  layoutBranches(state, ctx);
  layoutServingLoop(state, ctx);
  layoutFinale(state, ctx);

  // End node
  const endId = "node_end";
  nodes.push({ id: endId, type: "end", position: { x: 400, y: ctx.y }, data: { label: "END" } });
  if (ctx.prevId) edges.push({ id: `edge_${ctx.prevId}_end`, source: ctx.prevId, target: endId });

  // Daily triggers (placed on the right side)
  layoutDailyTriggers(state, actKeys, ctx);

  return { nodes, edges };
}
