import { useState } from "react";
import { useEditorStore } from "../store/editorStore.js";
import type { StoryPromptRule } from "@story-game/shared";

const CATEGORIES = ["knowledge_forcing", "group_chat_boundary", "scenario_injection", "state_output", "history_state", "combat", "custom"];

function emptyRule(): StoryPromptRule {
  return { id: "", title: "", category: "custom", content: "", enabled: true };
}

export function PromptRulesEditor() {
  const { storyPackage, updatePromptRule, updatePromptRules } = useEditorStore();
  const rules = storyPackage?.promptRules || [];
  const [selectedId, setSelectedId] = useState(rules[0]?.id || "");
  const [newId, setNewId] = useState("");

  const selected = rules.find((r) => r.id === selectedId);

  function handleAdd() {
    if (!newId.trim()) return;
    const r = { ...emptyRule(), id: newId.trim(), title: newId.trim() };
    updatePromptRules([...rules, r]);
    setSelectedId(r.id);
    setNewId("");
  }

  function handleDelete(id: string) {
    updatePromptRules(rules.filter((r) => r.id !== id));
    if (selectedId === id) setSelectedId(rules[0]?.id || "");
  }

  if (!selected) {
    return (
      <div className="editor-panel">
        <h2>Prompt 规则</h2>
        <p className="muted">暂无规则，添加一个：</p>
        <div className="inline-fields">
          <input className="input" value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="规则 ID" />
          <button className="btn-primary" onClick={handleAdd}>添加</button>
        </div>
        {rules.length > 0 && <ul style={{ marginTop: 16 }}>{rules.map((r) => <li key={r.id}><button className="link" onClick={() => setSelectedId(r.id)}>{r.title} ({r.id})</button></li>)}</ul>}
      </div>
    );
  }

  function setField(field: keyof StoryPromptRule, value: unknown) {
    updatePromptRule({ ...selected!, [field]: value });
  }

  return (
    <div className="editor-panel">
      <h2>Prompt 规则</h2>
      <div className="inline-fields" style={{ marginBottom: 16 }}>
        <select className="input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          {rules.map((r) => <option key={r.id} value={r.id}>{r.title} ({r.id})</option>)}
        </select>
        <input className="input" value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="新规则ID" />
        <button className="btn-primary" onClick={handleAdd}>添加</button>
        <button className="btn-danger" onClick={() => handleDelete(selectedId)}>删除当前</button>
      </div>

      <label className="field"><span>ID</span><input className="input" value={selected.id} onChange={(e) => setField("id", e.target.value)} /></label>
      <label className="field"><span>标题</span><input className="input" value={selected.title} onChange={(e) => setField("title", e.target.value)} /></label>
      <label className="field">
        <span>类别 (category) — 必须用枚举值</span>
        <select className="input" value={selected.category} onChange={(e) => setField("category", e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="field inline-check">
        <input type="checkbox" checked={selected.enabled} onChange={(e) => setField("enabled", e.target.checked)} />
        <span>启用</span>
      </label>
      <label className="field">
        <span>内容</span>
        <textarea className="input" rows={10} value={selected.content} onChange={(e) => setField("content", e.target.value)} />
      </label>
    </div>
  );
}
