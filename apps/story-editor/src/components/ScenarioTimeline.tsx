import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useEditorStore } from "../store/editorStore.js";
import type { Scenario, ScenarioStageDetail } from "@story-game/shared";

/* ===== Act definition ===== */
interface ActDef { key: string; label: string; color: string; range: [number, number] }
const ACTS: ActDef[] = [
  { key: "capture", label: "落网废武", color: "var(--cat-blue)", range: [1, 4] },
  { key: "initiation", label: "侍女初训", color: "var(--cat-purple)", range: [5, 10] },
  { key: "punishment", label: "惩罚感官", color: "var(--cat-red)", range: [11, 15] },
  { key: "willbreak", label: "意志崩坏", color: "var(--cat-orange)", range: [16, 20] },
  { key: "serving", label: "侍寝循环", color: "var(--cat-pink)", range: [21, 30] },
  { key: "finale", label: "新生侍女", color: "var(--cat-green)", range: [31, 35] },
];

function stageNum(id: string) { return parseInt(id.replace("stage_", ""), 10); }
function actFor(id: string): ActDef {
  const n = stageNum(id);
  return ACTS.find((a) => n >= a.range[0] && n <= a.range[1]) || ACTS[5];
}

/* ===== Sub-components ===== */

function StageDot({ stageId, detail, isCurrent, isChoice, color, onClick, onMoveLeft, onMoveRight, canMoveLeft, canMoveRight }: {
  stageId: string; detail?: ScenarioStageDetail; isCurrent: boolean; isChoice: boolean;
  color: string; onClick: () => void; onMoveLeft: () => void; onMoveRight: () => void;
  canMoveLeft: boolean; canMoveRight: boolean;
}) {
  const n = stageId.replace("stage_", "");
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
      <button
        onClick={onClick}
        title={`${stageId}${detail?.title ? `: ${detail.title}` : ""}${detail?.enterWhen ? `\n进入: ${detail.enterWhen}` : ""}`}
        style={{
          width: 30, height: 30, borderRadius: isChoice ? "50%" : 6,
          background: isCurrent ? "#fff" : `${color}20`,
          border: `2px solid ${isCurrent ? "#fff" : isChoice ? color : `${color}50`}`,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 700, fontFamily: "var(--font)",
          color: isCurrent ? "var(--bg)" : "var(--text)",
          transition: "transform 0.1s, box-shadow 0.1s",
          boxShadow: isCurrent ? `0 0 0 3px ${color}40` : "none",
          padding: 0, lineHeight: 1,
        }}
      >
        {isChoice ? "✦" : n}
      </button>
      <div style={{ display: "flex", gap: 0, marginTop: 2 }}>
        <button onClick={onMoveLeft} disabled={!canMoveLeft}
          className="btn btn-ghost"
          style={{ opacity: canMoveLeft ? 0.4 : 0.15, fontSize: 7, padding: "0 2px", lineHeight: 1 }}>◀</button>
        <button onClick={onMoveRight} disabled={!canMoveRight}
          className="btn btn-ghost"
          style={{ opacity: canMoveRight ? 0.4 : 0.15, fontSize: 7, padding: "0 2px", lineHeight: 1 }}>▶</button>
      </div>
    </div>
  );
}

/* ===== Main ===== */

