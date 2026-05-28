import { useState, useMemo } from "react";
import { useEditorStore } from "../store/editorStore.js";
import type { StoryPromptRule } from "@story-game/shared";

const CATEGORIES = ["knowledge_forcing", "group_chat_boundary", "scenario_injection", "state_output", "history_state", "combat", "custom"];

const CATEGORY_INFO: Record<string, { label: string; color: string; order: number }> = {
  knowledge_forcing: { label: "知识库强制", color: "var(--cat-blue)", order: 1 },
  group_chat_boundary: { label: "群聊边界", color: "var(--cat-green)", order: 2 },
  scenario_injection: { label: "场景注入", color: "var(--cat-orange)", order: 3 },
  state_output: { label: "状态输出", color: "var(--cat-red)", order: 4 },
  history_state: { label: "历史状态", color: "var(--cat-purple)", order: 5 },
  combat: { label: "战斗", color: "var(--cat-pink)", order: 6 },
  custom: { label: "自定义", color: "var(--cat-gray)", order: 7 },
};

export function RulePipeline() {
  const { storyPackage, updatePromptRule, updatePromptRules } = useEditorStore();
  const rules = storyPackage?.promptRules || [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const sortedRules = useMemo(() => {
    return [...rules].sort((a, b) => {
      const oa = CATEGORY_INFO[a.category]?.order ?? 99;
      const ob = CATEGORY_INFO[b.category]?.order ?? 99;
      return oa - ob;
    });
  }, [rules]);

  const filteredRules = useMemo(() => {
    let result = sortedRules;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        r.title.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.content.toLowerCase().includes(q)
      );
    }
    if (filterCat !== "all") result = result.filter((r) => r.category === filterCat);
    return result;
  }, [sortedRules, search, filterCat]);

  const selected = rules.find((r) => r.id === selectedId) || null;
  const enabledCount = rules.filter((r) => r.enabled).length;

  const groupedRules = useMemo(() => {
    const groups: Record<string, StoryPromptRule[]> = {};
    for (const r of filteredRules) {
      const cat = r.category || "custom";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(r);
    }
    return groups;
  }, [filteredRules]);

  function handleAdd() {
    if (!newTitle.trim()) return;
    const id = `rule_${Date.now()}`;
    updatePromptRules([...rules, { id, title: newTitle.trim(), category: "custom", content: "", enabled: true }]);
    setSelectedId(id);
    setNewTitle("");
    setAdding(false);
  }

  function handleDelete(id: string) {
    updatePromptRules(rules.filter((r) => r.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function toggleRule(id: string) {
    const rule = rules.find((r) => r.id === id);
    if (rule) updatePromptRule({ ...rule, enabled: !rule.enabled });
  }

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rules) counts[r.category] = (counts[r.category] || 0) + 1;
    return counts;
  }, [rules]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>规则管线</h2>
          <span className="faint">{rules.length} 条规则 · {enabledCount} 启用</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ 添加规则</button>
      </div>

      {adding && (
        <div className="card" style={{ borderColor: "var(--accent-border)", background: "var(--accent-bg)" }}>
          <div className="flex-center gap2">
            <input className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
              placeholder="输入新规则名称..." autoFocus style={{ flex: 1 }} />
            <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={!newTitle.trim()}>确认</button>
            <button className="btn btn-sm" onClick={() => setAdding(false)}>取消</button>
          </div>
        </div>
      )}

      {/* Pipeline overview */}
      <div className="card">
        <div className="card-section-title" style={{ marginTop: 0, padding: 0 }}>执行管线</div>
        <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
          <span style={{
            padding: "4px 12px", borderRadius: 16, fontSize: "var(--fs-sm)", fontWeight: 700,
            background: "var(--accent-bg)", color: "var(--accent-hover)", whiteSpace: "nowrap",
          }}>System Prompt</span>
          <span className="faint" style={{ margin: "0 3px", fontWeight: 700 }}>→</span>

          {sortedRules.map((rule) => {
            const info = CATEGORY_INFO[rule.category] || CATEGORY_INFO.custom;
            const isSelected = selectedId === rule.id;
            return (
              <div key={rule.id} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                <button onClick={() => setSelectedId(isSelected ? null : rule.id)}
                  style={{
                    padding: "4px 10px", borderRadius: 16, cursor: "pointer",
                    background: rule.enabled ? info.color : "var(--surface)",
                    color: rule.enabled ? "#fff" : "var(--text-faint)",
                    fontSize: "var(--fs-sm)", fontWeight: 600, whiteSpace: "nowrap",
                    border: isSelected ? "2px solid #fff" : "2px solid transparent",
                    opacity: rule.enabled ? 1 : 0.5,
                    transform: isSelected ? "scale(1.08)" : "scale(1)",
                    transition: "transform 0.1s",
                    fontFamily: "var(--font)",
                    maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis",
                  }}
                  title={`${rule.title} (${info.label})\n${rule.content.slice(0, 200)}`}>
                  {rule.title}
                </button>
                <span className="faint" style={{ margin: "0 1px", fontWeight: 700 }}>&gt;</span>
              </div>
            );
          })}

          <span style={{
            padding: "4px 12px", borderRadius: 16, fontSize: "var(--fs-sm)", fontWeight: 700,
            background: "var(--surface)", color: "var(--success)", whiteSpace: "nowrap",
            border: "1px solid rgba(63,185,80,0.25)",
          }}>LLM</span>
        </div>

        {/* Category legend */}
        <div className="filter-chips mt2">
          {Object.entries(CATEGORY_INFO)
            .filter(([key]) => catCounts[key])
            .map(([key, info]) => (
              <button key={key} onClick={() => setFilterCat(filterCat === key ? "all" : key)}
                className={`filter-chip${filterCat === key ? " active" : ""}`}
                style={{
                  borderColor: filterCat === key ? info.color : "transparent",
                  background: filterCat === key ? `${info.color}18` : "var(--surface)",
                  color: filterCat === key ? info.color : "var(--text-muted)",
                }}>
                {info.label}: {catCounts[key]}
              </button>
            ))}
        </div>
      </div>

      {/* Master-detail layout */}
      <div className="master-detail">
        <div className="master-sidebar sm">
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索规则标题/内容..." />
          <div className="filter-chips">
            <button onClick={() => setFilterCat("all")} className={`filter-chip${filterCat === "all" ? " active" : ""}`}>
              全部 ({rules.length})
            </button>
            {Object.entries(CATEGORY_INFO).map(([key, info]) => {
              const count = catCounts[key];
              if (!count) return null;
              return (
                <button key={key} onClick={() => setFilterCat(key)}
                  className={`filter-chip${filterCat === key ? " active" : ""}`}
                  style={{
                    borderColor: filterCat === key ? info.color : "transparent",
                    background: filterCat === key ? `${info.color}18` : "var(--surface)",
                    color: filterCat === key ? info.color : "var(--text-muted)",
                  }}>
                  {info.label} ({count})
                </button>
              );
            })}
          </div>

          <div className="overflow-auto" style={{ flex: 1 }}>
            {Object.keys(groupedRules).length === 0 ? (
              <div className="empty-state" style={{ padding: "var(--s8) var(--s4)" }}>
                <p>{search || filterCat !== "all" ? "无匹配规则" : "暂无规则"}</p>
                <span className="hint">点击「+ 添加规则」新增</span>
              </div>
            ) : (
              Object.entries(groupedRules).map(([cat, group]) => {
                const info = CATEGORY_INFO[cat] || CATEGORY_INFO.custom;
                return (
                  <div key={cat} style={{ marginBottom: "var(--s2)" }}>
                    <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: info.color, padding: "var(--s1) var(--s2)", marginBottom: 2 }}>
                      {info.label}
                      <span className="faint" style={{ marginLeft: "var(--s1)", fontWeight: 400 }}>{group.length}</span>
                    </div>
                    {group.map((r) => {
                      const active = selectedId === r.id;
                      return (
                        <div key={r.id} onClick={() => setSelectedId(active ? null : r.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: "var(--s2)",
                            padding: "var(--s2) var(--s3)", cursor: "pointer",
                            background: active ? "var(--accent-bg)" : "transparent",
                            borderRadius: "var(--r-sm)", transition: "background 0.1s",
                          }}>
                          <span onClick={(e) => { e.stopPropagation(); toggleRule(r.id); }}
                            style={{
                              width: 10, height: 10, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
                              background: r.enabled ? info.color : "var(--border)",
                              border: `2px solid ${r.enabled ? info.color : "var(--border-light)"}`,
                              transition: "background 0.15s",
                            }}
                            title={r.enabled ? "点击禁用" : "点击启用"} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: "var(--fs-sm)", fontWeight: active ? 600 : 400,
                              color: active ? "var(--text)" : r.enabled ? "var(--text2)" : "var(--text-muted)",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              textDecoration: r.enabled ? "none" : "line-through",
                            }}>{r.title}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Detail editor */}
        <div className="master-main">
          {selected ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s3)" }}>
              <div className="flex-between">
                <div>
                  <div className="flex-center gap2">
                    <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: CATEGORY_INFO[selected.category]?.color || "var(--cat-gray)" }} />
                    <h3 style={{ fontSize: "var(--fs-lg)", fontWeight: 600, margin: 0 }}>{selected.title}</h3>
                    <span className={`tag ${selected.enabled ? "tag-green" : "tag-gray"}`}>
                      {selected.enabled ? "已启用" : "已禁用"}
                    </span>
                  </div>
                  <span className="faint mono">{selected.id}</span>
                </div>
                <button className="btn btn-danger btn-xs" onClick={() => handleDelete(selected.id)}>删除</button>
              </div>

              <div className="form-grid cols-2">
                <label className="field"><span>标题</span>
                  <input className="input" value={selected.title}
                    onChange={(e) => updatePromptRule({ ...selected, title: e.target.value })} />
                </label>
                <label className="field"><span>类别</span>
                  <select className="input" value={selected.category}
                    onChange={(e) => updatePromptRule({ ...selected, category: e.target.value as StoryPromptRule["category"] })}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_INFO[c]?.label || c}</option>)}
                  </select>
                </label>
              </div>

              <label className="field field-row">
                <input type="checkbox" checked={selected.enabled}
                  onChange={(e) => updatePromptRule({ ...selected, enabled: e.target.checked })} />
                <span style={{ textTransform: "none" }}>启用此规则</span>
              </label>

              <label className="field">
                <div className="flex-between mb1">
                  <span>内容</span>
                  <span className="faint">{selected.content.length} 字符</span>
                </div>
                <textarea className="input mono" rows={6}
                  style={{ minHeight: 180, resize: "vertical" }}
                  value={selected.content}
                  onChange={(e) => updatePromptRule({ ...selected, content: e.target.value })} />
              </label>

              <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "var(--s3)" }}>
                <span className="section-title" style={{ padding: 0 }}>切换规则</span>
                <select className="input mt2" value={selected.id}
                  onChange={(e) => setSelectedId(e.target.value)}>
                  {rules.map((r) => <option key={r.id} value={r.id}>{r.title} [{CATEGORY_INFO[r.category]?.label}]</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>选择一条规则查看或编辑</p>
              <span className="hint">在管线图中点击规则药丸，或在左侧列表中点击</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
