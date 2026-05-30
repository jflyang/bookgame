import { create } from "zustand";
import type { FlowNode, FlowEdge } from "../lib/flowTypes.js";
import type { StoryModule, FlowDefinition } from "@story-game/shared";
import { flowToEditorState, editorStateToFlow } from "../lib/flowAdapter.js";
import { autoLayout } from "../lib/flowLayout.js";
import { serializeFlowData } from "../lib/flowSerializer.js";

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
    return serializeFlowData(nodes, edges, modules, flowId, flowTitle);
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
    const { nodes } = get();

    const NODE_W = 200;
    const NODE_H = 80;
    const H_GAP = 60;
    const V_GAP = 100;
    const ACT_PAD = 50;

    const groupIds = nodes.filter((n) => n.type === "phaseGroup" || n.type === "loop").map((n) => n.id);
    const updatedNodes = [...nodes];

    if (groupIds.length > 0) {
      // Has groups: evenly space children within each group
      for (const gid of groupIds) {
        const children = updatedNodes
          .filter((n) => n.parentId === gid && (n.type === "module" || n.type === "choice" || n.type === "judgment" || n.type === "eventTrigger" || n.type === "randomEvent"))
          .sort((a, b) => a.position.x - b.position.x);

        if (children.length === 0) continue;

        const startX = ACT_PAD;
        const y = children[0].position.y;
        children.forEach((child, i) => {
          const idx = updatedNodes.findIndex((n) => n.id === child.id);
          if (idx >= 0) {
            updatedNodes[idx] = { ...updatedNodes[idx], position: { x: startX + i * (NODE_W + H_GAP), y } };
          }
        });

        const groupIdx = updatedNodes.findIndex((n) => n.id === gid);
        if (groupIdx >= 0) {
          const totalW = children.length * NODE_W + (children.length - 1) * H_GAP + ACT_PAD * 2;
          const currentStyle = updatedNodes[groupIdx].style || {};
          updatedNodes[groupIdx] = { ...updatedNodes[groupIdx], style: { ...currentStyle, width: totalW } };
        }
      }
    } else {
      // Flat structure (no groups): arrange all module/choice nodes vertically
      const contentNodes = updatedNodes
        .filter((n) => n.type === "module" || n.type === "choice")
        .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);

      let y = 100;
      contentNodes.forEach((node) => {
        const idx = updatedNodes.findIndex((n) => n.id === node.id);
        if (idx >= 0) {
          updatedNodes[idx] = { ...updatedNodes[idx], position: { x: 340, y } };
          y += NODE_H + V_GAP;
        }
      });

      // Position start node at top
      const startIdx = updatedNodes.findIndex((n) => n.type === "start");
      if (startIdx >= 0) updatedNodes[startIdx] = { ...updatedNodes[startIdx], position: { x: 400, y: 10 } };

      // Position end node at bottom
      const endIdx = updatedNodes.findIndex((n) => n.type === "end");
      if (endIdx >= 0) updatedNodes[endIdx] = { ...updatedNodes[endIdx], position: { x: 400, y } };
    }

    set({ nodes: updatedNodes as any });
  },
}));
