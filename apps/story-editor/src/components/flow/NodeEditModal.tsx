import { useState, useEffect } from "react";
import type { FlowNodeData } from "../../lib/flowTypes.js";
import { useEditorStore } from "../../store/editorStore.js";

interface Props {
  nodeId: string;
  nodeType: string;
  data: FlowNodeData;
  modules: { id: string; title: string; type?: string }[];
  groupNodes: { id: string; type: string; label: string }[];
  onSave: (data: FlowNodeData) => void;
  onClose: () => void;
}

/* ─── Field label with optional help hint ─── */
function F({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="field" style={{ gap: 2 }}>
      <span>{label}</span>
      {hint && <span className="faint" style={{ textTransform: "none", fontSize: 9, fontWeight: 400, letterSpacing: 0, marginBottom: 1 }}>{hint}</span>}
      {children}
    </label>
  );
}

/* ─── Tag-style multi-select: dropdown + add button + tag list ─── */
function TagSelect({ label, options, selected, onAdd, onRemove }: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const available = options.filter((o) => !selected.includes(o.id));
  const [pick, setPick] = useState("");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", gap: "var(--s1)" }}>
        <select className="input" style={{ flex: 1, fontSize: "var(--fs-sm)", padding: "4px 8px" }}
          value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">选择{label}...</option>
          {available.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <button className="btn btn-xs" disabled={!pick}
          onClick={() => { if (pick) { onAdd(pick); setPick(""); } }}>+ 添加</button>
      </div>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {selected.map((id) => {
            const found = options.find((o) => o.id === id);
            return (
              <span key={id} style={{
                background: "var(--surface2)", border: "1px solid var(--border-light)",
                borderRadius: "var(--r-sm)", padding: "1px 6px", fontSize: "var(--fs-xs)",
                display: "flex", alignItems: "center", gap: 4,
              }}>
                {found?.label || id}
                <button className="btn btn-ghost btn-xs" style={{ padding: 0, fontSize: 10, lineHeight: 1, color: "var(--danger)" }}
                  onClick={() => onRemove(id)}>✕</button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function NodeEditModal({ nodeType, data, modules, groupNodes, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<FlowNodeData>({ ...data });
  const storyPackage = useEditorStore((s) => s.storyPackage);

  useEffect(() => { setDraft({ ...data }); }, [data]);

  // ─── Data for dropdowns ───
  const characters = storyPackage?.characters || [];
  const skills = storyPackage?.skills || [];
  const stages = storyPackage?.scenario?.stageDetails || [];
  const allModules = modules;

  const charOptions = characters.map((c) => ({ id: c.id, label: `${c.name} (${c.role})` }));
  const skillOptions = skills.map((s) => ({ id: s.id, label: `${s.name}` }));
  const stageOptions = stages.map((s) => ({ id: s.id, label: `${s.title || s.id}` }));
  const moduleOptions = allModules.map((m) => ({ id: m.id, label: `${m.title} (${m.id})` }));

  /* ─── Branch row ─── */
  function BranchRow({ b, i, onChange, onRemove }: {
    b: any; i: number;
    onChange: (i: number, field: string, val: string) => void;
    onRemove: (i: number) => void;
  }) {
    return (
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1.5fr auto", gap: "var(--s1)", alignItems: "center",
        padding: "var(--s2)", background: "var(--bg)", borderRadius: "var(--r-md)", border: "1px solid var(--border-light)",
      }}>
        <input className="input" style={{ fontSize: "var(--fs-sm)", padding: "4px 8px" }}
          value={b.choiceText || ""} placeholder="按钮文字，如：接受训练"
          onChange={(e) => onChange(i, "choiceText", e.target.value)} />
        <select className="input" style={{ fontSize: "var(--fs-sm)", padding: "4px 8px" }}
          value={b.targetStage || ""}
          onChange={(e) => onChange(i, "targetStage", e.target.value)}>
          <option value="">目标阶段（手动输入或选择）</option>
          {stageOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          <option disabled>── 模块 ──</option>
          {moduleOptions.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <button className="btn btn-ghost btn-xs" style={{ color: "var(--danger)" }}
          onClick={() => onRemove(i)}>✕</button>
      </div>
    );
  }

  /* ─── Pool item row ─── */
  function PoolRow({ item, i, onChange, onRemove }: {
    item: any; i: number;
    onChange: (i: number, field: string, val: string) => void;
    onRemove: (i: number) => void;
  }) {
    return (
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: "var(--s1)", alignItems: "center",
        padding: "var(--s2)", background: "var(--bg)", borderRadius: "var(--r-md)", border: "1px solid var(--border-light)",
      }}>
        <select className="input" style={{ fontSize: "var(--fs-sm)", padding: "4px 8px" }}
          value={item.id || ""}
          onChange={(e) => onChange(i, "id", e.target.value)}>
          <option value="">手动输入ID</option>
          {moduleOptions.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <input className="input" style={{ fontSize: "var(--fs-sm)", padding: "4px 8px" }}
          value={item.title || ""} placeholder="标题"
          onChange={(e) => onChange(i, "title", e.target.value)} />
        <button className="btn btn-ghost btn-xs" style={{ color: "var(--danger)" }}
          onClick={() => onRemove(i)}>✕</button>
      </div>
    );
  }

  /* ─── Common labels and colors ─── */
  const typeLabel: Record<string, string> = {
    module: "故事模块", choice: "多分支抉择", judgment: "判断节点",
    eventTrigger: "事件触发", randomEvent: "随机事件", randomJudgment: "随机判断",
    loop: "循环入口", dailyTrigger: "日常触发", start: "开始", end: "结束",
  };
  const modalColors: Record<string, string> = {
    module: "var(--cat-blue)", choice: "var(--cat-purple)", judgment: "var(--cat-orange)",
    eventTrigger: "var(--cat-orange)", randomEvent: "var(--cat-pink)", randomJudgment: "var(--cat-purple)",
    loop: "var(--cat-blue)", dailyTrigger: "var(--cat-gray)", start: "var(--cat-green)", end: "var(--cat-red)",
  };

  const accent = modalColors[nodeType] || "var(--accent)";

  /* ─── Render ─── */
  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-popup" style={{ width: 700 }}>
        {/* Header */}
        <div className="modal-header">
          <div className="flex-center gap3">
            <span style={{ width: 10, height: 10, borderRadius: 3, background: accent, flexShrink: 0 }} />
            <h3>编辑{typeLabel[nodeType] || nodeType}</h3>
            <span className="faint mono" style={{ fontSize: 9 }}>{nodeType}</span>
          </div>
          <button className="btn btn-ghost btn-xs" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "var(--s4)" }}>
          {/* ═══════ MODULE ═══════ */}
          {nodeType === "module" && (
            <>
              <div className="form-grid cols-2">
                <F label="模块名称" hint="在节点上显示的标题">
                  <input className="input" value={draft.label || ""}
                    onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                    placeholder="如：① 落网之凤" />
                </F>
                <F label="模块类型" hint="决定引擎如何处理此阶段">
                  <select className="input" value={(draft.colorKey as string) || "training"}
                    onChange={(e) => setDraft({ ...draft, colorKey: e.target.value })}>
                    <option value="training">训练 (training)</option>
                    <option value="serving">侍寝 (serving)</option>
                    <option value="punishment">惩戒 (punishment)</option>
                    <option value="daily">日常 (daily)</option>
                    <option value="finale">终章 (finale)</option>
                  </select>
                </F>
              </div>
              <F label="父容器" hint="将此模块放入循环或阶段容器内（拖放到容器内会自动设置）">
                <select className="input" value={(draft.parentId as string) || ""}
                  onChange={(e) => setDraft({ ...draft, parentId: e.target.value || undefined })}>
                  <option value="">无（顶层节点）</option>
                  {groupNodes.map((g) => <option key={g.id} value={g.id}>{g.label} ({g.type})</option>)}
                </select>
              </F>
              <F label="或绑定已有模块" hint="选择 modules.json 中已定义的模块，留空则为独立节点">
                <select className="input" value={(draft.moduleRef as string) || ""}
                  onChange={(e) => {
                    const ref = e.target.value || undefined;
                    const mod = allModules.find((m) => m.id === ref);
                    setDraft({
                      ...draft,
                      moduleRef: ref,
                      label: mod?.title || draft.label,
                      moduleData: mod as any,
                    });
                  }}>
                  <option value="">独立节点（手动填写）</option>
                  {allModules.map((m) => <option key={m.id} value={m.id}>{m.title} ({m.id})</option>)}
                </select>
              </F>
              {!draft.moduleRef && (
                <>
                  <F label="来源阶段" hint="对应 scenario.json 中的 stage ID">
                    <select className="input" value={(draft.moduleData as any)?.sourceStage || ""}
                      onChange={(e) => setDraft({ ...draft, moduleData: { ...(draft.moduleData as any || {}), sourceStage: e.target.value || undefined } })}>
                      <option value="">无</option>
                      {stageOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </F>
                  <F label="需要角色" hint="此模块涉及的角色">
                    <TagSelect label="角色" options={charOptions}
                      selected={(draft.moduleData as any)?.requiredCharacters || []}
                      onAdd={(id) => setDraft({ ...draft, moduleData: { ...(draft.moduleData as any || {}), requiredCharacters: [...((draft.moduleData as any)?.requiredCharacters || []), id] } })}
                      onRemove={(id) => setDraft({ ...draft, moduleData: { ...(draft.moduleData as any || {}), requiredCharacters: ((draft.moduleData as any)?.requiredCharacters || []).filter((c: string) => c !== id) } })}
                    />
                  </F>
                  <F label="消耗技能" hint="此模块触发时消耗的技能">
                    <TagSelect label="技能" options={skillOptions}
                      selected={(draft.moduleData as any)?.consumesSkills || []}
                      onAdd={(id) => setDraft({ ...draft, moduleData: { ...(draft.moduleData as any || {}), consumesSkills: [...((draft.moduleData as any)?.consumesSkills || []), id] } })}
                      onRemove={(id) => setDraft({ ...draft, moduleData: { ...(draft.moduleData as any || {}), consumesSkills: ((draft.moduleData as any)?.consumesSkills || []).filter((s: string) => s !== id) } })}
                    />
                  </F>
                  <F label="模块描述" hint="LLM 看到此阶段时的背景说明">
                    <textarea className="input" rows={3} value={(draft.moduleData as any)?.description || ""}
                      onChange={(e) => setDraft({ ...draft, moduleData: { ...(draft.moduleData as any || {}), description: e.target.value } })} />
                  </F>
                  <F label="AI 引导语 (guidance)" hint="具体剧情走向、角色行为、氛围、推进条件">
                    <textarea className="input mono" rows={6}
                      value={(draft.moduleData as any)?.guidance || ""}
                      onChange={(e) => setDraft({ ...draft, moduleData: { ...(draft.moduleData as any || {}), guidance: e.target.value } })}
                      placeholder={"氛围：阴冷潮湿的地牢中...\n\n角色A：**动作**（描述）\n角色B：**反应**（描述）\n→ 推进条件：角色A完成训练目标"} />
                  </F>
                  <div className="form-grid cols-2">
                    <F label="进入条件" hint="此模块被触发的叙事条件">
                      <input className="input" value={(draft.moduleData as any)?.enterWhen || ""}
                        onChange={(e) => setDraft({ ...draft, moduleData: { ...(draft.moduleData as any || {}), enterWhen: e.target.value } })} />
                    </F>
                    <F label="退出条件" hint="此模块可以结束的叙事条件">
                      <input className="input" value={(draft.moduleData as any)?.exitCondition || ""}
                        onChange={(e) => setDraft({ ...draft, moduleData: { ...(draft.moduleData as any || {}), exitCondition: e.target.value } })} />
                    </F>
                  </div>
                </>
              )}
            </>
          )}

          {/* ═══════ CHOICE ═══════ */}
          {nodeType === "choice" && (
            <>
              <F label="抉择标题" hint="如：侍女的选择">
                <input className="input" value={draft.label || ""}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
              </F>
              <div>
                <div className="flex-between mb2">
                  <span className="card-section-title" style={{ margin: 0, padding: 0 }}>分支选项</span>
                  <button className="btn btn-xs"
                    onClick={() => {
                      const brs = [...(draft.branches as any[] || []), { choiceText: "", targetStage: "" }];
                      setDraft({ ...draft, branches: brs });
                    }}>+ 添加分支</button>
                </div>
                <p className="faint mb2">每个分支 = 玩家看到的选择按钮 + 跳转目标阶段。连线时从右侧端口拖到目标节点。</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--s1)", maxHeight: 240, overflow: "auto" }}>
                  {(draft.branches as any[] || []).map((b, i) => (
                    <BranchRow key={i} b={b} i={i}
                      onChange={(idx, field, val) => {
                        const brs = [...(draft.branches as any[] || [])];
                        brs[idx] = { ...brs[idx], [field]: val };
                        setDraft({ ...draft, branches: brs });
                      }}
                      onRemove={(idx) => setDraft({ ...draft, branches: (draft.branches as any[] || []).filter((_, j) => j !== idx) })}
                    />
                  ))}
                </div>
              </div>
              <F label="条件 (可选)" hint="显示此抉择的前置条件">
                <input className="input" value={(draft as any).condition || ""}
                  onChange={(e) => setDraft({ ...draft, condition: e.target.value })} />
              </F>
            </>
          )}

          {/* ═══════ JUDGMENT ═══════ */}
          {nodeType === "judgment" && (
            <>
              <F label="判定名称" hint="如：皇帝满意度判定">
                <input className="input" value={draft.label || ""}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
              </F>
              <F label="判定者" hint="谁来判断（从角色列表中选择）">
                <select className="input" value={(draft.judgmentData as any)?.judge || ""}
                  onChange={(e) => setDraft({ ...draft, judgmentData: { ...(draft.judgmentData as any || {}), judge: e.target.value } })}>
                  <option value="">手动输入</option>
                  {charOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </F>
              <F label="判定说明" hint="给 LLM 的判断逻辑解释">
                <textarea className="input" rows={3} value={(draft.judgmentData as any)?.description || ""}
                  onChange={(e) => setDraft({ ...draft, judgmentData: { ...(draft.judgmentData as any || {}), description: e.target.value } })} />
              </F>
              <div className="card-section-title" style={{ margin: 0, padding: 0 }}>分支（默认：是 / 否）</div>
              <p className="faint">绿色端口 = 是/通过，红色端口 = 否/拒绝。连线到对应目标节点。</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--s1)" }}>
                {(draft.branches as any[] || [{ choiceText: "是", targetStage: "" }, { choiceText: "否", targetStage: "" }]).map((b, i) => (
                  <BranchRow key={i} b={b} i={i}
                    onChange={(idx, field, val) => {
                      const brs = [...(draft.branches as any[] || [{ choiceText: "是", targetStage: "" }, { choiceText: "否", targetStage: "" }])];
                      brs[idx] = { ...brs[idx], [field]: val };
                      setDraft({ ...draft, branches: brs });
                    }}
                    onRemove={(idx) => setDraft({ ...draft, branches: (draft.branches as any[] || []).filter((_, j) => j !== idx) })}
                  />
                ))}
              </div>
              <F label="评分方法 (JSON)" hint="高级：定义多维度评分。留空则使用 LLM 自由判断。">
                <textarea className="input mono" rows={6}
                  value={JSON.stringify((draft.judgmentData as any)?.scoringMethods || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setDraft({ ...draft, judgmentData: { ...(draft.judgmentData as any || {}), scoringMethods: parsed } });
                    } catch { /* allow invalid JSON while typing */ }
                  }}
                  placeholder={`{\n  "score_3d": {\n    "dimensions": {\n      "服从度": { "min": 0, "max": 100 },\n      "技巧": { "min": 0, "max": 100 }\n    },\n    "thresholdsByCycle": { "1": 80, "2": 85 }\n  }\n}`}
                />
              </F>
            </>
          )}

          {/* ═══════ EVENT TRIGGER ═══════ */}
          {nodeType === "eventTrigger" && (
            <>
              <F label="事件名称">
                <input className="input" value={draft.label || ""}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  placeholder="如：突发事件" />
              </F>
              <F label="事件描述" hint="给 LLM 的事件说明">
                <textarea className="input" rows={4} value={(draft.eventDescription as string) || ""}
                  onChange={(e) => setDraft({ ...draft, eventDescription: e.target.value })}
                  placeholder="如：皇帝突然驾到，要求侍女立刻展示这段时间所学的技能..." />
              </F>
            </>
          )}

          {/* ═══════ RANDOM EVENT ═══════ */}
          {nodeType === "randomEvent" && (
            <>
              <F label="随机事件名称" hint="如：随机惩戒事件池">
                <input className="input" value={draft.label || ""}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
              </F>
              <div>
                <div className="flex-between mb2">
                  <span className="card-section-title" style={{ margin: 0, padding: 0 }}>随机池（触发时从中随机选一个）</span>
                  <button className="btn btn-xs"
                    onClick={() => {
                      const pool = [...(draft.randomPool as any[] || []), { id: "", title: "" }];
                      setDraft({ ...draft, randomPool: pool });
                    }}>+ 添加条目</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--s1)", maxHeight: 240, overflow: "auto" }}>
                  {(draft.randomPool as any[] || []).map((item, i) => (
                    <PoolRow key={i} item={item} i={i}
                      onChange={(idx, field, val) => {
                        const pool = [...(draft.randomPool as any[] || [])];
                        pool[idx] = { ...pool[idx], [field]: val };
                        setDraft({ ...draft, randomPool: pool });
                      }}
                      onRemove={(idx) => setDraft({ ...draft, randomPool: (draft.randomPool as any[] || []).filter((_, j) => j !== idx) })}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ═══════ RANDOM JUDGMENT ═══════ */}
          {nodeType === "randomJudgment" && (
            <>
              <F label="随机判定名称" hint="如：随机检查">
                <input className="input" value={draft.label || ""}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
              </F>
              <div>
                <div className="flex-between mb2">
                  <span className="card-section-title" style={{ margin: 0, padding: 0 }}>随机判题池</span>
                  <button className="btn btn-xs"
                    onClick={() => {
                      const pool = [...(draft.randomPool as any[] || []), { id: "", title: "" }];
                      setDraft({ ...draft, randomPool: pool });
                    }}>+ 添加</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--s1)", maxHeight: 160, overflow: "auto" }}>
                  {(draft.randomPool as any[] || []).map((item, i) => (
                    <PoolRow key={i} item={item} i={i}
                      onChange={(idx, field, val) => {
                        const pool = [...(draft.randomPool as any[] || [])];
                        pool[idx] = { ...pool[idx], [field]: val };
                        setDraft({ ...draft, randomPool: pool });
                      }}
                      onRemove={(idx) => setDraft({ ...draft, randomPool: (draft.randomPool as any[] || []).filter((_, j) => j !== idx) })}
                    />
                  ))}
                </div>
              </div>
              <div className="card-section-title" style={{ margin: 0, padding: 0 }}>结果分支（命中 / 未命中）</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--s1)" }}>
                {(draft.branches as any[] || [{ choiceText: "命中", targetStage: "" }, { choiceText: "未命中", targetStage: "" }]).map((b, i) => (
                  <BranchRow key={i} b={b} i={i}
                    onChange={(idx, field, val) => {
                      const brs = [...(draft.branches as any[] || [{ choiceText: "命中", targetStage: "" }, { choiceText: "未命中", targetStage: "" }])];
                      brs[idx] = { ...brs[idx], [field]: val };
                      setDraft({ ...draft, branches: brs });
                    }}
                    onRemove={(idx) => setDraft({ ...draft, branches: (draft.branches as any[] || []).filter((_, j) => j !== idx) })}
                  />
                ))}
              </div>
            </>
          )}

          {/* ═══════ LOOP ═══════ */}
          {nodeType === "loop" && (
            <>
              <F label="循环名称" hint="如：侍寝循环">
                <input className="input" value={draft.label || ""}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
              </F>
              <div className="form-grid cols-2">
                <F label="起始循环编号">
                  <input className="input" type="number" value={(draft.loopData as any)?.initialCycle || 1}
                    onChange={(e) => setDraft({ ...draft, loopData: { ...(draft.loopData as any || {}), initialCycle: Math.max(1, Number(e.target.value) || 1) } })} />
                </F>
                <F label="最大循环次数 (0=无限)">
                  <input className="input" type="number" value={(draft.loopData as any)?.maxCycles || 0}
                    onChange={(e) => setDraft({ ...draft, loopData: { ...(draft.loopData as any || {}), maxCycles: Number(e.target.value) === 0 ? null : Math.max(1, Number(e.target.value)) } })} />
                </F>
              </div>
              <F label="循环描述" hint="给 LLM 看到的循环说明">
                <textarea className="input" rows={2} value={(draft.loopData as any)?.description || ""}
                  onChange={(e) => setDraft({ ...draft, loopData: { ...(draft.loopData as any || {}), description: e.target.value } })} />
              </F>
              <div style={{
                background: "var(--bg)", border: "1px solid var(--border-light)", borderRadius: "var(--r-md)",
                padding: "var(--s3)", marginTop: "var(--s2)",
              }}>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, marginBottom: "var(--s1)", color: "var(--cat-blue)" }}>
                  周期模块映射由连线自动决定
                </div>
                <p className="faint" style={{ margin: 0 }}>
                  在画布上连接判定节点的 <b>红色端口 (branch_1/否)</b> 到惩戒模块即可自动建立周期映射。
                  侍寝模块按画布 X 坐标排序分配周期编号，最后一个为 "default"（兜底）。
                  无需在此手动填写模块 ID。
                </p>
              </div>
            </>
          )}

          {/* ═══════ DAILY TRIGGER ═══════ */}
          {nodeType === "dailyTrigger" && (
            <>
              <F label="触发器名称">
                <input className="input" value={draft.label || ""}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  placeholder="如：每日早起检查" />
              </F>
              <F label="触发规则" hint="自然语言描述触发条件，由 LLM 判断是否触发">
                <textarea className="input" rows={3} value={(draft.triggerRule as string) || ""}
                  onChange={(e) => setDraft({ ...draft, triggerRule: e.target.value })}
                  placeholder="如：每天早晨自动触发。检查侍女的仪容仪表、房间卫生..." />
              </F>
              <F label="关联模块" hint="触发后执行的模块">
                <select className="input" value={(draft.moduleRef as string) || ""}
                  onChange={(e) => setDraft({ ...draft, moduleRef: e.target.value || undefined })}>
                  <option value="">不关联</option>
                  {allModules.map((m) => <option key={m.id} value={m.id}>{m.title} ({m.id})</option>)}
                </select>
              </F>
            </>
          )}

          {/* ═══════ START / END ═══════ */}
          {(nodeType === "start" || nodeType === "end") && (
            <F label={nodeType === "start" ? "开始节点名称" : "结束节点名称"}>
              <input className="input" value={draft.label || (nodeType === "start" ? "START" : "END")}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            </F>
          )}

          {/* ─── Actions ─── */}
          <div className="flex-center gap2" style={{ justifyContent: "flex-end", borderTop: "1px solid var(--border-light)", paddingTop: "var(--s4)" }}>
            <button className="btn" onClick={onClose}>取消</button>
            <button className="btn btn-primary" onClick={() => { onSave(draft); onClose(); }}>保存</button>
          </div>
        </div>
      </div>
    </>
  );
}
