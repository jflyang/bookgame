import { useState, useMemo } from "react";
import { useEditorStore } from "../store/editorStore.js";

interface PerformanceDefinition {
  name: string;
  renderer: string;
  durationMs?: number;
  trigger: {
    type: string;
    characterId?: string;
    skillId?: string;
    stageId?: string;
    eventId?: string;
    knowledgeTitle?: string;
    keywords?: string[];
    matchBoldOnly?: boolean;
  };
  playOnce?: string;
  audio?: Record<string, string>;
  layers?: Record<string, string>;
  video?: Record<string, string>;
}

const TRIGGER_TYPES = ["knowledgeUse", "skillUse", "firstAppearance", "stageEnter", "messageEvent"];
const RENDERERS = ["audio", "layeredCss", "image", "video", "none"];
const PLAY_MODES = [
  { value: "never", label: "每次都播" },
  { value: "session", label: "每会话一次" },
  { value: "story", label: "仅一次" },
];

const TRIGGER_META: Record<string, { label: string; color: string; icon: string }> = {
  knowledgeUse: { label: "知识库命中", color: "var(--cat-blue)", icon: "K" },
  skillUse: { label: "技能使用", color: "var(--cat-red)", icon: "S" },
  firstAppearance: { label: "首次登场", color: "var(--cat-green)", icon: "F" },
  stageEnter: { label: "阶段进入", color: "var(--cat-orange)", icon: "E" },
  messageEvent: { label: "消息事件", color: "var(--cat-purple)", icon: "M" },
};

function emptyPerf(): PerformanceDefinition {
  return {
    name: "", renderer: "audio", durationMs: 3000,
    trigger: { type: "knowledgeUse", keywords: [] },
    playOnce: "never", audio: {},
  };
}

