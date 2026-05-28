import { useState } from "react";
import { useEditorStore } from "../store/editorStore.js";
import type { KnowledgeDocument } from "@story-game/shared";

function emptyDoc(): KnowledgeDocument {
  return { id: "", title: "", ownerId: null, content: "", sourceType: "markdown", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export function KnowledgeEditor() {
  const { storyPackage, updateKnowledgeDoc, updateKnowledgeDocs } = useEditorStore();
  const docs = storyPackage?.knowledgeDocuments || [];
  const [selectedId, setSelectedId] = useState(docs[0]?.id || "");
  const [newId, setNewId] = useState("");

  const selected = docs.find((d) => d.id === selectedId);

  function handleAdd() {
    if (!newId.trim()) return;
    const d = { ...emptyDoc(), id: newId.trim(), title: newId.trim() };
    updateKnowledgeDocs([...docs, d]);
    setSelectedId(d.id);
    setNewId("");
  }

  function handleDelete(id: string) {
    updateKnowledgeDocs(docs.filter((d) => d.id !== id));
    if (selectedId === id) setSelectedId(docs[0]?.id || "");
  }

  if (!selected) {
    return (
      <div className="editor-panel">
        <h2>知识库文档</h2>
        <p className="muted">暂无文档，添加一个：</p>
        <div className="inline-fields">
          <input className="input" value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="文档 ID" />
          <button className="btn-primary" onClick={handleAdd}>添加</button>
        </div>
        {docs.length > 0 && <ul style={{ marginTop: 16 }}>{docs.map((d) => <li key={d.id}><button className="link" onClick={() => setSelectedId(d.id)}>{d.title} ({d.id})</button></li>)}</ul>}
      </div>
    );
  }

  function setField(field: keyof KnowledgeDocument, value: unknown) {
    updateKnowledgeDoc({ ...selected!, [field]: value, updatedAt: new Date().toISOString() });
  }

  return (
    <div className="editor-panel">
      <h2>知识库文档</h2>
      <div className="inline-fields" style={{ marginBottom: 16 }}>
        <select className="input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          {docs.map((d) => <option key={d.id} value={d.id}>{d.title} ({d.id})</option>)}
        </select>
        <input className="input" value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="新文档ID" />
        <button className="btn-primary" onClick={handleAdd}>添加</button>
        <button className="btn-danger" onClick={() => handleDelete(selectedId)}>删除当前</button>
      </div>

      <label className="field"><span>ID</span><input className="input" value={selected.id} onChange={(e) => setField("id", e.target.value)} /></label>
      <label className="field"><span>标题</span><input className="input" value={selected.title} onChange={(e) => setField("title", e.target.value)} /></label>
      <label className="field"><span>所属角色 (ownerId)</span><input className="input" value={selected.ownerId || ""} onChange={(e) => setField("ownerId", e.target.value || null)} /></label>
      <label className="field"><span>来源类型</span>
        <select className="input" value={selected.sourceType} onChange={(e) => setField("sourceType", e.target.value)}>
          <option value="markdown">Markdown</option>
          <option value="manual">Manual</option>
        </select>
      </label>
      <label className="field">
        <span>内容 (Markdown)</span>
        <textarea className="input mono" rows={20} value={selected.content} onChange={(e) => setField("content", e.target.value)} />
      </label>
      <div className="doc-preview" style={{ marginTop: 16, padding: 16, border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg2)" }}>
        <h4>预览</h4>
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{selected.content}</pre>
      </div>
    </div>
  );
}
