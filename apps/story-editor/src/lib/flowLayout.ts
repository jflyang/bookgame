import type { FlowNode, FlowEdge, FlowEditorState } from "./flowTypes.js";

// Auto-layout: simple layered layout
// Linear phases go left-to-right, acts go top-to-bottom
// Serving loop in center, finale on right

const NODE_W = 200;
const NODE_H = 80;
const H_GAP = 60;   // horizontal gap between nodes
const V_GAP = 100;   // vertical gap between acts
const ACT_PAD = 50;  // padding inside act groups

export function autoLayout(state: FlowEditorState): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  let y = 80;

  // Start node
  const startId = "node_start";
  nodes.push({
    id: startId, type: "start", position: { x: 400, y: 10 },
    data: { label: "START" },
  });
  let prevId = startId;

  // Act groups — use whatever acts are defined in the flow
  const actKeys = Object.keys(state.acts);
  const actLabels = actKeys.map((k) => {
    // Try to extract act number from key like "act1_intro" → "第一幕", "act2_main" → "第二幕"
    const numMatch = k.match(/^act(\d+)/);
    const num = numMatch ? numMatch[1] : "";
    // Look up the phase title from the modules if available
    const modIds = state.acts[k] || [];
    const firstMod = modIds.length > 0 ? state.modules.find((m) => m.id === modIds[0]) : null;
    return firstMod?.title || `Act ${num}`;
  });

  actKeys.forEach((actKey, ai) => {
    const modIds = state.acts[actKey] || [];
    if (modIds.length === 0) return;

    // Phase group node (container)
    const groupId = `node_group_${actKey}`;
    const totalW = modIds.length * NODE_W + (modIds.length - 1) * H_GAP + ACT_PAD * 2;
    nodes.push({
      id: groupId, type: "phaseGroup",
      position: { x: 40, y },
      data: { label: actLabels[ai] || actKey, actKey },
      style: { width: totalW, height: NODE_H + ACT_PAD * 2 + 30 },
    });

    // Module nodes inside
    let x = 40 + ACT_PAD;
    modIds.forEach((modId, mi) => {
      const mod = state.modules.find((m) => m.id === modId);
      const nodeId = `node_${modId}`;
      const isChoice = mod?.type === "choice";
      const nodeType = isChoice ? "choice" : "module";

      const nodeData: any = {
        label: mod?.title || modId,
        moduleRef: modId,
        moduleData: mod,
        colorKey: mod?.type || "training",
      };

      if (isChoice) {
        // Build branches from afterAll context
        const afterAll = state.actAfterAll?.[actKey];
        nodeData.branches = [
          { choiceText: "服从路线", targetStage: afterAll || "", description: "默认路径" },
          { choiceText: "抵抗路线", targetStage: "", description: "选择抵抗" },
        ];
      }

      nodes.push({
        id: nodeId, type: nodeType,
        position: { x, y: y + ACT_PAD + 15 },
        data: nodeData,
        parentId: groupId,
        extent: "parent",
      });

      // Edge between module nodes (intra-act only)
      if (mi > 0) {
        const prevModId = modIds[mi - 1];
        const prevNodeId = `node_${prevModId}`;
        edges.push({ id: `edge_${prevNodeId}_${nodeId}`, source: prevNodeId, target: nodeId });
      }
      // Track last node of each act (for serving loop / finale connections)
      if (mi === modIds.length - 1) {
        prevId = nodeId;
      }
      x += NODE_W + H_GAP;
    });

    // Edge from start to first act
    if (ai === 0) {
      const firstNodeId = `node_${modIds[0]}`;
      edges.push({ id: `edge_start_${firstNodeId}`, source: startId, target: firstNodeId });
    }

    y += NODE_H + ACT_PAD * 2 + 30 + V_GAP;
  });

  // ═══════════════════════════════════════════════════════════
  // Inter-act connections — use afterAll for routing
  // ═══════════════════════════════════════════════════════════
  const actKeysList = Object.keys(state.acts);
  const actLastNodes: Record<string, string> = {};   // actKey → last nodeId
  const actFirstNodes: Record<string, string> = {};  // actKey → first nodeId

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
      // ── Choice branching ──
      // branch_0 → afterAll target
      // branch_1 → next act that isn't the afterAll target
      const branches: { targetKey: string; handleId: string; label: string }[] = [];

      if (afterAll && actFirstNodes[afterAll]) {
        branches.push({ targetKey: afterAll, handleId: "branch_0", label: "服从路线" });
      }

      // Find alternative branch: next act in order that isn't the afterAll target
      for (let j = i + 1; j < actKeysList.length; j++) {
        const altKey = actKeysList[j];
        if (altKey !== afterAll && actFirstNodes[altKey]) {
          branches.push({ targetKey: altKey, handleId: "branch_1", label: "抵抗路线" });
          break;
        }
      }

      // If no alternative found, try previous acts too
      if (branches.length < 2) {
        for (let j = 0; j < actKeysList.length; j++) {
          const altKey = actKeysList[j];
          if (altKey !== curKey && !branches.find((b) => b.targetKey === altKey) && actFirstNodes[altKey]) {
            branches.push({ targetKey: altKey, handleId: `branch_${branches.length}`, label: `路线 ${branches.length + 1}` });
            if (branches.length >= 2) break;
          }
        }
      }

      // Create branch edges
      branches.forEach((b) => {
        const existingEdge = edges.find((e) =>
          e.source === lastNodeId && e.target === actFirstNodes[b.targetKey]
        );
        if (!existingEdge && lastNodeId !== actFirstNodes[b.targetKey]) {
          edges.push({
            id: `edge_choice_${curKey}_to_${b.targetKey}`,
            source: lastNodeId, target: actFirstNodes[b.targetKey],
            sourceHandle: b.handleId,
            label: b.label,
          });
        }
      });
    } else {
      // ── Linear inter-act: connect to afterAll target, or next act ──
      const targetKey = afterAll || (i + 1 < actKeysList.length ? actKeysList[i + 1] : null);
      if (targetKey && actFirstNodes[targetKey] && lastNodeId !== actFirstNodes[targetKey]) {
        const existingEdge = edges.find((e) =>
          e.source === lastNodeId && e.target === actFirstNodes[targetKey]
        );
        if (!existingEdge) {
          edges.push({
            id: `edge_act_${curKey}_to_${targetKey}`,
            source: lastNodeId, target: actFirstNodes[targetKey],
          });
        }
      }
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Serving loop — per-cycle horizontal flow:
  //   Serve → [EventTrigger] → [Judgment:是/否]
  //     → 是 → next cycle's Serve (skip punish)
  //     → 否 → [RandomEvent:惩戒池] → back to THIS cycle's Serve
  // ═══════════════════════════════════════════════════════════
  if (state.servingLoop) {
    const loopId = "node_serving_loop";
    const loop = state.servingLoop;
    const serveKeys = ["1", "2", "3", "4", "default"].filter((k) => loop.serveModuleByCycle[k]);
    const cycleCount = serveKeys.length;

    const COL_W = 220;          // width per node column
    const COL_GAP = 40;         // gap between columns
    const loopW = cycleCount * COL_W * 4 + (cycleCount - 1) * COL_GAP + ACT_PAD * 2;
    const loopH = 260;

    nodes.push({
      id: loopId, type: "loop",
      position: { x: 40, y },
      data: { label: loop.title || "侍寝循环", loopData: loop },
      style: { width: Math.max(loopW, 600), height: loopH },
    });

    const cycleJudgmentIds: string[] = [];
    const cycleServeIds: string[] = [];
    let colIndex = 0;

    serveKeys.forEach((key) => {
      const serveModId = loop.serveModuleByCycle[key];
      const punishModId = loop.punishModuleByCycle[key];
      if (!serveModId) return;

      const isDefault = key === "default";
      const serveMod = state.modules.find((m) => m.id === serveModId);
      const punishMod = state.modules.find((m) => m.id === punishModId);
      const baseX = 40 + ACT_PAD + colIndex * (COL_W * 4 + COL_GAP);

      const serveY = y + 15;
      const eventY = y + 15;
      const judgeY = y + 15;
      const punishY = y + 155;

      // --- Serve module ---
      const serveNodeId = `node_${serveModId}`;
      const labelPrefix = isDefault ? "默认侍寝" : `第${key}轮侍寝`;
      nodes.push({
        id: serveNodeId, type: "module",
        position: { x: baseX, y: serveY },
        data: {
          label: `${labelPrefix}: ${serveMod?.title || serveModId}`,
          moduleRef: serveModId, moduleData: serveMod,
          colorKey: "serving",
        },
        parentId: loopId, extent: "parent",
        style: { width: COL_W },
      });
      cycleServeIds.push(serveNodeId);

      // --- Event trigger (between serve and judgment) ---
      const eventId = `node_event_cycle_${key}`;
      const demands: Record<string, { label: string; desc: string }> = {
        "1": { label: "禁止高潮", desc: "帝王铁律：侍寝全程禁止高潮，违者重罚" },
        "2": { label: "同意口交", desc: "帝王要求：屈膝跪地，以口舌侍奉龙根" },
        "3": { label: "服从后入", desc: "帝王要求：趴伏于地，不得回头，接受后入临幸" },
        "4": { label: "羞耻称谓", desc: "帝王要求：自称「贱婢」「奴家」，每句必称陛下" },
        "default": { label: "终极服从", desc: "帝王要求：无条件绝对服从，不得有任何抗拒" },
      };
      const demand = demands[key] || { label: "帝王指令", desc: `帝王要求：第${key}项考验` };
      nodes.push({
        id: eventId, type: "eventTrigger",
        position: { x: baseX + COL_W + COL_GAP, y: eventY },
        data: {
          label: demand.label,
          eventDescription: demand.desc,
          colorKey: "judgment",
        },
        parentId: loopId, extent: "parent",
        style: { width: COL_W },
      });

      // Edge: Serve → Event
      edges.push({
        id: `edge_serve_${key}_event`,
        source: serveNodeId, target: eventId,
        label: "侍寝中",
      });

      // --- Judgment node (是/否) ---
      const judgeId = `node_judge_cycle_${key}`;
      const yesLabel = key === "1" ? "忍住了" : "同意";
      const noLabel = key === "1" ? "没忍住" : "拒绝";
      nodes.push({
        id: judgeId, type: "judgment",
        position: { x: baseX + COL_W * 2 + COL_GAP * 2, y: judgeY },
        data: {
          label: key === "1" ? "忍住了?" : "服从?",
          branches: [
            { choiceText: yesLabel, targetStage: "next_cycle", description: "通过→下一轮" },
            { choiceText: noLabel, targetStage: "punish_pool", description: "失败→惩戒" },
          ],
          colorKey: "judgment",
        },
        parentId: loopId, extent: "parent",
        style: { width: COL_W },
      });
      cycleJudgmentIds.push(judgeId);

      // Edge: Event → Judgment
      edges.push({
        id: `edge_event_${key}_judge`,
        source: eventId, target: judgeId,
      });

      // --- Random event (punishment pool) ---
      const randomId = `node_random_cycle_${key}`;
      nodes.push({
        id: randomId, type: "randomEvent",
        position: { x: baseX + COL_W * 2 + COL_GAP * 2, y: punishY },
        data: {
          label: "随机惩戒",
          randomPool: [
            { id: "mod_stage_22", title: "三塞悬吊" },
            { id: "mod_stage_24", title: "双龙边缘" },
            { id: "mod_stage_27", title: "媚药煎熬" },
            { id: "mod_stage_28", title: "多重惩罚套餐" },
            { id: "mod_stage_30", title: "终极全具强制" },
          ],
          colorKey: "punishment",
        },
        parentId: loopId, extent: "parent",
        style: { width: COL_W },
      });

      // Edge: Judgment(否) → Random event
      edges.push({
        id: `edge_judge_no_${key}_random`,
        source: judgeId, target: randomId,
        sourceHandle: "branch_1",
        label: noLabel,
        style: { stroke: "#ef4444" },
      });

      // Edge: Random event → back to THIS cycle's serve (loop back)
      edges.push({
        id: `edge_random_${key}_back`,
        source: randomId, target: serveNodeId,
        label: "惩戒完毕",
        style: { stroke: "#f97316" },
      });

      // Edge: Judgment(是) → next cycle's serve
      // (done below, after all cycles are created)

      colIndex++;
    });

    // Connect Judgment(是) → next cycle's Serve
    for (let i = 0; i < cycleJudgmentIds.length - 1; i++) {
      const nextServeId = cycleServeIds[i + 1];
      edges.push({
        id: `edge_judge_yes_${serveKeys[i]}_to_${serveKeys[i + 1]}`,
        source: cycleJudgmentIds[i], target: nextServeId,
        sourceHandle: "branch_0",
        label: i === 0 ? "忍住了" : "同意",
        style: { stroke: "#22c55e" },
      });
    }

    // Connect from last act to first serve
    if (prevId && cycleServeIds.length > 0) {
      edges.push({
        id: `edge_prev_to_loop`,
        source: prevId, target: cycleServeIds[0],
        label: "进入侍寝循环",
      });
    }

    // Store judgment ids for finale satisfied connection
    state._loopChoiceNodes = cycleJudgmentIds;
    prevId = cycleServeIds[cycleServeIds.length - 1] || prevId;
    y += loopH + V_GAP;
  }

  // Connect last act to finale (or END)
  let lastActEndId = prevId;  // prevId = last module of last act

  // Finale sequence
  if (state.finaleSequence && state.finaleSequence.length > 0) {
    const finaleGroupId = "node_group_finale";
    const totalW = state.finaleSequence.length * NODE_W + (state.finaleSequence.length - 1) * H_GAP + ACT_PAD * 2;
    nodes.push({
      id: finaleGroupId, type: "phaseGroup",
      position: { x: 40, y },
      data: { label: "终幕", actKey: "finale" },
      style: { width: totalW, height: NODE_H + ACT_PAD * 2 + 30 },
    });

    // Edge from last act → first finale module
    if (lastActEndId && state.finaleSequence.length > 0) {
      const firstFinaleId = `node_${state.finaleSequence[0]}`;
      if (lastActEndId !== firstFinaleId) {
        edges.push({
          id: `edge_act_to_finale`,
          source: lastActEndId, target: firstFinaleId,
          label: "进入终幕",
        });
      }
    }

    let fx = 40 + ACT_PAD;
    const fy = y + ACT_PAD + 15;
    state.finaleSequence.forEach((modId, fi) => {
      const mod = state.modules.find((m) => m.id === modId);
      const nodeId = `node_${modId}`;
      nodes.push({
        id: nodeId, type: "module",
        position: { x: fx, y: fy },
        data: {
          label: mod?.title || modId,
          moduleRef: modId, moduleData: mod,
          colorKey: "finale",
        },
        parentId: finaleGroupId, extent: "parent",
      });
      if (fi > 0) {
        edges.push({
          id: `edge_finale_${fi}`, source: `node_${state.finaleSequence![fi - 1]}`, target: nodeId,
        });
      }
      if (fi === state.finaleSequence!.length - 1) prevId = nodeId;
      fx += NODE_W + H_GAP;
    });

    // Connect last cycle's judgment (是/handle branch_0) → first finale module
    // Earlier cycles' "是" already go to next cycle's serve
    if (state._loopChoiceNodes && state._loopChoiceNodes.length > 0 && state.finaleSequence.length > 0) {
      const lastJudgeId = state._loopChoiceNodes[state._loopChoiceNodes.length - 1];
      const finaleFirstId = `node_${state.finaleSequence[0]}`;
      edges.push({
        id: `edge_final_yes_finale`,
        source: lastJudgeId,
        sourceHandle: "branch_0",
        target: finaleFirstId,
        label: "全部通过",
        data: { routeKey: "satisfied" },
        style: { stroke: "#22c55e" },
      });
    }

    y += NODE_H + ACT_PAD * 2 + 30 + V_GAP;
  }

  // End node
  const endId = "node_end";
  nodes.push({
    id: endId, type: "end", position: { x: 400, y },
    data: { label: "END" },
  });
  if (prevId) {
    edges.push({ id: `edge_${prevId}_end`, source: prevId, target: endId });
  }

  // Daily trigger nodes — placed in a column on the far right, clear of all flow content
  if (state.dailyTriggers && state.dailyTriggers.length > 0) {
    // Compute the rightmost extent of all existing nodes
    let maxRight = 0;
    for (const n of nodes) {
      const right = n.position.x + (n.style?.width ? (typeof n.style.width === "number" ? n.style.width : parseInt(String(n.style.width), 10) || 200) : 200);
      if (right > maxRight) maxRight = right;
    }
    const dailyX = maxRight + 120;
    let dy = 120;

    state.dailyTriggers.forEach((dt) => {
      const mod = state.modules.find((m) => m.id === dt.module);
      const nodeId = `daily_${dt.module}`;
      nodes.push({
        id: nodeId, type: "dailyTrigger",
        position: { x: dailyX, y: dy },
        data: {
          label: mod?.title || dt.module,
          moduleRef: dt.module,
          moduleData: mod,
          triggerRule: dt.trigger,
        },
      });

      // Determine which act this daily activates from
      // Default to the first phase group if no trigger match
      const trigger = dt.trigger;
      let sourceGroupId: string | null = actKeys.length > 0 ? `node_group_${actKeys[0]}` : null;
      if (trigger.includes("惩戒") && actKeys.length >= 3) {
        sourceGroupId = `node_group_${actKeys[2]}`;  // 3rd act = punishment
      }

      if (sourceGroupId) {
        edges.push({
          id: `edge_daily_${sourceGroupId}_${nodeId}`,
          source: sourceGroupId,
          target: nodeId,
          label: dt.trigger.slice(0, 20),
          style: { strokeDasharray: "5 5", stroke: "#9ca3af" },
        });
      }

      dy += 80;
    });
  }

  return { nodes, edges };
}
