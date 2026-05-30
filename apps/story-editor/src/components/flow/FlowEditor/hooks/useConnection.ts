import { useCallback, useRef } from "react";
import { addEdge, type Connection, type Edge } from "@xyflow/react";
import { useFlowStore } from "../../../../store/flowStore.js";
import type { FlowNodeData } from "../../../../lib/flowTypes.js";

type RFNode = { id: string; type?: string; data: FlowNodeData; parentId?: string; position: { x: number; y: number }; [key: string]: unknown };

/**
 * Hook that encapsulates all connection-related logic for FlowEditor:
 * - onConnect: handle new connections (with reorder support)
 * - isValidConnection: validate connection attempts
 * - onReconnect: handle edge reconnection (with reorder support)
 * - handleEdgesChange: sync edge removals to store
 */
export function useConnection(
  nodes: RFNode[],
  setEdges: (updater: (eds: Edge[]) => Edge[]) => void,
  onEdgesChange: (changes: any[]) => void,
  saveSnapshot: () => void,
) {
  const store = useFlowStore();

  // Track whether a reconnect successfully connected to a new target
  const reconnectSuccessful = useRef(false);

  /**
   * When a connection is made between two sibling nodes in the same phaseGroup,
   * reorder the source node to be positioned just before the target node.
   * This enables "drag edge endpoint to reorder" workflow.
   */
  const reorderIfSiblings = useCallback((sourceId: string, targetId: string) => {
    const sourceNode = nodes.find((n) => n.id === sourceId);
    const targetNode = nodes.find((n) => n.id === targetId);

    if (!sourceNode || !targetNode) return;
    if (!sourceNode.parentId || sourceNode.parentId !== targetNode.parentId) return;

    // Both are in the same phaseGroup — reorder by adjusting x positions
    // Get all siblings in this group, sorted by current x
    const siblings = nodes
      .filter((n) => n.parentId === sourceNode.parentId && (n.type === "module" || n.type === "choice"))
      .sort((a, b) => a.position.x - b.position.x);

    const sourceIdx = siblings.findIndex((n) => n.id === sourceId);
    const targetIdx = siblings.findIndex((n) => n.id === targetId);

    if (sourceIdx === -1 || targetIdx === -1 || sourceIdx === targetIdx) return;

    // Move source to just before target
    const reordered = [...siblings];
    reordered.splice(sourceIdx, 1);
    const insertIdx = targetIdx > sourceIdx ? targetIdx - 1 : targetIdx;
    reordered.splice(insertIdx, 0, siblings[sourceIdx]);

    // Reassign x positions evenly (keeping same y)
    const startX = siblings[0].position.x;
    const gap = siblings.length > 1
      ? (siblings[siblings.length - 1].position.x - siblings[0].position.x) / (siblings.length - 1)
      : 260; // NODE_W + H_GAP

    reordered.forEach((node, i) => {
      const newX = startX + i * gap;
      if (node.position.x !== newX) {
        store.updateNodePosition(node.id, { x: newX, y: node.position.y });
      }
    });
  }, [nodes, store]);

  const onConnect = useCallback((params: Connection) => {
    saveSnapshot();
    const eid = `edge_${params.source}_${params.target}_${Date.now()}`;
    setEdges((eds) => addEdge({
      ...params,
      id: eid,
      type: "colored",
      style: { stroke: "var(--text-muted)", strokeWidth: 2 },
    }, eds));
    store.addEdge({
      id: eid,
      source: params.source!, target: params.target!,
      sourceHandle: params.sourceHandle || undefined,
      targetHandle: params.targetHandle || undefined,
    } as any);

    // Check if this is a reorder operation (connecting siblings in same group)
    if (params.source && params.target) {
      reorderIfSiblings(params.source, params.target);
    }
  }, [setEdges, store, saveSnapshot, reorderIfSiblings]);

  const isValidConnection = useCallback((conn: Connection | Edge) => {
    if (conn.source === conn.target) return false;
    const sourceNode = nodes.find((n) => n.id === conn.source);
    if (sourceNode?.type === "end") return false;
    const targetNode = nodes.find((n) => n.id === conn.target);
    if (targetNode?.type === "start") return false;
    return true;
  }, [nodes]);

  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    reconnectSuccessful.current = true;
    saveSnapshot();
    setEdges((eds) => eds.map((e) => {
      if (e.id !== oldEdge.id) return e;
      return {
        ...e,
        source: newConnection.source || e.source,
        target: newConnection.target || e.target,
        sourceHandle: newConnection.sourceHandle || undefined,
        targetHandle: newConnection.targetHandle || undefined,
      };
    }));
    store.removeEdge(oldEdge.id);
    store.addEdge({
      id: oldEdge.id,
      source: newConnection.source || oldEdge.source,
      target: newConnection.target || oldEdge.target,
      sourceHandle: newConnection.sourceHandle || undefined,
      targetHandle: newConnection.targetHandle || undefined,
    } as any);

    // Check if reconnection implies a reorder
    const newSource = newConnection.source || oldEdge.source;
    const newTarget = newConnection.target || oldEdge.target;
    if (newSource && newTarget) {
      reorderIfSiblings(newSource, newTarget);
    }
  }, [setEdges, store, saveSnapshot, reorderIfSiblings]);

  const handleEdgesChange = useCallback((changes: any[]) => {
    onEdgesChange(changes);
    for (const change of changes) {
      if (change.type === "remove") store.removeEdge(change.id);
    }
  }, [onEdgesChange, store]);

  const onReconnectStart = useCallback(() => {
    reconnectSuccessful.current = false;
  }, []);

  const onReconnectEnd = useCallback((_event: MouseEvent | TouchEvent, edge: Edge) => {
    if (!reconnectSuccessful.current) {
      // Dragged to empty space — delete the edge
      saveSnapshot();
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      store.removeEdge(edge.id);
    }
  }, [setEdges, store, saveSnapshot]);

  return { onConnect, isValidConnection, onReconnect, onReconnectStart, onReconnectEnd, handleEdgesChange };
}
