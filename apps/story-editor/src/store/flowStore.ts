import { create } from "zustand";
import type { FlowNode, FlowEdge } from "../lib/flowTypes.js";
import type { StoryModule, FlowDefinition, FlowServingLoop } from "@story-game/shared";
import { flowToEditorState, editorStateToFlow } from "../lib/flowAdapter.js";
import { autoLayout } from "../lib/flowLayout.js";

interface FlowStore {
  nodes: FlowNode[];
  edges: FlowEdge[];
  flowId: string;
  flowTitle: string;
  modules: StoryModule[];
  initialized: boolean;

  initFromData: (flow: FlowDefinition, modules: StoryModule[]) => void;
  initFromNodesEdges: (nodes: FlowNode[], edges: FlowEdge[], modules: StoryModule[], flowId: string, flowTitle: string) => void;
  updateNode: (nodeId: string, data: Partial<FlowNode["data"]>) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  setNodeParent: (nodeId: string, parentId: string | undefined) => void;
  updateNodes: (nodes: FlowNode[]) => void;
  updateEdges: (edges: FlowEdge[]) => void;
  addNode: (node: FlowNode) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: FlowEdge) => void;
  removeEdge: (edgeId: string) => void;
  getFlowData: () => { flow: FlowDefinition; modules: StoryModule[] };
  updateModule: (moduleId: string, data: Partial<StoryModule>) => void;
  relayout: () => void;
}

