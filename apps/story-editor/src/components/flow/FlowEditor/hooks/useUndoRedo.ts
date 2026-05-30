/** Undo/redo history for ReactFlow. */

import { useState, useEffect, useRef } from "react";
import type { Node, Edge } from "@xyflow/react";
import { useFlowStore } from "../../../../store/flowStore.js";

const MAX_HISTORY = 60;

interface Snapshot { nodes: any[]; edges: any[]; }

export function useUndoRedo(
  nodes: any[],
  edges: any[],
  setNodes: (updater: any) => void,
  setEdges: (updater: any) => void,
) {
  const store = useFlowStore();
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const snapshotRef = useRef<Snapshot>({ nodes: [], edges: [] });

  // Track state for snapshot
  useEffect(() => {
    snapshotRef.current = { nodes, edges };
  }, [nodes, edges]);

  // Keyboard handlers
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "z") { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === "y") { e.preventDefault(); redo(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [historyIdx, history, nodes, edges]);

  function saveSnapshot() {
    const snap: Snapshot = { nodes: [...snapshotRef.current.nodes], edges: [...snapshotRef.current.edges] };
    setHistory((h) => {
      const trimmed = h.slice(0, historyIdx + 1);
      if (trimmed.length >= MAX_HISTORY) trimmed.shift();
      return [...trimmed, snap];
    });
    setHistoryIdx((i) => Math.min(i + 1, MAX_HISTORY - 1));
  }

  function undo() {
    if (historyIdx < 0) return;
    const current: Snapshot = { nodes: [...nodes], edges: [...edges] };
    const target = history[historyIdx];
    setHistory((h) => { const copy = [...h]; copy[historyIdx] = current; return copy; });
    setHistoryIdx((i) => i - 1);
    setNodes(target.nodes);
    setEdges(target.edges);
    store.updateNodes(target.nodes as any);
    store.updateEdges(target.edges as any);
    snapshotRef.current = { nodes: target.nodes, edges: target.edges };
  }

  function redo() {
    if (historyIdx >= history.length - 1) return;
    const targetIdx = historyIdx + 1;
    const target = history[targetIdx];
    setHistoryIdx(targetIdx);
    setNodes(target.nodes);
    setEdges(target.edges);
    store.updateNodes(target.nodes as any);
    store.updateEdges(target.edges as any);
    snapshotRef.current = { nodes: target.nodes, edges: target.edges };
  }

  return { saveSnapshot, undo, redo, history, historyIdx };
}
