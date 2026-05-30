import { useState, useMemo, useCallback } from "react";
import { useEditorStore } from "../store/editorStore.js";
import type { Skill } from "@story-game/shared";

type SkillType = "主动" | "被动";

interface NewSkillForm {
  name: string;
  type: SkillType;
  description: string;
  trigger: string;
  sampleLine: string;
}

const EMPTY_FORM: NewSkillForm = { name: "", type: "主动", description: "", trigger: "", sampleLine: "" };

function isPassive(s: Skill): boolean {
  return (s.effect || "").startsWith("被动");
}

function getSubType(s: Skill): string {
  const parts = (s.effect || "").split("|");
  return parts[1] || "";
}

export function CharacterSkills() {
  const { storyPackage, updateSkill, updateSkills } = useEditorStore();
  const skills = storyPackage?.skills || [];
  const chars = storyPackage?.characters || [];

  const [activeChar, setActiveChar] = useState<string>(chars[0]?.id || "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<NewSkillForm>(EMPTY_FORM);

  const charSkills = useMemo(
    () => skills.filter((s) => s.ownerId === activeChar),
    [skills, activeChar]
  );

  const activeSkills = useMemo(() => charSkills.filter((s) => !isPassive(s)), [charSkills]);
  const passiveSkills = useMemo(() => charSkills.filter((s) => isPassive(s)), [charSkills]);

  const selected = skills.find((s) => s.id === selectedId) || null;

  const charCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of skills) m[s.ownerId] = (m[s.ownerId] || 0) + 1;
    return m;
  }, [skills]);

  const handleAdd = useCallback(() => {
    if (!form.name.trim() || !activeChar) return;
    const id = `skill_${form.name.trim().replace(/\s+/g, "_").toLowerCase()}_${Date.now()}`;
    const effectTag = form.type === "被动"
      ? `被动|${form.trigger || ""}`
      : `主动|${form.trigger || ""}`;
    const s: Skill = {
      id,
      name: form.name.trim(),
      ownerId: activeChar,
      cost: { mp: 0 },
      effect: effectTag,
      description: form.description,
      sampleLine: form.sampleLine || undefined,
    };
    updateSkills([...skills, s]);
    setSelectedId(s.id);
    setForm(EMPTY_FORM);
    setShowAddModal(false);
  }, [form, activeChar, skills, updateSkills]);

  function handleDelete(id: string) {
    updateSkills(skills.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function handleTypeChange(skill: Skill, newType: SkillType) {
    const subType = getSubType(skill);
    const newEffect = `${newType}|${subType}`;
    updateSkill({ ...skill, effect: newEffect });
  }

  return (
    <div className="panel">
      {/* Header */}
      <div className="panel-header">
        <div>
          <h2>角色技能</h2>
          <span className="faint">{skills.length} 技能 · {chars.length} 角色</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>+ 新建技能</button>
      </div>

      {/* Character tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--border)" }}>
        {chars.map((c) => {
          const count = charCounts[c.id] || 0;
          const active = activeChar === c.id;
          return (
            <button key={c.id} onClick={() => { setActiveChar(c.id); setSelectedId(null); }}
              style={{
                padding: "var(--s2) var(--s5)", cursor: "pointer",
                background: active ? "var(--surface)" : "transparent",
                border: "none", borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                color: active ? "var(--text)" : "var(--text-muted)",
                fontFamily: "var(--font)", fontSize: "var(--fs-sm)", fontWeight: active ? 600 : 400,
                transition: "all 0.1s", marginBottom: -2,
                display: "flex", alignItems: "center", gap: "var(--s2)",
              }}>
              {c.name}
              <span style={{
                fontSize: 9, padding: "0 4px", borderRadius: 8,
                background: active ? "var(--accent-bg)" : "var(--surface)",
                color: active ? "var(--accent-hover)" : "var(--text-faint)",
                fontWeight: 500, minWidth: 16, textAlign: "center",
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <AddSkillModal
          form={form}
          setForm={setForm}
          onConfirm={handleAdd}
          onCancel={() => { setShowAddModal(false); setForm(EMPTY_FORM); }}
          charName={chars.find(c => c.id === activeChar)?.name || ""}
        />
      )}

      {/* Main area: two columns + detail */}
      <div className="panel-body" style={{ display: "flex", gap: "var(--s4)", minHeight: 320 }}>
        {/* Left column: 主动技能 */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <div style={{ fontSize: "var(--fs-sm)", fontWeight: 700, color: "var(--cat-red)", marginBottom: "var(--s2)", display: "flex", alignItems: "center", gap: "var(--s2)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--cat-red)" }} />
            主动技能 ({activeSkills.length})
          </div>
          {activeSkills.length === 0 ? (
            <p className="faint" style={{ fontSize: "var(--fs-xs)" }}>暂无主动技能</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s1)" }}>
              {activeSkills.map((s) => (
                <SkillCard key={s.id} skill={s} active={selectedId === s.id} onClick={() => setSelectedId(selectedId === s.id ? null : s.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Right column: 被动技能 */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <div style={{ fontSize: "var(--fs-sm)", fontWeight: 700, color: "var(--cat-blue)", marginBottom: "var(--s2)", display: "flex", alignItems: "center", gap: "var(--s2)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--cat-blue)" }} />
            被动技能 ({passiveSkills.length})
          </div>
          {passiveSkills.length === 0 ? (
            <p className="faint" style={{ fontSize: "var(--fs-xs)" }}>暂无被动技能</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s1)" }}>
              {passiveSkills.map((s) => (
                <SkillCard key={s.id} skill={s} active={selectedId === s.id} onClick={() => setSelectedId(selectedId === s.id ? null : s.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Detail editor */}
        {selected && (
          <div className="detail-panel" style={{ width: 380, flexShrink: 0, alignSelf: "flex-start", maxHeight: "100%", overflow: "auto" }}>
            <div className="dp-header">
              <div>
                <h3>{selected.name}</h3>
                <span className="faint mono">{selected.id}</span>
              </div>
              <div className="flex-center gap1">
                <button className="btn btn-danger btn-xs" onClick={() => handleDelete(selected.id)}>删除</button>
                <button className="btn btn-ghost btn-xs" onClick={() => setSelectedId(null)}>✕</button>
              </div>
            </div>
            <div className="dp-body">
              <label className="field"><span>名称</span>
                <input className="input" value={selected.name} onChange={(e) => updateSkill({ ...selected, name: e.target.value })} />
              </label>
              <label className="field mt3"><span>所属角色</span>
                <select className="input" value={selected.ownerId || ""} onChange={(e) => updateSkill({ ...selected, ownerId: e.target.value })}>
                  <option value="">未分配</option>
                  {chars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="field mt3"><span>技能类型</span>
                <select className="input" value={isPassive(selected) ? "被动" : "主动"}
                  onChange={(e) => handleTypeChange(selected, e.target.value as SkillType)}>
                  <option value="主动">主动（角色可执行的行动）</option>
                  <option value="被动">被动（被触发时的反应）</option>
                </select>
              </label>
              <label className="field mt3"><span>{isPassive(selected) ? "触发条件" : "子类型标签"}</span>
                <input className="input" value={getSubType(selected)}
                  onChange={(e) => {
                    const prefix = isPassive(selected) ? "被动" : "主动";
                    updateSkill({ ...selected, effect: `${prefix}|${e.target.value}` });
                  }}
                  placeholder={isPassive(selected) ? "触发此反应的行动名称（如：强吻）" : "分类标签（如：束缚、亲密）"} />
              </label>
              <label className="field mt3"><span>{isPassive(selected) ? "反应描述" : "行动描述"}</span>
                <textarea className="input" rows={5} value={selected.description || ""} onChange={(e) => updateSkill({ ...selected, description: e.target.value })}
                  placeholder={isPassive(selected) ? "角色被触发时的身体/心理反应描述..." : "角色执行此行动时的详细描述..."} />
              </label>
              <label className="field mt3"><span>示例台词</span>
                <input className="input" value={selected.sampleLine || ""} onChange={(e) => updateSkill({ ...selected, sampleLine: e.target.value || undefined })}
                  placeholder="角色使用此技能时的台词" />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Add Skill Modal ─── */
function AddSkillModal({ form, setForm, onConfirm, onCancel, charName }: {
  form: NewSkillForm;
  setForm: (f: NewSkillForm) => void;
  onConfirm: () => void;
  onCancel: () => void;
  charName: string;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{
        background: "var(--surface)", borderRadius: "var(--r-lg)", padding: "var(--s6)",
        width: 480, maxHeight: "80vh", overflow: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <h3 style={{ margin: "0 0 var(--s4) 0", fontSize: "var(--fs-lg)" }}>
          为「{charName}」新建技能
        </h3>

        <label className="field">
          <span>技能名称 *</span>
          <input className="input" value={form.name} autoFocus
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter" && form.name.trim()) onConfirm(); if (e.key === "Escape") onCancel(); }}
            placeholder="如：强吻、身体颤抖" />
        </label>

        <label className="field mt3">
          <span>技能类型 *</span>
          <select className="input" value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as SkillType })}>
            <option value="主动">主动 — 角色可以执行的行动</option>
            <option value="被动">被动 — 被某个行动触发的反应</option>
          </select>
        </label>

        <label className="field mt3">
          <span>{form.type === "被动" ? "触发条件（被什么行动触发）" : "子类型标签"}</span>
          <input className="input" value={form.trigger}
            onChange={(e) => setForm({ ...form, trigger: e.target.value })}
            placeholder={form.type === "被动" ? "如：强吻、揉捏乳房" : "如：束缚、亲密、命令"} />
        </label>

        <label className="field mt3">
          <span>{form.type === "被动" ? "反应描述 *" : "行动描述 *"}</span>
          <textarea className="input" rows={4} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={form.type === "被动"
              ? "描述角色被触发时的身体反应、心理变化..."
              : "描述角色执行此行动时的具体过程..."} />
        </label>

        <label className="field mt3">
          <span>示例台词（可选）</span>
          <input className="input" value={form.sampleLine}
            onChange={(e) => setForm({ ...form, sampleLine: e.target.value })}
            placeholder="角色在此情境下可能说的话" />
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--s2)", marginTop: "var(--s5)" }}>
          <button className="btn btn-sm" onClick={onCancel}>取消</button>
          <button className="btn btn-primary btn-sm" onClick={onConfirm}
            disabled={!form.name.trim() || !form.description.trim()}>
            创建技能
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Skill Card ─── */
function SkillCard({ skill, active, onClick }: { skill: Skill; active: boolean; onClick: () => void }) {
  const passive = isPassive(skill);
  const color = passive ? "var(--cat-blue)" : "var(--cat-red)";
  const subType = getSubType(skill);

  return (
    <button onClick={onClick}
      style={{
        textAlign: "left", fontFamily: "var(--font)",
        padding: "var(--s3)", borderRadius: "var(--r-md)",
        cursor: "pointer",
        background: active ? `${color}15` : "var(--bg2)",
        border: active ? `2px solid ${color}` : "1px solid var(--border-light)",
        borderLeft: `3px solid ${color}`,
        transition: "all 0.1s",
      }}>
      <div style={{ fontWeight: 600, fontSize: "var(--fs-sm)", color: "var(--text)", marginBottom: 2 }}>
        {skill.name}
      </div>
      {subType && (
        <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: `${color}20`, color, fontWeight: 600 }}>
          {passive ? `触发: ${subType}` : subType}
        </span>
      )}
      {skill.description && (
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.3 }}>
          {skill.description.slice(0, 80)}
        </div>
      )}
    </button>
  );
}
