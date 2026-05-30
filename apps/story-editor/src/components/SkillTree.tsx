import { useState, useMemo } from "react";
import { useEditorStore } from "../store/editorStore.js";
import type { Skill } from "@story-game/shared";

function isPassive(s: Skill): boolean {
  return (s.effect || "").startsWith("被动");
}

function getSubType(s: Skill): string {
  const parts = (s.effect || "").split("|");
  return parts[1] || "";
}

export function SkillTree() {
  const { storyPackage, updateSkill, updateSkills } = useEditorStore();
  const skills = storyPackage?.skills || [];
  const chars = storyPackage?.characters || [];

  const [activeChar, setActiveChar] = useState<string>(chars[0]?.id || "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addType, setAddType] = useState<"主动" | "被动">("主动");
  const [newName, setNewName] = useState("");

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

  function handleAdd() {
    if (!newName.trim() || !activeChar) return;
    const id = `skill_${newName.trim().replace(/\s+/g, "_").toLowerCase()}_${Date.now()}`;
    const s: Skill = {
      id, name: newName.trim(), ownerId: activeChar,
      cost: { mp: 0 }, effect: `${addType}|`, description: "",
    };
    updateSkills([...skills, s]);
    setSelectedId(s.id);
    setNewName("");
    setAdding(false);
  }

  function handleDelete(id: string) {
    updateSkills(skills.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  return (
    <div className="panel">
      {/* Header */}
      <div className="panel-header">
        <div>
          <h2>技能树</h2>
          <span className="faint">{skills.length} 技能 · {chars.length} 角色</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ 新技能</button>
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

      {/* Add form */}
      {adding && (
        <div className="card" style={{ borderColor: "var(--accent-border)", background: "var(--accent-bg)", marginTop: "var(--s3)" }}>
          <div className="flex-center gap2">
            <select className="input" style={{ width: 80 }} value={addType} onChange={(e) => setAddType(e.target.value as any)}>
              <option value="主动">主动</option>
              <option value="被动">被动</option>
            </select>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
              placeholder="技能名称..." autoFocus style={{ flex: 1 }} />
            <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={!newName.trim()}>确认</button>
            <button className="btn btn-sm" onClick={() => setAdding(false)}>取消</button>
          </div>
        </div>
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
          <div className="detail-panel" style={{ width: 340, flexShrink: 0, alignSelf: "flex-start", maxHeight: "100%", overflow: "auto" }}>
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
              <label className="field mt3"><span>类型标签</span>
                <input className="input" value={selected.effect || ""} onChange={(e) => updateSkill({ ...selected, effect: e.target.value })} placeholder="主动|束缚 或 被动|身体反应" />
              </label>
              <label className="field mt3"><span>实施/反应描述</span>
                <textarea className="input" rows={5} value={selected.description || ""} onChange={(e) => updateSkill({ ...selected, description: e.target.value })} placeholder="详细描述技能的实施过程或身体反应..." />
              </label>
              <label className="field mt3"><span>示例台词</span>
                <input className="input" value={selected.sampleLine || ""} onChange={(e) => updateSkill({ ...selected, sampleLine: e.target.value || undefined })} placeholder="角色使用此技能时的台词" />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
          {subType}
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
