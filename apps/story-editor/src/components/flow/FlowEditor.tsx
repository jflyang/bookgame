import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import {
  ReactFlow, Background, Controls, MiniMap, ReactFlowProvider,
  useNodesState, useEdgesState, useReactFlow,
  type Node, type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useFlowStore } from "../../store/flowStore.js";
import { nodeTypes } from "./nodeTypes.js";
import { edgeTypes } from "./ColoredEdge.js";
import { FlowToolbar } from "./FlowToolbar.js";
import { ModuleDetailPanel } from "./ModuleDetailPanel.js";
import { NodeContextMenu } from "./NodeContextMenu.js";
import { NodeEditModal } from "./NodeEditModal/index.js";
import { GameConsole } from "./GameConsole.js";
import { runStep, type ConsoleEntry, type ChoiceOption, type RunStatus } from "../../lib/flowRunner.js";
import type { FlowNodeData } from "../../lib/flowTypes.js";
import { useUndoRedo } from "./FlowEditor/hooks/useUndoRedo.js";
import { useConnection } from "./FlowEditor/hooks/useConnection.js";

let nextId = 0;
function uid() {
  return `node_new_${Date.now()}_${++nextId}`;
}

type RFNode = Node<FlowNodeData>;

function getTypeLabel(type: string): string {
  const map: Record<string, string> = {
    module: "故事模块", choice: "抉择点", judgment: "判定节点",
    eventTrigger: "事件触发", randomEvent: "随机事件", randomJudgment: "随机判断",
    loop: "循环", dailyTrigger: "日常触发",
  };
  return map[type] || "节点";
}

// ─── Validation ───
interface ValidationIssue { nodeId?: string; edgeId?: string; message: string; severity: "warn" | "error"; }

function validateFlow(nodes: RFNode[], edges: Edge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const moduleNodes = nodes.filter((n) => n.type === "module");
  const judgeNodes = nodes.filter((n) => n.type === "judgment");

  // Modules without moduleRef (not bound to a real module)
  const orphanModules = moduleNodes.filter((n) => !n.data.moduleRef);
  if (orphanModules.length > 0) {
    issues.push({
      message: `${orphanModules.length} 个模块节点未绑定 moduleRef（双击绑定已有模块）`,
      severity: "warn",
    });
  }

  // Judgment nodes without any outgoing edge
  judgeNodes.forEach((j) => {
    const hasOut = edges.some((e) => e.source === j.id);
    if (!hasOut) {
      issues.push({ nodeId: j.id, message: `判定节点 "${j.data.label}" 没有输出连线`, severity: "warn" });
    }
  });

  // Orphan edges (source or target doesn't exist)
  edges.forEach((e) => {
    if (!nodes.find((n) => n.id === e.source)) {
      issues.push({ edgeId: e.id, message: `边 ${e.id} 的源节点不存在`, severity: "error" });
    }
    if (!nodes.find((n) => n.id === e.target)) {
      issues.push({ edgeId: e.id, message: `边 ${e.id} 的目标节点不存在`, severity: "error" });
    }
  });

  // Loop with no children
  const loopNodes = nodes.filter((n) => n.type === "loop");
  loopNodes.forEach((l) => {
    const children = nodes.filter((n) => n.parentId === l.id);
    if (children.length === 0) {
      issues.push({ nodeId: l.id, message: `循环 "${l.data.label}" 内没有子节点（把模块拖到循环框内）`, severity: "warn" });
    }
  });

  return issues;
}