export function ScenarioTimeline() {
  const { storyPackage, updateScenario, updateStageDetail } = useEditorStore();
  const s = storyPackage?.scenario;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Modal drag
  const [modalOff, setModalOff] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ x: 0, y: 0 });

  const onModalDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragRef.current = { x: e.clientX - modalOff.x, y: e.clientY - modalOff.y };
  }, [modalOff]);

  const prevSelectedRef = useRef<string | null>(null);
  if (selectedId !== prevSelectedRef.current) {
    prevSelectedRef.current = selectedId;
    if (modalOff.x !== 0 || modalOff.y !== 0) setModalOff({ x: 0, y: 0 });
  }

  // Modal drag listeners
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => setModalOff({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y });
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  if (!s) return (
    <div className="panel">
      <div className="panel-header"><h2>阶段时间线</h2></div>
      <p className="muted">暂无场景数据</p>
    </div>
  );

  const details = s.stageDetails || [];
  const detailMap = new Map(details.map((d) => [d.id, d]));
  const choicePoints = details.filter((d) => d.isChoicePoint);
  const stages = s.stages || [];
  const selected = selectedId ? detailMap.get(selectedId) : null;

  // Group stages by act
  const actGroups = useMemo(() => {
    const groups = ACTS.map((act) => ({
      act,
      stages: stages.filter((sid) => actFor(sid).key === act.key),
    })).filter((g) => g.stages.length > 0);
    return groups;
  }, [stages]);

  function moveStage(fromIdx: number, direction: -1 | 1) {
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || toIdx >= stages.length) return;
    const newStages = [...stages];
    [newStages[fromIdx], newStages[toIdx]] = [newStages[toIdx], newStages[fromIdx]];
    updateScenario({ ...s, stages: newStages } as Scenario);
  }

  function stageIndex(id: string) { return stages.indexOf(id); }

  return (
    <div className="panel" style={{ gap: "var(--s3)", position: "relative" }}>
      {/* Header + settings in one compact row */}
      <div className="panel-header" style={{ flexWrap: "wrap", gap: "var(--s3)" }}>
        <div className="flex-center gap3">
          <h2>阶段时间线</h2>
          <span className="faint">{stages.length} 阶段 &middot; {choicePoints.length} 抉择</span>
        </div>
        <div className="flex-center gap3" style={{ flex: 1 }}>
          <select className="input" style={{ width: 140 }}
            value={s.currentStage} onChange={(e) => updateScenario({ ...s, currentStage: e.target.value } as Scenario)}>
            {stages.map((sid) => <option key={sid} value={sid}>{sid}</option>)}
          </select>
          <input className="input" style={{ flex: 1, maxWidth: 260 }}
            value={s.currentGoal} onChange={(e) => updateScenario({ ...s, currentGoal: e.target.value } as Scenario)}
            placeholder="当前目标..." />
        </div>
      </div>

      {/* Multi-row timeline */}
      <div className="card" style={{ overflow: "auto", padding: "var(--s4)", flex: 1, minHeight: 0 }}>
        {actGroups.map(({ act, stages: actStages }) => (
          <div key={act.key} style={{ marginBottom: "var(--s4)" }}>
            {/* Act label row */}
            <div className="flex-center gap2 mb2" style={{ position: "sticky", left: 0 }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", background: act.color, flexShrink: 0,
              }} />
              <span style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: act.color, whiteSpace: "nowrap" }}>
                {act.label}
              </span>
              <span className="faint" style={{ fontSize: 9 }}>
                {act.range[0]}-{act.range[1]}
              </span>
            </div>

            {/* Stage dots in this act */}
            <div className="flex-center gap2" style={{ flexWrap: "wrap", paddingLeft: "var(--s2)" }}>
              {actStages.map((stageId) => {
                const detail = detailMap.get(stageId);
                const idx = stageIndex(stageId);
                const isChoice = detail?.isChoicePoint === true;
                const isCurrent = stageId === s.currentStage;

                return (
                  <div key={stageId} style={{ position: "relative" }}>
                    <StageDot
                      stageId={stageId} detail={detail} isCurrent={isCurrent} isChoice={isChoice}
                      color={act.color}
                      onClick={() => setSelectedId(selectedId === stageId ? null : stageId)}
                      onMoveLeft={() => moveStage(idx, -1)}
                      onMoveRight={() => moveStage(idx, 1)}
                      canMoveLeft={idx > 0} canMoveRight={idx < stages.length - 1}
                    />

                    {/* Branch arcs to targets in OTHER acts */}
                    {isChoice && (detail?.branches || []).map((b, bi) => {
                      const targetIdx = stageIndex(b.targetStage);
                      if (targetIdx === -1 || Math.abs(targetIdx - idx) < 2) return null;
                      return (
                        <div key={bi} style={{
                          position: "absolute", top: -10, right: -6,
                          fontSize: 7, color: "#d2991d", fontWeight: 600,
                          pointerEvents: "none", whiteSpace: "nowrap",
                        }}>
                          →{b.targetStage.replace("stage_", "")}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Connector line between stages */}
            <div style={{ display: "flex", gap: 2, paddingLeft: "var(--s2)", marginTop: 1, flexWrap: "wrap" }}>
              {actStages.slice(0, -1).map((sid, i) => {
                const nextSid = actStages[i + 1];
                const nextIdx = stageIndex(nextSid);
                const curIdx = stageIndex(sid);
                // Only show arrow if consecutive
                if (nextIdx !== curIdx + 1) return <span key={i} style={{ width: 32, display: "inline-block" }} />;
                return (
                  <span key={i} style={{
                    width: 32, textAlign: "center", fontSize: 12, color: `${act.color}60`,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>
                    ·
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Floating popover detail panel */}
      {selected && (
        <>
          <div className="modal-backdrop" onClick={() => setSelectedId(null)} />
          <div className="modal-popup" style={{ width: 680, transform: `translate(calc(-50% + ${modalOff.x}px), calc(-50% + ${modalOff.y}px))`, cursor: dragging ? "grabbing" : undefined }}>
            <div className="modal-header" style={{ cursor: "grab" }} onMouseDown={onModalDragStart}>
              <div className="flex-center gap3">
                <h3>{selected.isChoicePoint && "✦ "}{selected.title || selected.id}</h3>
                <span className="faint mono">{selected.id}</span>
              </div>
              <div className="flex-center gap3">
                <label className="field field-row">
                  <input type="checkbox" checked={selected.isChoicePoint === true}
                    onChange={(e) => updateStageDetail({
                      ...selected, isChoicePoint: e.target.checked || undefined,
                      branches: e.target.checked ? (selected.branches || [{ targetStage: "", choiceText: "", condition: "", description: "" }]) : [],
                    })} />
                  <span style={{ textTransform: "none", fontSize: "var(--fs-sm)" }}>抉择点</span>
                </label>
                <button className="btn btn-ghost btn-xs" onClick={() => setSelectedId(null)}>✕</button>
              </div>
            </div>

            <div className="modal-body">
              <div style={{ display: "flex", gap: "var(--s4)" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--s3)", minHeight: 0 }}>
                  <div className="form-grid cols-2">
                    <label className="field"><span>标题</span>
                      <input className="input" value={selected.title}
                        onChange={(e) => updateStageDetail({ ...selected, title: e.target.value })} />
                    </label>
                    <label className="field"><span>进入条件</span>
                      <input className="input" value={selected.enterWhen || ""}
                        onChange={(e) => updateStageDetail({ ...selected, enterWhen: e.target.value })}
                        placeholder="如：内力封印完成" />
                    </label>
                  </div>
                  <label className="field" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                    <span>LLM 引导</span>
                    <textarea className="input mono" style={{ flex: 1, minHeight: 120, resize: "vertical" }}
                      value={selected.guidance || ""}
                      onChange={(e) => updateStageDetail({ ...selected, guidance: e.target.value })} />
                  </label>
                  <label className="field" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                    <span>阶段指令 (directive)</span>
                    <textarea className="input mono" style={{ flex: 1, minHeight: 80, resize: "vertical" }}
                      value={selected.directive || ""}
                      onChange={(e) => updateStageDetail({ ...selected, directive: e.target.value })}
                      placeholder="必须发生的具体事件，如：虚竹必须击中丁春秋右肩" />
                  </label>
                </div>

                {selected.isChoicePoint && (
                  <div style={{ flex: 1 }}>
                    <div className="flex-between mb2">
                      <span style={{ fontWeight: 600, fontSize: "var(--fs-sm)", color: "var(--cat-orange)" }}>分支</span>
                      <button className="btn btn-xs" onClick={() => updateStageDetail({
                        ...selected, branches: [...(selected.branches || []),
                        { targetStage: "", choiceText: "", condition: "", description: "" }]
                      })}>+ 添加</button>
                    </div>
                    <div style={{ maxHeight: 200, overflow: "auto" }}>
                      {(selected.branches || []).map((b, bi) => (
                        <div key={bi} style={{
                          display: "flex", gap: "var(--s1)", marginBottom: "var(--s1)",
                          padding: "var(--s1) var(--s2)", background: "var(--warning-bg)",
                          borderRadius: "var(--r-sm)", alignItems: "center",
                        }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: "var(--cat-orange)", width: 12 }}>{bi + 1}</span>
                          <input className="input" style={{ flex: 1, fontSize: "var(--fs-xs)", padding: "2px 4px" }}
                            value={b.choiceText || ""}
                            onChange={(e) => {
                              const brs = [...(selected.branches || [])];
                              brs[bi] = { ...brs[bi], choiceText: e.target.value };
                              updateStageDetail({ ...selected, branches: brs });
                            }} placeholder="按钮" />
                          <select className="input" style={{ flex: 1.5, fontSize: "var(--fs-xs)", padding: "2px 4px" }}
                            value={b.targetStage} onChange={(e) => {
                              const brs = [...(selected.branches || [])];
                              brs[bi] = { ...brs[bi], targetStage: e.target.value };
                              updateStageDetail({ ...selected, branches: brs });
                            }}>
                            <option value="">目标...</option>
                            {stages.map((sid) => <option key={sid} value={sid}>{sid.replace("stage_", "")}</option>)}
                          </select>
                          <button className="btn btn-ghost btn-xs" style={{ color: "var(--danger)" }}
                            onClick={() => {
                              updateStageDetail({ ...selected, branches: (selected.branches || []).filter((_, i) => i !== bi) });
                            }}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
