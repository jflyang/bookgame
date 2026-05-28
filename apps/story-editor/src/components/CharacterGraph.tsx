import { useState, useCallback, useMemo } from "react";
import {
  ReactFlow, Background, Controls,
  useNodesState, useEdgesState, addEdge,
  type Node, type Edge, type Connection,
  Handle, Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEditorStore } from "../store/editorStore.js";
import type { Character } from "@story-game/shared";

const CHAR_COLORS = ["var(--cat-blue)", "var(--cat-red)", "var(--cat-green)", "var(--cat-orange)", "var(--cat-purple)", "var(--cat-pink)", "#79c0ff", "#ffa657"];

function layoutChars(chars: Character[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const radius = 200;
  const cx = 350, cy = 280;

  chars.forEach((c, i) => {
    const angle = (2 * Math.PI * i) / Math.max(chars.length, 1) - Math.PI / 2;
    nodes.push({
      id: c.id, type: "charNode",
      position: { x: cx + radius * Math.cos(angle) - 80, y: cy + radius * Math.sin(angle) - 40 },
      data: { character: c, color: CHAR_COLORS[i % CHAR_COLORS.length] },
    });
  });

  for (const c of chars) {
    for (const targetId of (c.attackableTargetIds || [])) {
      if (chars.some((o) => o.id === targetId)) {
        edges.push({
          id: `atk_${c.id}_${targetId}`,
          source: c.id, target: targetId,
          label: "⚔",
          style: { stroke: "var(--cat-red)", strokeWidth: 2 },
          labelStyle: { fill: "var(--cat-red)", fontWeight: 700, fontSize: 14 },
          markerEnd: { type: "arrowclosed" as const, color: "var(--cat-red)", width: 16, height: 16 },
        });
      }
    }
  }

  return { nodes, edges };
}

function CharNode({ data }: { data: { character: Character; color: string } }) {
  const c = data.character;
  return (
    <div style={{
      background: "var(--surface)", border: `2px solid ${data.color}`,
      borderRadius: "var(--r-lg)", padding: "var(--s3) var(--s4)",
      minWidth: 150, fontSize: "var(--fs-sm)", color: "var(--text)",
      boxShadow: `0 2px 12px ${data.color}18`,
    }}>
      <Handle type="target" position={Position.Left} style={{
        background: data.color, width: 10, height: 10, border: "2px solid var(--bg)",
      }} />
      <div style={{ fontWeight: 700, fontSize: "var(--fs-md)", marginBottom: 2 }}>{c.name}</div>
      <div style={{ fontSize: "var(--fs-xs)", color: data.color, fontWeight: 500 }}>{c.role || "无定位"}</div>
      <div style={{ fontSize: 9, color: "var(--text-faint)", marginTop: 2 }}>{c.id}</div>
      {(c.knowledgeBaseIds || []).length > 0 && (
        <div style={{ fontSize: 9, color: "var(--cat-purple)", marginTop: 3, fontWeight: 500 }}>
          📚 {(c.knowledgeBaseIds || []).length} 知识库
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{
        background: data.color, width: 10, height: 10, border: "2px solid var(--bg)",
      }} />
    </div>
  );
}

const nodeTypes = { charNode: CharNode };

export function CharacterGraph() {
  const { storyPackage, updateCharacter, updateCharacters } = useEditorStore();
  const chars = storyPackage?.characters || [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const selected = chars.find((c) => c.id === selectedId) || null;

  const layout = useMemo(() => layoutChars(chars), [chars]);
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(layout.nodes as any);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(layout.edges as any);

  // Sync layout when chars change
  if (rfNodes.length !== layout.nodes.length || rfEdges.length !== layout.edges.length) {
    setRfNodes(layout.nodes as any);
    setRfEdges(layout.edges as any);
  }

  // Add attack relationship by connecting nodes
  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target || params.source === params.target) return;

    const sourceChar = chars.find((c) => c.id === params.source);
    if (!sourceChar) return;

    const existing = sourceChar.attackableTargetIds || [];
    if (existing.includes(params.target)) return;

    const newEdge: Edge = {
      id: `atk_${params.source}_${params.target}`,
      source: params.source, target: params.target,
      label: "⚔",
      style: { stroke: "var(--cat-red)", strokeWidth: 2 },
      labelStyle: { fill: "var(--cat-red)", fontWeight: 700, fontSize: 14 },
      markerEnd: { type: "arrowclosed" as const, color: "var(--cat-red)", width: 16, height: 16 },
    };

    setRfEdges((eds) => addEdge(newEdge, eds));
    updateCharacter({ ...sourceChar, attackableTargetIds: [...existing, params.target] });
  }, [chars, setRfEdges, updateCharacter]);

  // Delete edge = remove attack relationship
  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    for (const edge of deletedEdges) {
      const sourceChar = chars.find((c) => c.id === edge.source);
      if (sourceChar) {
        const newTargets = (sourceChar.attackableTargetIds || []).filter((tid) => tid !== edge.target);
        updateCharacter({ ...sourceChar, attackableTargetIds: newTargets });
      }
    }
  }, [chars, updateCharacter]);

  function handleAdd() {
    if (!newName.trim()) return;
    const id = `char_${newName.trim().replace(/\s+/g, "_").toLowerCase()}_${Date.now()}`;
    const c: Character = {
      id, name: newName.trim(), role: "", avatar: "",
      personaPrompt: "", rules: [], knowledgeBaseIds: [], attackableTargetIds: [],
    };
    updateCharacters([...chars, c]);
    setSelectedId(c.id);
    setNewName("");
    setAdding(false);
  }

  function handleDelete(id: string) {
    // Also clean up edges pointing to this character
    let updated = chars.filter((c) => c.id !== id);
    updated = updated.map((c) => ({
      ...c,
      attackableTargetIds: (c.attackableTargetIds || []).filter((tid) => tid !== id),
    }));
    updateCharacters(updated);
    if (selectedId === id) setSelectedId(null);
  }

  // Build attack relationship display for selected character
  const attackers = selected
    ? chars.filter((c) => (c.attackableTargetIds || []).includes(selected.id))
    : [];

  return (
    <div className="panel" style={{ position: "relative" }}>
      {/* Header */}
      <div className="panel-header">
        <div>
          <h2>角色关系图</h2>
          <span className="faint">{chars.length} 角色</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
          + 新角色
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="card mb3" style={{
          borderColor: "var(--accent-border)", background: "var(--accent-bg)",
        }}>
          <div className="flex-center gap2">
            <input
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
              placeholder="输入新角色名称..."
              autoFocus
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={!newName.trim()}>确认</button>
            <button className="btn btn-sm" onClick={() => setAdding(false)}>取消</button>
          </div>
        </div>
      )}

      {/* Graph canvas */}
      <div style={{
        flex: 1, minHeight: 420,
        background: "var(--bg)", borderRadius: "var(--r-lg)",
        border: "1px solid var(--border)", overflow: "hidden",
      }}>
        <ReactFlow
          nodes={rfNodes} edges={rfEdges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          nodeTypes={nodeTypes as any}
          onNodeClick={(_e, node) => setSelectedId(selectedId === node.id ? null : node.id)}
          fitView
          deleteKeyCode={["Delete", "Backspace"]}
          style={{ background: "var(--bg)" }}
        >
          <Background color="var(--border)" gap={24} />
          <Controls style={{ background: "var(--surface)", borderRadius: "var(--r-md)", border: "1px solid var(--border)" }} />
        </ReactFlow>
      </div>

      <div className="faint mt1" style={{ fontSize: "var(--fs-xs)", textAlign: "center" }}>
        从节点右侧圆点拖拽到目标节点左侧圆点创建攻击关系 · 选中连线按 Delete 删除
      </div>

      {/* Floating detail popover */}
      {selected && (
        <>
          <div className="modal-backdrop" onClick={() => setSelectedId(null)} />
          <div className="modal-popup" style={{ width: 580 }}>
            <div className="modal-header">
              <div className="flex-center gap3">
                <h3>{selected.name}</h3>
                <span className="faint mono">{selected.id}</span>
              </div>
              <div className="flex-center gap2">
                <button className="btn btn-danger btn-xs" onClick={() => handleDelete(selected.id)}>删除</button>
                <button className="btn btn-ghost btn-xs" onClick={() => setSelectedId(null)}>✕</button>
              </div>
            </div>

            <div className="modal-body">
              <div className="form-grid cols-2" style={{ marginBottom: "var(--s3)" }}>
                <label className="field">
                  <span>ID</span>
                  <input className="input mono" value={selected.id}
                    onChange={(e) => updateCharacter({ ...selected, id: e.target.value })} />
                </label>
                <label className="field">
                  <span>名称</span>
                  <input className="input" value={selected.name}
                    onChange={(e) => updateCharacter({ ...selected, name: e.target.value })} />
                </label>
                <label className="field">
                  <span>角色定位</span>
                  <input className="input" value={selected.role || ""}
                    onChange={(e) => updateCharacter({ ...selected, role: e.target.value })} />
                </label>
                <label className="field">
                  <span>头像 URL</span>
                  <input className="input" value={selected.avatar || ""}
                    onChange={(e) => updateCharacter({ ...selected, avatar: e.target.value })} />
                </label>
              </div>

              {/* Attack relationship editor */}
              <div className="mt3" style={{ borderTop: "1px solid var(--border-light)", paddingTop: "var(--s3)" }}>
                <div style={{ fontWeight: 600, fontSize: "var(--fs-sm)", marginBottom: "var(--s2)", color: "var(--cat-red)" }}>
                  ⚔ 攻击目标
                </div>
                <div style={{
                  maxHeight: 150, overflow: "auto",
                  background: "var(--bg2)", borderRadius: "var(--r-md)",
                  border: "1px solid var(--border)",
                }}>
                  {chars.filter((c) => c.id !== selected.id).map((c) => {
                    const isTarget = (selected.attackableTargetIds || []).includes(c.id);
                    return (
                      <label key={c.id} style={{
                        display: "flex", alignItems: "center", gap: "var(--s2)",
                        padding: "var(--s1) var(--s3)", cursor: "pointer",
                        fontSize: "var(--fs-sm)", color: isTarget ? "var(--text)" : "var(--text-muted)",
                        borderBottom: "1px solid var(--border-light)",
                        transition: "background 0.1s",
                      }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        <input type="checkbox"
                          checked={isTarget}
                          onChange={() => {
                            const current = selected.attackableTargetIds || [];
                            const next = isTarget
                              ? current.filter((tid) => tid !== c.id)
                              : [...current, c.id];
                            updateCharacter({ ...selected, attackableTargetIds: next });
                          }}
                          style={{ accentColor: "var(--cat-red)" }}
                        />
                        <span style={{ flex: 1 }}>{c.name}</span>
                        <span className="faint mono" style={{ fontSize: 9 }}>{c.id}</span>
                      </label>
                    );
                  })}
                </div>
                {/* Attacked by (read-only) */}
                {attackers.length > 0 && (
                  <div className="mt2" style={{ fontSize: "var(--fs-xs)", color: "var(--cat-blue)" }}>
                    🛡 被攻击：{attackers.map((a) => a.name).join("、")}
                  </div>
                )}
              </div>

              <label className="field mt3">
                <span>知识库 ID (逗号分隔)</span>
                <input className="input mono"
                  value={(selected.knowledgeBaseIds || []).join(", ")}
                  onChange={(e) => updateCharacter({
                    ...selected,
                    knowledgeBaseIds: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })} />
              </label>

              <label className="field mt3">
                <span>角色 Prompt</span>
                <textarea className="input mono" rows={4} value={selected.personaPrompt || ""}
                  onChange={(e) => updateCharacter({ ...selected, personaPrompt: e.target.value })} />
              </label>

              {/* Quick nav */}
              <div className="mt4" style={{ borderTop: "1px solid var(--border-light)", paddingTop: "var(--s3)" }}>
                <span className="section-title" style={{ padding: 0 }}>切换角色</span>
                <select className="input mt2" value={selected.id}
                  onChange={(e) => setSelectedId(e.target.value)}>
                  {chars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