function FlowEditorInner() {
  const store = useFlowStore();
  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [edgeCtxMenu, setEdgeCtxMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);

  // Edit modal state
  const [editModal, setEditModal] = useState<{ nodeId: string; nodeType: string; data: FlowNodeData } | null>(null);

  // Validation
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [showValidation, setShowValidation] = useState(false);

  // Runner state
  const [runLog, setRunLog] = useState<ConsoleEntry[]>([]);
  const [runChoices, setRunChoices] = useState<ChoiceOption[] | undefined>();
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [visitedNodeIds, setVisitedNodeIds] = useState<Set<string>>(new Set());
  const [consoleVisible, setConsoleVisible] = useState(false);

  // Sync store → ReactFlow state
  useEffect(() => {
    if (store.initialized) {
      setNodes(store.nodes as unknown as RFNode[]);
      setEdges(store.edges as unknown as Edge[]);
    }
  }, [store.initialized]);

  const { saveSnapshot, undo, redo } = useUndoRedo(nodes, edges, setNodes, setEdges);

  // B1: Connection logic extracted to hook
  const { onConnect, isValidConnection, onReconnect, onReconnectStart, onReconnectEnd, handleEdgesChange } = useConnection(
    nodes as any, setEdges, onEdgesChange, saveSnapshot
  );

  // ─── Drop from toolbar ───
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((event: DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/reactflow-type");
    if (!type || !reactFlowWrapper.current) return;

    saveSnapshot();
    const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const nodeId = uid();

    let parentId: string | undefined;
    const groupNodes = store.nodes.filter((n) => n.type === "loop" || n.type === "phaseGroup");
    for (const g of groupNodes) {
      const defaultW = g.type === "loop" ? 600 : 400;
      const defaultH = g.type === "loop" ? 300 : 160;
      const gw = typeof g.style?.width === "number" ? g.style.width : defaultW;
      const gh = typeof g.style?.height === "number" ? g.style.height : defaultH;
      if (
        flowPos.x >= g.position.x && flowPos.x <= g.position.x + gw &&
        flowPos.y >= g.position.y && flowPos.y <= g.position.y + gh
      ) {
        parentId = g.id;
        break;
      }
    }

    const newNode: RFNode = {
      id: nodeId,
      type,
      position: { x: flowPos.x - 100, y: flowPos.y - 30 },
      data: { label: `新${getTypeLabel(type)}` },
      ...(parentId ? { parentId, extent: "parent" as const } : {}),
    };

    store.addNode(newNode as any);
    setNodes((nds) => [...nds, newNode]);
  }, [store, setNodes, screenToFlowPosition]);

  // ─── Delete ───
  const onNodesDelete = useCallback((deletedNodes: RFNode[]) => {
    saveSnapshot();
    deletedNodes.forEach((n) => store.removeNode(n.id));
  }, [store]);

  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    saveSnapshot();
    deletedEdges.forEach((e) => store.removeEdge(e.id));
  }, [store]);

  // handleEdgesChange comes from useConnection hook

  // ─── Drag stop → persist position ───
  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: RFNode) => {
    saveSnapshot();
    store.updateNodePosition(node.id, node.position);
  }, [store]);

  // ─── Double-click → open edit modal or module detail ───
  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: RFNode) => {
    if ((node.type === "module" || node.type === "choice") && node.data.moduleRef) {
      setSelectedModuleId(node.data.moduleRef);
    } else if (node.type === "dailyTrigger" && node.data.moduleRef) {
      setSelectedModuleId(node.data.moduleRef);
    } else if (node.type === "start" || node.type === "end") {
      setEditModal({ nodeId: node.id, nodeType: node.type, data: { ...node.data } });
    } else {
      setEditModal({ nodeId: node.id, nodeType: node.type || "module", data: { ...node.data } });
    }
  }, []);

  // ─── Right-click → context menu ───
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: RFNode) => {
    event.preventDefault();
    setCtxMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    setEdgeCtxMenu(null);
  }, []);

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setEdgeCtxMenu({ x: event.clientX, y: event.clientY, edgeId: edge.id });
    setCtxMenu(null);
  }, []);

  // ─── Context menu actions ───
  function handleDuplicateNode() {
    if (!ctxMenu) return;
    saveSnapshot();
    const node = nodes.find((n) => n.id === ctxMenu.nodeId);
    if (!node) return;
    const newNode: RFNode = {
      ...node,
      id: uid(),
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      data: { ...node.data, label: `${node.data.label} (副本)` },
      selected: false,
    };
    store.addNode(newNode as any);
    setNodes((nds) => [...nds, newNode]);
    setCtxMenu(null);
  }

  function handleDeleteNode() {
    if (!ctxMenu) return;
    saveSnapshot();
    store.removeNode(ctxMenu.nodeId);
    setNodes((nds) => nds.filter((n) => n.id !== ctxMenu.nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== ctxMenu.nodeId && e.target !== ctxMenu.nodeId));
    setCtxMenu(null);
  }

  function handleEditNode() {
    if (!ctxMenu) return;
    const node = nodes.find((n) => n.id === ctxMenu.nodeId);
    if (!node) return;
    setEditModal({ nodeId: node.id, nodeType: node.type || "module", data: { ...node.data } });
    setCtxMenu(null);
  }

  function handleDeleteEdge() {
    if (!edgeCtxMenu) return;
    saveSnapshot();
    store.removeEdge(edgeCtxMenu.edgeId);
    setEdges((eds) => eds.filter((e) => e.id !== edgeCtxMenu.edgeId));
    setEdgeCtxMenu(null);
  }

  // ─── Edit modal save ───
  function handleEditSave(data: FlowNodeData) {
    if (!editModal) return;
    saveSnapshot();
    store.updateNode(editModal.nodeId, data);
    store.setNodeParent(editModal.nodeId, data.parentId as string | undefined);
    setNodes((nds) => nds.map((n) => {
      if (n.id !== editModal.nodeId) return n;
      const updated = { ...n, data: { ...n.data, ...data } };
      if (data.parentId) {
        (updated as any).parentId = data.parentId;
        (updated as any).extent = "parent";
      } else if (data.parentId === null && n.parentId) {
        delete (updated as any).parentId;
        delete (updated as any).extent;
      }
      return updated;
    }));
    setEditModal(null);
  }

  // ─── Edge double-click → edit label ───
  const onEdgeDoubleClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    const newLabel = prompt("边标签（留空删除）：", edge.label as string || "");
    if (newLabel !== null) {
      saveSnapshot();
      const updated = { ...edge, label: newLabel || undefined };
      setEdges((eds) => eds.map((e) => e.id === edge.id ? updated : e));
      if (newLabel) {
        store.updateNode(edge.id, {});
      }
    }
  }, [setEdges, store]);

  // ─── Validation ───
  function handleValidate() {
    const issues = validateFlow(nodes, edges);
    setValidationIssues(issues);
    setShowValidation(true);
  }

  // ─── Runner ───

  function startRun(nodeId: string) {
    setRunLog([]);
    setRunChoices(undefined);
    setCurrentNodeId(nodeId);
    setVisitedNodeIds(new Set());
    setConsoleVisible(true);
    setRunStatus("running");

    // Execute first step immediately
    const result = runStep(nodeId, store.nodes as any, store.edges as any, store.modules);
    setRunLog((prev) => [...prev, ...result.entries]);
    setVisitedNodeIds((prev) => new Set([...prev, nodeId]));

    if (result.choices) {
      setRunChoices(result.choices);
      setRunStatus("waiting_choice");
    } else if (result.nextNodeId) {
      setCurrentNodeId(result.nextNodeId);
    } else {
      setCurrentNodeId(null);
      setRunStatus("finished");
    }
  }

  function stepForward() {
    if (!currentNodeId || runStatus === "waiting_choice") return;

    const result = runStep(currentNodeId, store.nodes as any, store.edges as any, store.modules);
    setRunLog((prev) => [...prev, ...result.entries]);
    setVisitedNodeIds((prev) => new Set([...prev, currentNodeId]));

    if (result.choices) {
      setRunChoices(result.choices);
      setRunStatus("waiting_choice");
    } else if (result.nextNodeId) {
      setCurrentNodeId(result.nextNodeId);
    } else {
      setCurrentNodeId(null);
      setRunStatus("finished");
    }
  }

  function handleChoice(index: number) {
    if (!currentNodeId || !runChoices || !runChoices[index]) return;

    const chosen = runChoices[index];
    const edges = store.edges as any[];
    const targetEdge = edges.find(
      (e: any) => e.source === currentNodeId && e.sourceHandle === chosen.handleId
    );

    setRunChoices(undefined);

    if (targetEdge) {
      const result = runStep(targetEdge.target, store.nodes as any, store.edges as any, store.modules);
      setRunLog((prev) => [...prev, { type: "result", text: `选择：${chosen.label}`, passed: true }]);
      setRunLog((prev) => [...prev, ...result.entries]);
      setVisitedNodeIds((prev) => new Set([...prev, currentNodeId, targetEdge.target]));

      if (result.choices) {
        setRunChoices(result.choices);
        setCurrentNodeId(targetEdge.target);
        setRunStatus("waiting_choice");
      } else if (result.nextNodeId) {
        setCurrentNodeId(result.nextNodeId);
        setRunStatus("running");
      } else {
        setCurrentNodeId(null);
        setRunStatus("finished");
      }
    } else {
      setRunLog((prev) => [...prev, { type: "system", text: `未找到边 branch: ${chosen.handleId}` }]);
      setRunStatus("finished");
    }
  }

  function stopRun() {
    setRunLog([]);
    setRunChoices(undefined);
    setRunStatus("idle");
    setCurrentNodeId(null);
    setVisitedNodeIds(new Set());
    setConsoleVisible(false);
    // Clear node highlights
    setNodes((nds) => nds.map((n) => ({
      ...n,
      className: "",
      data: { ...n.data, running: false, visited: false },
    })));
  }

  // Sync node highlighting whenever currentNodeId or visitedNodeIds changes
  useEffect(() => {
    if (runStatus === "idle") return;
    setNodes((nds) => nds.map((n) => {
      const isRunning = n.id === currentNodeId;
      const isVisited = visitedNodeIds.has(n.id);
      return {
        ...n,
        className: isRunning ? "node-running" : isVisited ? "node-visited" : "",
        data: { ...n.data, running: isRunning, visited: isVisited },
      } as RFNode;
    }));
  }, [currentNodeId, visitedNodeIds, runStatus]);

  // Build module list and group list for the edit modal
  const moduleList = useCallback(() => {
    return store.modules.map((m) => ({ id: m.id, title: m.title }));
  }, [store.modules]);
  const groupNodeList = useCallback(() => {
    return store.nodes
      .filter((n) => n.type === "loop" || n.type === "phaseGroup")
      .map((n) => ({ id: n.id, type: n.type!, label: (n.data.label as string) || n.id }));
  }, [store.nodes]);

  const errorCount = validationIssues.filter((i) => i.severity === "error").length;
  const warnCount = validationIssues.filter((i) => i.severity === "warn").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
      <div style={{ display: "flex", flex: consoleVisible ? 0.55 : 1, minHeight: 0, width: "100%" }}>
        <FlowToolbar onRelayout={() => {
          saveSnapshot();
          store.relayout();
          setNodes(store.nodes as unknown as RFNode[]);
          setEdges(store.edges as unknown as Edge[]);
        }} onValidate={handleValidate} />

        <div ref={reactFlowWrapper} style={{ flex: 1, height: "100%", position: "relative" }}>
          <ReactFlow<RFNode, Edge>
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onNodeDragStop={onNodeDragStop}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onEdgeContextMenu={onEdgeContextMenu}
          onReconnect={onReconnect}
          onReconnectStart={onReconnectStart}
          onReconnectEnd={onReconnectEnd}
          isValidConnection={isValidConnection}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          snapToGrid
          snapGrid={[20, 20]}
          deleteKeyCode={["Delete", "Backspace"]}
          edgesReconnectable
          reconnectRadius={30}
          defaultEdgeOptions={{ type: "colored", interactionWidth: 20 }}
          style={{ background: "var(--bg)" }}
        >
          <Background color="var(--border)" gap={20} />
          <Controls style={{ background: "var(--surface)", borderRadius: "var(--r-md)", border: "1px solid var(--border)" }} />
          <MiniMap
            style={{ background: "var(--bg2)" }}
            maskColor="rgba(13, 17, 23, 0.7)"
            nodeColor={(n) => {
              const d = n.data as FlowNodeData;
              const map: Record<string, string> = {
                training: "var(--cat-blue)", serving: "var(--cat-pink)", punishment: "var(--cat-red)",
                daily: "var(--cat-gray)", finale: "var(--cat-orange)", choice: "var(--cat-purple)",
                judgment: "var(--cat-orange)", loop: "var(--cat-blue)", start: "var(--cat-green)", end: "var(--cat-red)",
              };
              return map[d.colorKey || ""] || "var(--text-muted)";
            }}
          />
        </ReactFlow>

        {/* Validation panel */}
        {showValidation && (
          <div style={{
            position: "absolute", bottom: 12, right: 12, zIndex: 10,
            width: 340, maxHeight: 220, overflow: "auto",
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-lg)",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "var(--s2) var(--s3)", borderBottom: "1px solid var(--border-light)",
              fontSize: "var(--fs-sm)", fontWeight: 600,
            }}>
              <span>
                流程校验
                {validationIssues.length === 0 ? (
                  <span style={{ color: "var(--cat-green)", marginLeft: 8 }}>✓ 无问题</span>
                ) : (
                  <>
                    {errorCount > 0 && <span style={{ color: "var(--danger)", marginLeft: 8 }}>{errorCount} 错误</span>}
                    {warnCount > 0 && <span style={{ color: "var(--cat-orange)", marginLeft: 8 }}>{warnCount} 警告</span>}
                  </>
                )}
              </span>
              <button className="btn btn-ghost btn-xs" onClick={() => setShowValidation(false)}>✕</button>
            </div>
            <div style={{ padding: "var(--s2)" }}>
              {validationIssues.length === 0 ? (
                <p className="faint" style={{ margin: 0 }}>流程结构完整，未发现明显问题。</p>
              ) : (
                validationIssues.map((iss, i) => (
                  <div key={i} style={{
                    fontSize: "var(--fs-sm)", padding: "2px 0",
                    color: iss.severity === "error" ? "var(--danger)" : "var(--cat-orange)",
                  }}>
                    {iss.severity === "error" ? "❌" : "⚠️"} {iss.message}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Node context menu */}
      {ctxMenu && (
        <NodeContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onEdit={handleEditNode}
          onDuplicate={handleDuplicateNode}
          onDelete={handleDeleteNode}
          onClose={() => setCtxMenu(null)}
          onRunFromHere={runStatus === "idle" ? () => { startRun(ctxMenu!.nodeId); setCtxMenu(null); } : undefined}
        />
      )}

      {/* Edge context menu */}
      {edgeCtxMenu && (
        <div style={{
          position: "fixed", left: edgeCtxMenu.x, top: edgeCtxMenu.y, zIndex: 1000,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-md)", boxShadow: "var(--shadow-lg)",
          padding: "4px", minWidth: 120,
        }}>
          <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "flex-start", color: "var(--danger)" }}
            onClick={handleDeleteEdge}>
            删除此边
          </button>
          <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "flex-start" }}
            onClick={() => setEdgeCtxMenu(null)}>
            取消
          </button>
        </div>
      )}

      {/* Node edit modal */}
      {editModal && (
        <NodeEditModal
          nodeId={editModal.nodeId}
          nodeType={editModal.nodeType}
          data={editModal.data}
          modules={moduleList()}
          groupNodes={groupNodeList()}
          onSave={handleEditSave}
          onClose={() => setEditModal(null)}
        />
      )}

      {/* Module detail panel (slide-out right) */}
      {selectedModuleId && (
        <ModuleDetailPanel
          moduleId={selectedModuleId}
          edges={edges}
          onEdgesChange={setEdges}
          onClose={() => {
            setSelectedModuleId(null);
            setNodes(store.nodes as unknown as RFNode[]);
            setEdges(store.edges as unknown as Edge[]);
          }}
        />
      )}
      </div>

      <GameConsole
        visible={consoleVisible}
        log={runLog}
        choices={runChoices}
        onChoice={handleChoice}
        status={runStatus}
        onContinue={() => {
          if (runStatus === "idle") return;
          stepForward();
        }}
        onStop={stopRun}
        onClose={() => stopRun()}
      />
    </div>
  );
}

export function FlowEditor() {
  return (
    <ReactFlowProvider>
      <FlowEditorInner />
    </ReactFlowProvider>
  );
}
