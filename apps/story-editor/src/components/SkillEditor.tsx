import { useState } from "react";
import { useEditorStore } from "../store/editorStore.js";
import type { Skill } from "@story-game/shared";

function emptySkill(): Skill {
  return { id: "", name: "", ownerId: "", cost: { mp: 0 }, effect: "", description: "" };
}

export function SkillEditor() {
  const { storyPackage, updateSkill, updateSkills } = useEditorStore();
  const skills = storyPackage?.skills || [];
  const [selectedId, setSelectedId] = useState(skills[0]?.id || "");
  const [newId, setNewId] = useState("");

  const selected = skills.find((s) => s.id === selectedId);

  function handleAdd() {
    if (!newId.trim()) return;
    const s = { ...emptySkill(), id: newId.trim(), name: newId.trim() };
    updateSkills([...skills, s]);
    setSelectedId(s.id);
    setNewId("");
  }

  function handleDelete(id: string) {
    updateSkills(skills.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(skills[0]?.id || "");
  }

  if (!selected) {
    return (
      <div className="editor-panel">
        <h2>技能管理</h2>
        <p className="muted">暂无技能，添加一个：</p>
        <div className="inline-fields">
          <input className="input" value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="技能 ID" />
          <button className="btn-primary" onClick={handleAdd}>添加</button>
        </div>
        {skills.length > 0 && <ul style={{ marginTop: 16 }}>{skills.map((s) => <li key={s.id}><button className="link" onClick={() => setSelectedId(s.id)}>{s.name} ({s.id})</button></li>)}</ul>}
      </div>
    );
  }

  function setField(field: keyof Skill, value: unknown) {
    updateSkill({ ...selected!, [field]: value });
  }

  return (
    <div className="editor-panel">
      <h2>技能编辑</h2>
      <div className="inline-fields" style={{ marginBottom: 16 }}>
        <select className="input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          {skills.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
        </select>
        <input className="input" value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="新技能ID" />
        <button className="btn-primary" onClick={handleAdd}>添加</button>
        <button className="btn-danger" onClick={() => handleDelete(selectedId)}>删除当前</button>
      </div>

      <label className="field"><span>ID</span><input className="input" value={selected.id} onChange={(e) => setField("id", e.target.value)} /></label>
      <label className="field"><span>名称</span><input className="input" value={selected.name} onChange={(e) => setField("name", e.target.value)} /></label>
      <label className="field"><span>所属角色 (ownerId)</span><input className="input" value={selected.ownerId} onChange={(e) => setField("ownerId", e.target.value)} /></label>

      <div className="inline-fields">
        <label className="field"><span>消耗 MP</span><input className="input" type="number" value={selected.cost.mp} onChange={(e) => updateSkill({ ...selected, cost: { mp: Math.max(0, Number(e.target.value)) } })} /></label>
        <label className="field"><span>伤害 Min</span><input className="input" type="number" value={selected.damage?.min ?? ""} placeholder="最小" onChange={(e) => {
          const min = e.target.value ? Number(e.target.value) : 0;
          const max = selected.damage?.max ?? 0;
          updateSkill({ ...selected, damage: { min, max } });
        }} /></label>
        <label className="field"><span>伤害 Max</span><input className="input" type="number" value={selected.damage?.max ?? ""} placeholder="最大" onChange={(e) => {
          const max = e.target.value ? Number(e.target.value) : 0;
          const min = selected.damage?.min ?? 0;
          updateSkill({ ...selected, damage: { min, max } });
        }} /></label>
      </div>

      <label className="field"><span>效果 (effect)</span><input className="input" value={selected.effect} onChange={(e) => setField("effect", e.target.value)} /></label>
      <label className="field">
        <span>描述 (description) — 必填</span>
        <textarea className="input" rows={4} value={selected.description} onChange={(e) => setField("description", e.target.value)} />
      </label>
      <label className="field"><span>示例台词 (sampleLine) — 可选</span><input className="input" value={selected.sampleLine || ""} onChange={(e) => updateSkill({ ...selected, sampleLine: e.target.value || undefined })} /></label>
    </div>
  );
}
