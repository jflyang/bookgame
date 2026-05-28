import { useState, useMemo } from "react";
import { useEditorStore } from "../store/editorStore.js";
import type { Skill } from "@story-game/shared";

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  damage: { label: "伤害", color: "var(--cat-red)" },
  heal: { label: "回复", color: "var(--cat-green)" },
  buff: { label: "强化", color: "var(--cat-blue)" },
  debuff: { label: "弱化", color: "var(--cat-purple)" },
  control: { label: "控制", color: "var(--cat-orange)" },
  special: { label: "特殊", color: "var(--cat-pink)" },
};

function guessType(s: Skill): string {
  if (s.damage?.max && s.damage.max > 0) return "damage";
  if (s.cost.mp < 0 || s.effect?.includes("回复") || s.effect?.includes("恢复")) return "heal";
  if (s.effect?.includes("强化") || s.effect?.includes("提升") || s.effect?.includes("增益")) return "buff";
  if (s.effect?.includes("弱化") || s.effect?.includes("降低") || s.effect?.includes("减益")) return "debuff";
  if (s.effect?.includes("眩晕") || s.effect?.includes("束缚") || s.effect?.includes("控制")) return "control";
  return "special";
}

export function SkillTree() {
  const { storyPackage, updateSkill, updateSkills } = useEditorStore();
  const skills = storyPackage?.skills || [];
  const chars = storyPackage?.characters || [];

  // Active character tab
  const [activeChar, setActiveChar] = useState<string>(chars[0]?.id || "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const charSkills = useMemo(
    () => skills.filter((s) => s.ownerId === activeChar),
    [skills, activeChar]
  );
  const selected = skills.find((s) => s.id === selectedId) || null;

  // Count skills per character
  const charCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of skills) {
      m[s.ownerId] = (m[s.ownerId] || 0) + 1;
    }
    return m;
  }, [skills]);

  function handleAdd() {
    if (!newName.trim() || !activeChar) return;
    const id = `skill_${newName.trim().replace(/\s+/g, "_").toLowerCase()}_${Date.now()}`;
    const s: Skill = {
      id, name: newName.trim(), ownerId: activeChar,
      cost: { mp: 10 }, effect: "", description: "",
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
          <span className="faint">{skills.length} 技能 &middot; {chars.length} 角色</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
          + 新技能
        </button>
      </div>

      {/* Character tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--border)" }}>
        {chars.map((c) => {
          const count = charCounts[c.id] || 0;
          const active = activeChar === c.id;
          return (
            <button
              key={c.id}
              onClick={() => { setActiveChar(c.id); setSelectedId(null); }}
              style={{
                padding: "var(--s2) var(--s5)", cursor: "pointer",
                background: active ? "var(--surface)" : "transparent",
                border: "none", borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                color: active ? "var(--text)" : "var(--text-muted)",
                fontFamily: "var(--font)", fontSize: "var(--fs-sm)", fontWeight: active ? 600 : 400,
                transition: "all 0.1s", marginBottom: -2,
                display: "flex", alignItems: "center", gap: "var(--s2)",
              }}
            >
              {c.name}
              <span style={{
                fontSize: 9, padding: "0 4px", borderRadius: 8,
                background: active ? "var(--accent-bg)" : "var(--surface)",
                color: active ? "var(--accent-hover)" : "var(--text-faint)",
                fontWeight: 500, minWidth: 16, textAlign: "center",
              }}>
                {count}
              </span>
            </button>
          );
        })}
        {/* Unassigned tab */}
        {(() => {
          const orphan = skills.filter((s) => !s.ownerId || !chars.find((c) => c.id === s.ownerId));
          if (!orphan.length) return null;
          const active = activeChar === "__orphan__";
          return (
            <button
              key="__orphan__"
              onClick={() => { setActiveChar("__orphan__"); setSelectedId(null); }}
              style={{
                padding: "var(--s2) var(--s5)", cursor: "pointer",
                background: active ? "var(--surface)" : "transparent",
                border: "none", borderBottom: active ? "2px solid var(--warning)" : "2px solid transparent",
                color: active ? "var(--text)" : "var(--text-muted)",
                fontFamily: "var(--font)", fontSize: "var(--fs-sm)", fontWeight: active ? 600 : 400,
                transition: "all 0.1s", marginBottom: -2,
              }}
            >
              未分配
              <span style={{
                fontSize: 9, padding: "0 4px", borderRadius: 8,
                background: "var(--warning-bg)", color: "var(--warning)",
                fontWeight: 500, marginLeft: "var(--s2)",
              }}>{orphan.length}</span>
            </button>
          );
        })()}
      </div>

      {/* Main area: skill grid + detail */}
      <div className="panel-body" style={{ display: "flex", gap: "var(--s4)", minHeight: 320 }}>
        {/* Left: Skill grid */}
        <div style={{ flex: 1, overflow: "auto" }}>
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
                  placeholder={`为 ${chars.find((c) => c.id === activeChar)?.name || "角色"} 添加新技能...`}
                  autoFocus
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={!newName.trim()}>
                  确认
                </button>
                <button className="btn btn-sm" onClick={() => setAdding(false)}>取消</button>
              </div>
            </div>
          )}

          {charSkills.length === 0 ? (
            <div className="empty-state">
              <p>{chars.find((c) => c.id === activeChar)?.name || "该角色"} 暂无技能</p>
              <span className="hint">点击上方「+ 新技能」添加</span>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: "var(--s2)",
            }}>
              {charSkills.map((s) => {
                const type = guessType(s);
                const info = TYPE_LABELS[type];
                const active = selectedId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedId(active ? null : s.id)}
                    style={{
                      textAlign: "left", fontFamily: "var(--font)",
                      padding: "var(--s4)", borderRadius: "var(--r-lg)",
                      cursor: "pointer",
                      background: active ? `${info.color}15` : "var(--bg2)",
                      border: active ? `2px solid ${info.color}` : "1px solid var(--border-light)",
                      borderLeft: `3px solid ${info.color}`,
                      transition: "all 0.1s",
                      display: "flex", flexDirection: "column",
                      justifyContent: "space-between",
                      minHeight: 80,
                    }}
                  >
                    <div>
                      <div style={{
                        fontWeight: 700, fontSize: "var(--fs-md)", color: "var(--text)",
                        marginBottom: 2, lineHeight: 1.3,
                      }}>
                        {s.name}
                      </div>
                      {s.effect && (
                        <div style={{
                          fontSize: 10, color: "var(--text-muted)",
                          overflow: "hidden", textOverflow: "ellipsis",
                          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                          lineHeight: 1.3,
                        }}>
                          {s.effect}
                        </div>
                      )}
                    </div>
                    <div className="flex-between mt2">
                      <span style={{
                        fontSize: 9, padding: "1px 5px", borderRadius: 3,
                        background: `${info.color}20`, color: info.color, fontWeight: 600,
                      }}>
                        {info.label}
                      </span>
                      <span className="faint" style={{ fontSize: 9 }}>
                        MP {s.cost.mp}
                        {s.damage?.max ? ` | ${s.damage.min}-${s.damage.max}` : ""}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Detail editor */}
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
              <label className="field">
                <span>名称</span>
                <input className="input" value={selected.name}
                  onChange={(e) => updateSkill({ ...selected, name: e.target.value })} />
              </label>

              <label className="field mt3">
                <span>ID</span>
                <input className="input mono" value={selected.id}
                  onChange={(e) => updateSkill({ ...selected, id: e.target.value })} />
              </label>

              <label className="field mt3">
                <span>所属角色</span>
                <select className="input" value={selected.ownerId || ""}
                  onChange={(e) => updateSkill({ ...selected, ownerId: e.target.value })}>
                  <option value="">未分配</option>
                  {chars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>

              <div className="form-grid cols-3 mt3">
                <label className="field">
                  <span>MP消耗</span>
                  <input className="input" type="number" value={selected.cost.mp}
                    onChange={(e) => updateSkill({ ...selected, cost: { mp: Math.max(0, Number(e.target.value)) } })} />
                </label>
                <label className="field">
                  <span>伤害 Min</span>
                  <input className="input" type="number" value={selected.damage?.min ?? ""}
                    onChange={(e) => {
                      const min = e.target.value ? Number(e.target.value) : 0;
                      updateSkill({ ...selected, damage: { min, max: selected.damage?.max ?? 0 } });
                    }} />
                </label>
                <label className="field">
                  <span>伤害 Max</span>
                  <input className="input" type="number" value={selected.damage?.max ?? ""}
                    onChange={(e) => {
                      const max = e.target.value ? Number(e.target.value) : 0;
                      updateSkill({ ...selected, damage: { min: selected.damage?.min ?? 0, max } });
                    }} />
                </label>
              </div>

              <label className="field mt3">
                <span>效果</span>
                <input className="input" value={selected.effect || ""}
                  onChange={(e) => updateSkill({ ...selected, effect: e.target.value })} />
              </label>

              <label className="field mt3">
                <span>描述</span>
                <textarea className="input" rows={2} value={selected.description || ""}
                  onChange={(e) => updateSkill({ ...selected, description: e.target.value })} />
              </label>

              {/* Sample line preview */}
              {selected.sampleLine && (
                <label className="field mt3">
                  <span>示例台词</span>
                  <div style={{
                    padding: "var(--s3)", borderRadius: "var(--r-md)",
                    background: "var(--surface)", fontSize: "var(--fs-sm)",
                    color: "var(--text2)", fontStyle: "italic", lineHeight: 1.6,
                  }}>
                    {selected.sampleLine}
                  </div>
                </label>
              )}

              {/* Quick nav */}
              <div className="mt4" style={{ borderTop: "1px solid var(--border-light)", paddingTop: "var(--s3)" }}>
                <span className="section-title" style={{ padding: 0 }}>切换技能</span>
                <select className="input mt2" value={selected.id}
                  onChange={(e) => setSelectedId(e.target.value)}>
                  {charSkills.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