export function PerformanceMapper() {
  const { manifest, updateManifest, storyPackage } = useEditorStore();
  const perfs = (manifest?.performances || {}) as Record<string, PerformanceDefinition>;
  const keys = Object.keys(perfs);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState("");

  const selected = selectedKey ? perfs[selectedKey] : null;
  const characters = storyPackage?.characters || [];
  const skills = storyPackage?.skills || [];
  const stages = storyPackage?.scenario?.stages || [];

  const triggerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const k of keys) {
      const t = perfs[k].trigger.type;
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }, [keys.length]);

  const filteredKeys = useMemo(() => {
    let result = keys;
    if (filterType) result = result.filter((k) => perfs[k].trigger.type === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((k) => {
        const p = perfs[k];
        return k.toLowerCase().includes(q) || (p.name || "").toLowerCase().includes(q) || (p.audio?.main || "").toLowerCase().includes(q);
      });
    }
    return result;
  }, [keys, filterType, search]);

  const groupedKeys = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const k of filteredKeys) {
      const t = perfs[k].trigger.type;
      if (!groups[t]) groups[t] = [];
      groups[t].push(k);
    }
    return groups;
  }, [filteredKeys]);

  function handleAdd() {
    if (!newKey.trim()) return;
    const key = newKey.trim();
    updateManifest({ ...(manifest || {}), performances: { ...perfs, [key]: emptyPerf() } });
    setSelectedKey(key);
    setNewKey("");
    setAdding(false);
  }

  function handleDelete(key: string) {
    const updated = { ...perfs };
    delete updated[key];
    updateManifest({ ...(manifest || {}), performances: updated });
    if (selectedKey === key) setSelectedKey(null);
  }

  function updateSelected(fn: (p: PerformanceDefinition) => PerformanceDefinition) {
    if (!selectedKey || !selected) return;
    updateManifest({ ...(manifest || {}), performances: { ...perfs, [selectedKey]: fn(selected) } });
  }

  if (!manifest?.performances) {
    return (
      <div className="panel">
        <div className="panel-header"><h2>演出映射</h2></div>
        <div className="empty-state">
          <p>manifest 中无 performances 字段</p>
          <button className="btn btn-primary mt3" onClick={() => updateManifest({ ...(manifest || {}), performances: {} })}>
            初始化 performances
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>演出映射</h2>
          <span className="faint">{keys.length} 个演出</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ 新演出</button>
      </div>

      {adding && (
        <div className="card" style={{ borderColor: "var(--accent-border)", background: "var(--accent-bg)" }}>
          <div className="flex-center gap2">
            <input className="input" value={newKey} onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
              placeholder="输入演出 key (如 leng_shuang_xxx)..." autoFocus style={{ flex: 1 }} />
            <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={!newKey.trim()}>确认</button>
            <button className="btn btn-sm" onClick={() => setAdding(false)}>取消</button>
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div className="filter-chips">
        <button onClick={() => setFilterType("")} className={`filter-chip${!filterType ? " active" : ""}`}>
          全部 ({keys.length})
        </button>
        {TRIGGER_TYPES.filter((t) => triggerCounts[t]).map((t) => {
          const meta = TRIGGER_META[t];
          return (
            <button key={t} onClick={() => setFilterType(filterType === t ? "" : t)}
              className="filter-chip"
              style={{
                borderColor: filterType === t ? meta.color : "transparent",
                background: filterType === t ? `${meta.color}20` : "var(--surface)",
                color: filterType === t ? meta.color : "var(--text-muted)",
              }}>
              {meta.label}: {triggerCounts[t]}
            </button>
          );
        })}
      </div>

      {/* Master-detail layout */}
      <div className="master-detail">
        <div className="master-sidebar sm">
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索 Key / 名称 / 路径..." />
          <div className="overflow-auto" style={{ flex: 1 }}>
            {filteredKeys.length === 0 ? (
              <div className="empty-state" style={{ padding: "var(--s8) var(--s4)" }}>
                <p>{search || filterType ? "无匹配演出" : "暂无演出"}</p>
                <span className="hint">点击「+ 新演出」添加</span>
              </div>
            ) : (
              Object.entries(groupedKeys).map(([type, group]) => {
                const meta = TRIGGER_META[type] || TRIGGER_META.messageEvent;
                return (
                  <div key={type} style={{ marginBottom: "var(--s2)" }}>
                    <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: meta.color, padding: "var(--s1) var(--s2)", marginBottom: 2, display: "flex", alignItems: "center", gap: "var(--s1)" }}>
                      <span style={{ width: 16, height: 16, borderRadius: 4, background: meta.color, color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{meta.icon}</span>
                      {meta.label}
                      <span className="faint" style={{ fontWeight: 400 }}>{group.length}</span>
                    </div>
                    {group.map((k) => {
                      const p = perfs[k];
                      const char = characters.find((c) => c.id === p.trigger.characterId);
                      const skill = p.trigger.skillId ? skills.find((s) => s.id === p.trigger.skillId) : null;
                      const active = selectedKey === k;
                      return (
                        <button key={k} onClick={() => setSelectedKey(active ? null : k)}
                          style={{
                            display: "block", width: "100%", textAlign: "left", fontFamily: "var(--font)",
                            padding: "var(--s2) var(--s3)", cursor: "pointer",
                            background: active ? `${meta.color}14` : "transparent",
                            border: "none", borderLeft: active ? `3px solid ${meta.color}` : "3px solid transparent",
                            borderRadius: "var(--r-sm)", transition: "background 0.1s",
                          }}>
                          <div style={{ fontSize: "var(--fs-sm)", fontWeight: active ? 600 : 400, color: active ? "var(--text)" : "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 1 }}>
                            {p.name || k}
                          </div>
                          <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {char ? `@${char.name}` : ""}{skill ? ` · ${skill.name}` : ""}{!char && !skill ? k : ""}
                          </div>
                        </button>
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
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s4)" }}>
              {/* Title bar */}
              <div className="flex-between">
                <div>
                  <div className="flex-center gap2">
                    <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: TRIGGER_META[selected.trigger.type]?.color || "var(--cat-gray)" }} />
                    <h3 style={{ fontSize: "var(--fs-lg)", fontWeight: 600, margin: 0 }}>{selected.name || selectedKey}</h3>
                    <span className="tag" style={{
                      background: `${TRIGGER_META[selected.trigger.type]?.color || "var(--cat-gray)"}20`,
                      color: TRIGGER_META[selected.trigger.type]?.color,
                    }}>{TRIGGER_META[selected.trigger.type]?.label}</span>
                  </div>
                  <span className="faint mono">{selectedKey}</span>
                </div>
                <button className="btn btn-danger btn-xs" onClick={() => handleDelete(selectedKey!)}>删除</button>
              </div>

              {/* Basic Info */}
              <div className="card">
                <div className="card-section-title" style={{ marginTop: 0 }}>基本信息</div>
                <div className="form-grid cols-2">
                  <label className="field"><span>名称</span>
                    <input className="input" value={selected.name} onChange={(e) => updateSelected((p) => ({ ...p, name: e.target.value }))} />
                  </label>
                  <label className="field"><span>渲染器</span>
                    <select className="input" value={selected.renderer} onChange={(e) => updateSelected((p) => ({ ...p, renderer: e.target.value }))}>
                      {RENDERERS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                  <label className="field"><span>时长 (ms)</span>
                    <input className="input" type="number" value={selected.durationMs || 3000}
                      onChange={(e) => updateSelected((p) => ({ ...p, durationMs: Number(e.target.value) }))} />
                  </label>
                  <label className="field"><span>播放频次</span>
                    <select className="input" value={selected.playOnce || "never"}
                      onChange={(e) => updateSelected((p) => ({ ...p, playOnce: e.target.value }))}>
                      {PLAY_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </label>
                </div>
              </div>

              {/* Trigger Config */}
              <div className="card">
                <div className="card-section-title" style={{ marginTop: 0 }}>触发条件</div>
                <div className="form-grid cols-2">
                  <label className="field"><span>触发类型</span>
                    <select className="input" value={selected.trigger.type}
                      onChange={(e) => updateSelected((p) => ({ ...p, trigger: { ...p.trigger, type: e.target.value } }))}>
                      {TRIGGER_TYPES.map((t) => <option key={t} value={t}>{TRIGGER_META[t]?.label || t}</option>)}
                    </select>
                  </label>
                  {(selected.trigger.type === "skillUse" || selected.trigger.type === "knowledgeUse" || selected.trigger.type === "firstAppearance") && (
                    <label className="field"><span>角色</span>
                      <select className="input" value={selected.trigger.characterId || ""}
                        onChange={(e) => updateSelected((p) => ({ ...p, trigger: { ...p.trigger, characterId: e.target.value } }))}>
                        <option value="">选择角色...</option>
                        {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </label>
                  )}
                  {selected.trigger.type === "skillUse" && (
                    <label className="field"><span>关联技能</span>
                      <select className="input" value={selected.trigger.skillId || ""}
                        onChange={(e) => updateSelected((p) => ({ ...p, trigger: { ...p.trigger, skillId: e.target.value } }))}>
                        <option value="">选择技能...</option>
                        {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </label>
                  )}
                  {selected.trigger.type === "stageEnter" && (
                    <label className="field"><span>阶段</span>
                      <select className="input" value={selected.trigger.stageId || ""}
                        onChange={(e) => updateSelected((p) => ({ ...p, trigger: { ...p.trigger, stageId: e.target.value } }))}>
                        <option value="">选择阶段...</option>
                        {stages.map((sid) => <option key={sid} value={sid}>{sid}</option>)}
                      </select>
                    </label>
                  )}
                  {selected.trigger.type === "messageEvent" && (
                    <label className="field"><span>事件 ID</span>
                      <input className="input" value={selected.trigger.eventId || ""}
                        onChange={(e) => updateSelected((p) => ({ ...p, trigger: { ...p.trigger, eventId: e.target.value } }))}
                        placeholder="如：combat_start" />
                    </label>
                  )}
                  {selected.trigger.type === "knowledgeUse" && (
                    <>
                      <label className="field"><span>知识库标题</span>
                        <input className="input" value={selected.trigger.knowledgeTitle || ""}
                          onChange={(e) => updateSelected((p) => ({ ...p, trigger: { ...p.trigger, knowledgeTitle: e.target.value } }))} />
                      </label>
                      <label className="field" style={{ gridColumn: "1 / -1" }}><span>触发词 (逗号分隔)</span>
                        <input className="input" value={(selected.trigger.keywords || []).join(", ")}
                          onChange={(e) => updateSelected((p) => ({ ...p, trigger: { ...p.trigger, keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } }))}
                          placeholder="关键词1, 关键词2, ..." />
                      </label>
                    </>
                  )}
                </div>
              </div>

              {/* Audio */}
              {selected.renderer === "audio" && (
                <div className="card">
                  <div className="card-section-title" style={{ marginTop: 0 }}>音频设置</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--s2)" }}>
                    {Object.entries(selected.audio || { main: "" }).map(([key, path], idx) => (
                      <div key={idx} className="kv-row">
                        <input className="input kv-key" value={key} readOnly />
                        <input className="input mono kv-val" value={path}
                          onChange={(e) => {
                            const audio = { ...(selected.audio || {}), [key]: e.target.value };
                            if (!e.target.value) delete audio[key];
                            updateSelected((p) => ({ ...p, audio }));
                          }} placeholder="音频文件路径" />
                        {key !== "main" && (
                          <button className="btn btn-ghost btn-xs" style={{ color: "var(--danger)" }}
                            onClick={() => {
                              const audio = { ...(selected.audio || {}) }; delete audio[key];
                              updateSelected((p) => ({ ...p, audio }));
                            }}>✕</button>
                        )}
                      </div>
                    ))}
                    <div className="kv-row mt1">
                      <input className="input kv-key" placeholder="新键名 (如 bgm, voice)..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const val = (e.currentTarget as HTMLInputElement).value.trim();
                            if (val) { updateSelected((p) => ({ ...p, audio: { ...(p.audio || {}), [val]: "" } })); (e.currentTarget as HTMLInputElement).value = ""; }
                          }
                        }} />
                      <span className="faint" style={{ flex: 2, alignSelf: "center" }}>输入键名后回车添加</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Video */}
              {selected.renderer === "video" && (
                <div className="card">
                  <div className="card-section-title" style={{ marginTop: 0 }}>视频设置</div>
                  <div className="form-grid cols-2">
                    <label className="field"><span>WebM 路径</span>
                      <input className="input mono" value={(selected.video as any)?.webm || ""}
                        onChange={(e) => updateSelected((p) => ({ ...p, video: { ...(p.video as any || {}), webm: e.target.value } }))}
                        placeholder="assets/video/file.webm" />
                    </label>
                    <label className="field"><span>MP4 路径</span>
                      <input className="input mono" value={(selected.video as any)?.mp4 || ""}
                        onChange={(e) => updateSelected((p) => ({ ...p, video: { ...(p.video as any || {}), mp4: e.target.value } }))}
                        placeholder="assets/video/file.mp4" />
                    </label>
                    <label className="field"><span>封面图 (poster)</span>
                      <input className="input mono" value={(selected.video as any)?.poster || ""}
                        onChange={(e) => updateSelected((p) => ({ ...p, video: { ...(p.video as any || {}), poster: e.target.value } }))}
                        placeholder="assets/video/poster.jpg" />
                    </label>
                    <label className="field field-row" style={{ alignItems: "flex-end", paddingBottom: 6 }}>
                      <input type="checkbox" checked={(selected.video as any)?.containsAudio === true}
                        onChange={(e) => updateSelected((p) => ({ ...p, video: { ...(p.video as any || {}), containsAudio: e.target.checked } }))} />
                      <span style={{ textTransform: "none" }}>包含音频轨道</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Layers */}
              {selected.renderer === "layeredCss" && (
                <div className="card">
                  <div className="flex-between" style={{ marginBottom: "var(--s3)" }}>
                    <span className="card-section-title" style={{ margin: 0 }}>CSS 图层</span>
                    <span className="faint">{Object.keys(selected.layers || {}).length} 层</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--s1)" }}>
                    {Object.entries(selected.layers || {}).map(([key, path]) => (
                      <div key={key} className="kv-row">
                        <input className="input" style={{ flex: 1.5 }} value={key} readOnly />
                        <input className="input mono" style={{ flex: 3 }} value={path}
                          onChange={(e) => updateSelected((p) => ({ ...p, layers: { ...(p.layers || {}), [key]: e.target.value } }))} />
                        <button className="btn btn-ghost btn-xs" style={{ color: "var(--danger)" }}
                          onClick={() => { const l = { ...(selected.layers || {}) }; delete l[key]; updateSelected((p) => ({ ...p, layers: l })); }}>✕</button>
                      </div>
                    ))}
                  </div>
                  <div className="kv-row mt2">
                    <input className="input" style={{ flex: 1.5 }} placeholder="图层键名 (如 bg)..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = (e.currentTarget as HTMLInputElement).value.trim();
                          if (val) { updateSelected((p) => ({ ...p, layers: { ...(p.layers || {}), [val]: "" } })); (e.currentTarget as HTMLInputElement).value = ""; }
                        }
                      }} />
                    <span className="faint" style={{ flex: 3, alignSelf: "center" }}>输入键名后回车添加</span>
                  </div>
                </div>
              )}

              {/* Quick nav */}
              <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "var(--s3)" }}>
                <span className="section-title" style={{ padding: 0 }}>切换演出</span>
                <select className="input mt2" value={selectedKey!} onChange={(e) => setSelectedKey(e.target.value)}>
                  {keys.map((k) => {
                    const p = perfs[k];
                    const meta = TRIGGER_META[p.trigger.type];
                    return <option key={k} value={k}>{p.name || k} [{meta?.label}]</option>;
                  })}
                </select>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>选择一个演出查看或编辑</p>
              <span className="hint">在左侧列表中点击演出条目</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
