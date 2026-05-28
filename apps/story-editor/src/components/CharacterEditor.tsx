import { useState } from "react";
import { useEditorStore } from "../store/editorStore.js";
import type { Character } from "@story-game/shared";

function emptyCharacter(): Character {
  return {
    id: "", name: "", role: "", avatar: "",
    personaPrompt: "", rules: [], knowledgeBaseIds: [], attackableTargetIds: [],
  };
}

export function CharacterEditor() {
  const { storyPackage, updateCharacter, updateCharacters } = useEditorStore();
  const chars = storyPackage?.characters || [];
  const [selectedId, setSelectedId] = useState(chars[0]?.id || "");
  const [newCharId, setNewCharId] = useState("");

  const selected = chars.find((c) => c.id === selectedId);

  function handleAdd() {
    if (!newCharId.trim()) return;
    const c = { ...emptyCharacter(), id: newCharId.trim(), name: newCharId.trim() };
    updateCharacters([...chars, c]);
    setSelectedId(c.id);
    setNewCharId("");
  }

  function handleDelete(id: string) {
    updateCharacters(chars.filter((c) => c.id !== id));
    if (selectedId === id) setSelectedId(chars[0]?.id || "");
  }

  if (!selected) {
    return (
      <div className="editor-panel">
        <h2>角色管理</h2>
        <p className="muted">暂无角色，添加一个：</p>
        <div className="inline-fields">
          <input className="input" value={newCharId} onChange={(e) => setNewCharId(e.target.value)} placeholder="角色 ID (英文)" />
          <button className="btn-primary" onClick={handleAdd}>添加</button>
        </div>
        {chars.length > 0 && (
          <ul style={{ marginTop: 16 }}>{chars.map((c) => <li key={c.id}><button className="link" onClick={() => setSelectedId(c.id)}>{c.name} ({c.id})</button></li>)}</ul>
        )}
      </div>
    );
  }

  function setField(field: keyof Character, value: unknown) {
    updateCharacter({ ...selected!, [field]: value });
  }

  return (
    <div className="editor-panel">
      <h2>角色编辑</h2>
      <div className="inline-fields" style={{ marginBottom: 16 }}>
        <select className="input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          {chars.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
        </select>
        <input className="input" value={newCharId} onChange={(e) => setNewCharId(e.target.value)} placeholder="新角色ID" />
        <button className="btn-primary" onClick={handleAdd}>添加</button>
        <button className="btn-danger" onClick={() => handleDelete(selectedId)}>删除当前</button>
      </div>

      <label className="field"><span>ID</span><input className="input" value={selected.id} onChange={(e) => setField("id", e.target.value)} /></label>
      <label className="field"><span>名称</span><input className="input" value={selected.name} onChange={(e) => setField("name", e.target.value)} /></label>
      <label className="field"><span>角色定位 (role)</span><input className="input" value={selected.role} onChange={(e) => setField("role", e.target.value)} /></label>
      <label className="field"><span>头像 (avatar)</span><input className="input" value={selected.avatar} onChange={(e) => setField("avatar", e.target.value)} /></label>
      <label className="field">
        <span>角色扮演 Prompt (personaPrompt)</span>
        <textarea className="input" rows={6} value={selected.personaPrompt} onChange={(e) => setField("personaPrompt", e.target.value)} />
      </label>
      <label className="field">
        <span>规则 (rules) — 每行一条</span>
        <textarea className="input" rows={3} value={(selected.rules || []).join("\n")} onChange={(e) => setField("rules", e.target.value.split("\n").filter(Boolean))} />
      </label>
      <label className="field">
        <span>关联知识库 ID (knowledgeBaseIds) — 逗号分隔</span>
        <input className="input" value={(selected.knowledgeBaseIds || []).join(", ")} onChange={(e) => setField("knowledgeBaseIds", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
      </label>
      <label className="field">
        <span>可攻击目标 ID (attackableTargetIds) — 逗号分隔</span>
        <input className="input" value={(selected.attackableTargetIds || []).join(", ")} onChange={(e) => setField("attackableTargetIds", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
      </label>
    </div>
  );
}
