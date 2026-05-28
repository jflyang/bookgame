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

const TRIGGER_LABELS: Record<string, string> = {
  knowledgeUse: "知识库命中",
  skillUse: "技能使用",
  firstAppearance: "首次登场",
  stageEnter: "阶段进入",
  messageEvent: "消息事件",
};

function emptyPerf(): PerformanceDefinition {
  return {
    name: "",
    renderer: "audio",
    durationMs: 3000,
    trigger: { type: "knowledgeUse", keywords: [] },
    playOnce: "never",
    audio: {},
  };
}

export function PerformanceEditor() {
  const { manifest, updateManifest, storyPackage } = useEditorStore();
  const perfs = (manifest?.performances || {}) as Record<string, PerformanceDefinition>;
  const keys = Object.keys(perfs);
  const [selectedKey, setSelectedKey] = useState(keys[0] || "");
  const [newKey, setNewKey] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const selected = selectedKey ? perfs[selectedKey] : null;
  const characters = storyPackage?.characters || [];
  const skills = storyPackage?.skills || [];

  // Stats by trigger type
  const triggerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const k of keys) {
      const t = perfs[k].trigger.type;
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }, [keys.length]); // eslint-disable-line

  const filteredKeys = typeFilter ? keys.filter((k) => perfs[k].trigger.type === typeFilter) : keys;

  function handleAdd() {
    if (!newKey.trim()) return;
    const updated = { ...perfs, [newKey.trim()]: emptyPerf() };
    updateManifest({ ...(manifest || {}), performances: updated });
    setSelectedKey(newKey.trim());
    setNewKey("");
  }

  function handleDelete(key: string) {
    const updated = { ...perfs };
    delete updated[key];
    updateManifest({ ...(manifest || {}), performances: updated });
    if (selectedKey === key) {
      const remaining = Object.keys(updated);
      setSelectedKey(remaining[0] || "");
    }
  }

  function updateSelected(fn: (p: PerformanceDefinition) => PerformanceDefinition) {
    if (!selectedKey || !selected) return;
    const updated = { ...perfs, [selectedKey]: fn(selected) };
    updateManifest({ ...(manifest || {}), performances: updated });
  }

  if (!manifest?.performances) {
    return (
      <div className="editor-panel">
        <h2>表演配置</h2>
        <p className="muted">manifest.json 中无 performances 字段。创建一个：</p>
        <button className="btn-primary" onClick={() => updateManifest({ ...(manifest || {}), performances: {} })}>初始化 performances</button>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="editor-panel">
        <h2>表演配置 ({keys.length})</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {TRIGGER_TYPES.map((t) => triggerCounts[t] ? (
            <span key={t} className="card" style={{ padding: "2px 8px", fontSize: 12 }}>
              {TRIGGER_LABELS[t] || t}: {triggerCounts[t]}
            </span>
          ) : null)}
        </div>
        <div className="inline-fields" style={{ marginBottom: 8 }}>
          <input className="input" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="新表演 key (如: char_skill_name)" />
          <button className="btn-primary" onClick={handleAdd}>添加</button>
        </div>
        <div className="inline-fields" style={{ marginBottom: 12 }}>
          <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ flex: 0 }}>
            <option value="">全部类型</option>
            {TRIGGER_TYPES.map((t) => <option key={t} value={t}>{TRIGGER_LABELS[t] || t}</option>)}
          </select>
        </div>
        {filteredKeys.length > 0 && (
          <ul style={{ marginTop: 8 }}>
            {filteredKeys.map((k) => (
              <li key={k} style={{ marginBottom: 4 }}>
                <button className="link" onClick={() => { setSelectedKey(k); setTypeFilter(""); }}>
                  {perfs[k].name || k}
                </button>
                <span className="muted"> ({k})</span>
                <span style={{ fontSize: 11, color: "var(--primary-hover)", marginLeft: 6 }}>
                  {TRIGGER_LABELS[perfs[k].trigger.type] || perfs[k].trigger.type}
                </span>
                {perfs[k].trigger.characterId && <span className="muted" style={{ fontSize: 11, marginLeft: 4 }}>@{perfs[k].trigger.characterId}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="editor-panel">
      <h2>表演配置</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        {TRIGGER_TYPES.map((t) => triggerCounts[t] ? (
          <span key={t} className="card" style={{ padding: "2px 8px", fontSize: 12, cursor: "pointer" }} onClick={() => setTypeFilter(typeFilter === t ? "" : t)}>
            {TRIGGER_LABELS[t] || t}: {triggerCounts[t]}
          </span>
        ) : null)}
      </div>

      <div className="inline-fields" style={{ marginBottom: 16 }}>
        <select className="input" value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>
          {filteredKeys.length > 0 ? filteredKeys.map((k) => <option key={k} value={k}>{perfs[k].name || k} ({k})</option>)
            : keys.map((k) => <option key={k} value={k}>{perfs[k].name || k} ({k})</option>)}
        </select>
        <input className="input" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="新表演 key" />
        <button className="btn-primary" onClick={handleAdd}>添加</button>
        <button className="btn-danger" onClick={() => handleDelete(selectedKey)}>删除当前</button>
      </div>

      <label className="field"><span>名称</span><input className="input" value={selected.name} onChange={(e) => updateSelected((p) => ({ ...p, name: e.target.value }))} /></label>

      <label className="field"><span>渲染器 (renderer)</span>
        <select className="input" value={selected.renderer} onChange={(e) => updateSelected((p) => ({ ...p, renderer: e.target.value }))}>
          {RENDERERS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>

      <label className="field"><span>触发类型 (trigger.type)</span>
        <select className="input" value={selected.trigger.type} onChange={(e) => {
          updateSelected((p) => ({ ...p, trigger: { ...p.trigger, type: e.target.value } }));
        }}>
          {TRIGGER_TYPES.map((t) => <option key={t} value={t}>{TRIGGER_LABELS[t] || t} ({t})</option>)}
        </select>
      </label>

      {/* Trigger-specific fields */}
      {selected.trigger.type === "skillUse" && (
        <>
          <label className="field"><span>关联技能 skillId — 与 skills.json 的 id 完全一致</span>
            <select className="input" value={selected.trigger.skillId || ""} onChange={(e) => updateSelected((p) => ({ ...p, trigger: { ...p.trigger, skillId: e.target.value } }))}>
              <option value="">选择技能...</option>
              {skills.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
            </select>
          </label>
          <label className="field"><span>角色 ID characterId</span>
            <select className="input" value={selected.trigger.characterId || ""} onChange={(e) => updateSelected((p) => ({ ...p, trigger: { ...p.trigger, characterId: e.target.value } }))}>
            <option value="">选择角色...</option>
            {characters.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
          </select></label>
          {/* Hint about dual trigger */}
          <div className="card" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", padding: 10, marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: "var(--primary-hover)", margin: 0 }}>
              <strong>双触发提示：</strong>一个技能可同时配两条演出：<br />
              ① skillUse 演出 → 播放技能音效（掌风、碰撞声）<br />
              ② knowledgeUse 演出 → 播放被动角色的反应语音（如小薇反应）<br />
              两条用不同的 key，knowledgeUse 那条的触发词填被动角色的粗体反应名称。
            </p>
          </div>
        </>
      )}

      {(selected.trigger.type === "knowledgeUse" || selected.trigger.type === "firstAppearance") && (
        <label className="field"><span>角色 ID characterId</span>
          <select className="input" value={selected.trigger.characterId || ""} onChange={(e) => updateSelected((p) => ({ ...p, trigger: { ...p.trigger, characterId: e.target.value } }))}>
            <option value="">选择角色...</option>
            {characters.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
          </select>
        </label>
      )}

      {selected.trigger.type === "knowledgeUse" && (
        <>
          <label className="field">
            <span>知识库标题 knowledgeTitle — 与知识库「表演：」字段一致，是联想桥梁</span>
            <input className="input" value={selected.trigger.knowledgeTitle || ""} onChange={(e) => updateSelected((p) => ({ ...p, trigger: { ...p.trigger, knowledgeTitle: e.target.value } }))} placeholder="如：傲娇激烈反抗" />
          </label>
          <label className="field">
            <span>触发词 keywords — 与知识库「触发词：」一致，逗号分隔</span>
            <input className="input" value={(selected.trigger.keywords || []).join(", ")} onChange={(e) => updateSelected((p) => ({ ...p, trigger: { ...p.trigger, keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } }))} placeholder="如：激烈反抗, 傲娇反抗" />
          </label>
          <label className="field inline-check">
            <input type="checkbox" checked={selected.trigger.matchBoldOnly !== false} onChange={(e) => updateSelected((p) => ({ ...p, trigger: { ...p.trigger, matchBoldOnly: e.target.checked } }))} />
            <span>仅匹配粗体 (matchBoldOnly) — true=只匹配 **粗体** 文字；false=全文匹配</span>
          </label>
          {/* knowledgeUse linkage hints */}
          <div className="card" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", padding: 10, marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: "var(--success)", margin: 0 }}>
              <strong>知识库联动提示：</strong><br />
              • 知识库中的「表演：xxx」= 此处的 <code>knowledgeTitle</code><br />
              • 知识库中的「触发词：A、B」= 此处的 <code>keywords</code><br />
              • 被动联动角色：在主动方知识库中加「角色名反应：出现**粗体**」，此处配对应的 knowledgeUse 条目
            </p>
          </div>
        </>
      )}

      {selected.trigger.type === "stageEnter" && (
        <label className="field">
          <span>阶段 ID stageId</span>
          <select className="input" value={selected.trigger.stageId || ""} onChange={(e) => updateSelected((p) => ({ ...p, trigger: { ...p.trigger, stageId: e.target.value } }))}>
            <option value="">选择阶段...</option>
            {(storyPackage?.scenario?.stages || []).map((sid) => <option key={sid} value={sid}>{sid}</option>)}
          </select>
        </label>
      )}

      {selected.trigger.type === "messageEvent" && (
        <label className="field"><span>事件 ID (eventId)</span><input className="input" value={selected.trigger.eventId || ""} onChange={(e) => updateSelected((p) => ({ ...p, trigger: { ...p.trigger, eventId: e.target.value } }))} /></label>
      )}

      <label className="field"><span>播放频次 (playOnce)</span>
        <select className="input" value={selected.playOnce || "never"} onChange={(e) => updateSelected((p) => ({ ...p, playOnce: e.target.value }))}>
          <option value="never">never — 每次都播</option>
          <option value="session">session — 每个会话播一次</option>
          <option value="story">story — 整个故事只播一次</option>
        </select>
      </label>

      <label className="field"><span>持续时间 ms</span><input className="input" type="number" value={selected.durationMs || 3000} onChange={(e) => updateSelected((p) => ({ ...p, durationMs: Number(e.target.value) }))} /></label>

      {selected.renderer === "audio" && (
        <label className="field"><span>音频文件路径 (audio.main)</span><input className="input" value={selected.audio?.main || ""} onChange={(e) => updateSelected((p) => ({ ...p, audio: { ...p.audio, main: e.target.value } }))} placeholder="assets/performances/xxx/audio/file.mp3" /></label>
      )}

      <details>
        <summary>原始 JSON</summary>
        <pre className="json-preview">{JSON.stringify(selected, null, 2)}</pre>
      </details>
    </div>
  );
}