export const useFlowStore = create<FlowStore>((set, get) => ({
  nodes: [],
  edges: [],
  flowId: "",
  flowTitle: "",
  modules: [],
  initialized: false,

  initFromData(flow, modules) {
    const state = flowToEditorState(flow, modules);
    const { nodes, edges } = autoLayout(state);
    set({
      flowId: flow.id,
      flowTitle: flow.title,
      modules,
      nodes: nodes as any,
      edges: edges as any,
      initialized: true,
    });
  },

  initFromNodesEdges(rfNodes, rfEdges, modules, flowId, flowTitle) {
    // Use pre-built ReactFlow nodes/edges directly (from flow.json)
    // No autoLayout — preserves manual positions and connections
    set({
      flowId,
      flowTitle,
      modules,
      nodes: rfNodes as any,
      edges: rfEdges as any,
      initialized: true,
    });
  },

  updateNode(nodeId, data) {
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)) as FlowNode[],
    }));
  },

  updateNodePosition(nodeId, position) {
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, position } : n)) as FlowNode[],
    }));
  },

  setNodeParent(nodeId, parentId) {
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        if (parentId) return { ...n, parentId, extent: "parent" as const };
        const { parentId: _, extent: __, ...rest } = n as any;
        return rest as FlowNode;
      }) as FlowNode[],
    }));
  },

  updateNodes(nodes) {
    set({ nodes: nodes as FlowNode[] });
  },

  updateEdges(edges) {
    set({ edges: edges as FlowEdge[] });
  },

  addNode(node) {
    set((s) => ({ nodes: [...s.nodes, node] as FlowNode[] }));
  },

  removeNode(nodeId) {
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== nodeId) as FlowNode[],
      edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId) as FlowEdge[],
    }));
  },

  addEdge(edge) {
    set((s) => ({ edges: [...s.edges, edge] as FlowEdge[] }));
  },

  removeEdge(edgeId) {
    set((s) => ({ edges: s.edges.filter((e) => e.id !== edgeId) as FlowEdge[] }));
  },

  getFlowData() {
    const { flowId, flowTitle, nodes, edges, modules } = get();
    // Reconstruct acts from node connections
    const acts: Record<string, string[]> = {};
    const finaleSequence: string[] = [];
    let servingLoop: FlowServingLoop | null = null;

    // Find phase group nodes and their children
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const groupNodes = nodes.filter((n) => n.type === "phaseGroup");
    const loopNode = nodes.find((n) => n.type === "loop");

    groupNodes.forEach((g) => {
      const children = nodes.filter((n) => n.parentId === g.id && (n.type === "module" || n.type === "choice"));
      const actKey = g.data.actKey || g.id;
      if (actKey === "finale") {
        children.sort((a, b) => a.position.x - b.position.x);
        children.forEach((c) => {
          if (c.data.moduleRef) finaleSequence.push(c.data.moduleRef);
        });
      } else {
        children.sort((a, b) => a.position.x - b.position.x);
        acts[actKey] = children.map((c) => c.data.moduleRef || c.id).filter(Boolean);
      }
    });

    // ═══════════════════════════════════════════
    // Reconstruct serving loop FROM EDGES
    // Edges are the source of truth for cycle flow
    // ═══════════════════════════════════════════
    if (loopNode) {
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

      // Map punishes: check edges — if a punish module is connected FROM judgment branch_1,
      // find which cycle's judgment it connects from
      // Default: match by position index
      punishModules.forEach((mod, i) => {
        // Look for edge: judgment sourceHandle="branch_1" → this module
        const punishEdge = edges.find((e) =>
          e.target === mod.id && e.sourceHandle === "branch_1"
        );
        if (punishEdge) {
          // Find which serve module feeds into this judgment
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
          // No edge — fall back to position-based assignment
          const key = i < punishModules.length - 1 ? String(i + 1) : "default";
          punishModuleByCycle[key] = mod.data.moduleRef || mod.id;
        }
      });

      // Also check for modules connected to judgment branch_1 that aren't in loopChildren
      // (user might have connected to modules outside the loop container)
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

      // Merge data from the first judgment node on canvas
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

      servingLoop = {
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

    // Extract daily triggers from current nodes
    const dailyTriggers = nodes
      .filter((n) => n.type === "dailyTrigger" && n.data.moduleRef)
      .map((n) => ({ module: n.data.moduleRef!, trigger: n.data.triggerRule || "" }));

    const state = {
      modules,
      acts,
      servingLoop,
      finaleSequence,
      dailyTriggers,
    };

    return editorStateToFlow(state, flowId, flowTitle);
  },

  updateModule(moduleId, data) {
    set((s) => {
      const modules = s.modules.map((m) =>
        m.id === moduleId ? { ...m, ...data } as StoryModule : m
      );
      // Sync title/label to all nodes referencing this module
      const nodes = s.nodes.map((n) => {
        if (n.data.moduleRef === moduleId && data.title) {
          return { ...n, data: { ...n.data, label: data.title } };
        }
        return n;
      });
      return { modules, nodes: nodes as FlowNode[] };
    });
  },

  relayout() {
    const { modules, nodes } = get();
    // Rebuild state from current nodes
    const acts: Record<string, string[]> = {};
    const groupNodes = nodes.filter((n) => n.type === "phaseGroup");
    groupNodes.forEach((g) => {
      const children = nodes.filter((n) => n.parentId === g.id && (n.type === "module" || n.type === "choice"));
      children.sort((a, b) => a.position.x - b.position.x);
      const actKey = g.data.actKey || g.id;
      if (actKey !== "finale") {
        acts[actKey] = children.map((c) => c.data.moduleRef || c.id).filter(Boolean);
      }
    });

    const loopNode = nodes.find((n) => n.type === "loop");
    const finaleChildren = nodes.filter((n) => n.parentId && nodes.find((p) => p.id === n.parentId)?.data.actKey === "finale");
    finaleChildren.sort((a, b) => a.position.x - b.position.x);

    // Extract daily triggers from current nodes
    const dailyTriggers = nodes
      .filter((n) => n.type === "dailyTrigger" && n.data.moduleRef)
      .map((n) => ({ module: n.data.moduleRef!, trigger: n.data.triggerRule || "" }));

    const state = {
      modules,
      acts,
      servingLoop: loopNode?.data.loopData || null,
      finaleSequence: finaleChildren.map((c) => c.data.moduleRef || "").filter(Boolean),
      dailyTriggers,
    };

    const layout = autoLayout(state);
    set({ nodes: layout.nodes as any, edges: layout.edges as any });
  },
}));
