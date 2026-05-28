import { useState, useMemo } from "react";
import { useEditorStore } from "../store/editorStore.js";
import type { KnowledgeDocument } from "@story-game/shared";

export function KnowledgeGraph() {
  const { storyPackage, updateKnowledgeDoc, updateKnowledgeDocs } = useEditorStore();
  const docs = storyPackage?.knowledgeDocuments || [];
  const chars = storyPackage?.characters || [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const selected = docs.find((d) => d.id === selectedId) || null;

  // Concept links: detect references between docs and characters
  const conceptLinks = useMemo(() => {
    const links: { from: string; to: string; label: string }[] = [];
    for (const doc of docs) {
      for (const other of docs) {
        if (other.id === doc.id) continue;
        if (doc.content.includes(other.id) || doc.content.includes(other.title)) {
          links.push({ from: doc.id, to: other.id, label: "引用" });
        }
      }
      for (const c of chars) {
        if (doc.ownerId === c.id) links.push({ from: doc.id, to: c.id, label: "归属" });
        if (doc.content.includes(c.name)) links.push({ from: doc.id, to: c.id, label: "提及" });
      }
    }
    return links;
  }, [docs, chars]);

  // Linked docs for selected
  const linkedDocs = useMemo(() => {
    if (!selected) return [];
    const ids = new Set<string>();
    for (const l of conceptLinks) {
      if (l.from === selected.id) ids.add(l.to);
      if (l.to === selected.id) ids.add(l.from);
    }
    return docs.filter((d) => ids.has(d.id) && d.id !== selected.id);
  }, [selected, conceptLinks, docs]);

  // Filtered and grouped docs
  const filteredDocs = useMemo(() => {
    let result = docs;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((d) =>
        d.title.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        d.content.toLowerCase().includes(q)
      );
    }
    if (filterOwner !== "all") {
      result = result.filter((d) => (d.ownerId || "shared") === filterOwner);
    }
    return result;
  }, [docs, search, filterOwner]);

  const groupedDocs = useMemo(() => {
    const groups: Record<string, KnowledgeDocument[]> = {};
    for (const d of filteredDocs) {
      const key = d.ownerId || "shared";
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    }
    return groups;
  }, [filteredDocs]);

  function getOwnerName(ownerId: string | null): string {
    if (!ownerId) return "共享知识";
    return chars.find((c) => c.id === ownerId)?.name || ownerId;
  }

  function getOwnerColor(ownerId: string | null): string {
    if (!ownerId) return "var(--cat-gray)";
    const idx = chars.findIndex((c) => c.id === ownerId);
    const colors = ["var(--cat-blue)", "var(--cat-red)", "var(--cat-green)", "var(--cat-orange)", "var(--cat-purple)", "var(--cat-pink)"];
    return colors[idx % colors.length] || "var(--cat-gray)";
  }

  function handleAdd() {
    if (!newTitle.trim()) return;
    const ownerId = filterOwner !== "all" && filterOwner !== "shared" ? filterOwner : null;
    const id = `doc_${newTitle.trim().replace(/\s+/g, "_").toLowerCase()}_${Date.now()}`;
    const d: KnowledgeDocument = {
      id, title: newTitle.trim(), ownerId,
      content: "", sourceType: "markdown",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    updateKnowledgeDocs([...docs, d]);
    setSelectedId(d.id);
    setNewTitle("");
    setAdding(false);
  }

  function handleDelete(id: string) {
    updateKnowledgeDocs(docs.filter((d) => d.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  return (
    <div className="panel" style={{ position: "relative" }}>
      {/* Header */}
      <div className="panel-header">
        <div>
          <h2>知识图谱</h2>
          <span className="faint">{docs.length} 文档 · {conceptLinks.length} 关联</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
          + 新文档
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="card mb3" style={{ borderColor: "var(--accent-border)", background: "var(--accent-bg)" }}>
          <div className="flex-center gap2">
            <input
              className="input"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
              placeholder="输入新文档标题..."
              autoFocus
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={!newTitle.trim()}>确认</button>
            <button className="btn btn-sm" onClick={() => setAdding(false)}>取消</button>
          </div>
        </div>
      )}

      {/* Main layout: sidebar + detail */}
      <div className="panel-body" style={{ display: "flex", gap: "var(--s4)", minHeight: 420 }}>
        {/* Left: Doc list sidebar */}
        <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: "var(--s2)" }}>
          {/* Search */}
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索文档标题/内容..."
          />

          {/* Character filter tabs */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s1)" }}>
            <button
              onClick={() => setFilterOwner("all")}
              className={filterOwner === "all" ? "tag tag-purple" : "tag tag-gray"}
              style={{ cursor: "pointer", border: "none", fontFamily: "var(--font)" }}>
              全部 ({docs.length})
            </button>
            {chars.map((c) => {
              const count = docs.filter((d) => d.ownerId === c.id).length;
              if (!count) return null;
              const idx = chars.findIndex((ch) => ch.id === c.id);
              const tagColors = ["tag-blue", "tag-red", "tag-green", "tag-orange", "tag-purple", "tag-pink"];
              const tagClass = tagColors[idx % tagColors.length];
              return (
                <button
                  key={c.id}
                  onClick={() => setFilterOwner(c.id)}
                  className={filterOwner === c.id ? `tag ${tagClass}` : "tag tag-gray"}
                  style={{ cursor: "pointer", border: "none", fontFamily: "var(--font)" }}>
                  {c.name} ({count})
                </button>
              );
            })}
            {(() => {
              const sharedCount = docs.filter((d) => !d.ownerId).length;
              if (!sharedCount) return null;
              return (
                <button
                  onClick={() => setFilterOwner("shared")}
                  className={filterOwner === "shared" ? "tag tag-purple" : "tag tag-gray"}
                  style={{ cursor: "pointer", border: "none", fontFamily: "var(--font)" }}>
                  共享 ({sharedCount})
                </button>
              );
            })()}
          </div>

          {/* Document list grouped by owner */}
          <div style={{ flex: 1, overflow: "auto" }}>
            {Object.keys(groupedDocs).length === 0 ? (
              <div className="empty-state">
                <p>{search ? "无匹配文档" : "暂无文档"}</p>
                <span className="hint">点击「+ 新文档」添加</span>
              </div>
            ) : (
              Object.entries(groupedDocs).map(([key, group]) => (
                <div key={key} style={{ marginBottom: "var(--s2)" }}>
                  <div style={{
                    fontSize: "var(--fs-xs)", fontWeight: 600, color: getOwnerColor(key === "shared" ? null : key),
                    padding: "var(--s1) var(--s2)", marginBottom: 2,
                  }}>
                    {getOwnerName(key === "shared" ? null : key)}
                    <span className="faint" style={{ marginLeft: "var(--s1)", fontWeight: 400 }}>{group.length}</span>
                  </div>
                  {group.map((d) => {
                    const active = selectedId === d.id;
                    const links = conceptLinks.filter((l) => l.from === d.id || l.to === d.id);
                    return (
                      <button
                        key={d.id}
                        onClick={() => setSelectedId(active ? null : d.id)}
                        style={{
                          display: "block", width: "100%", textAlign: "left",
                          fontFamily: "var(--font)", fontSize: "var(--fs-sm)",
                          padding: "var(--s2) var(--s3)", cursor: "pointer",
                          background: active ? "var(--accent-bg)" : "transparent",
                          border: "none", borderRadius: "var(--r-sm)",
                          color: active ? "var(--text)" : "var(--text2)",
                          fontWeight: active ? 600 : 400,
                          transition: "background 0.1s",
                          lineHeight: 1.4,
                        }}
                      >
                        <div style={{
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {d.title}
                        </div>
                        {links.length > 0 && (
                          <span className="faint" style={{ fontSize: 9 }}>
                            {links.length} 关联
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Detail editor or empty state */}
        <div style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
          {selected ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s3)" }}>
              {/* Doc header */}
              <div className="flex-between">
                <div>
                  <div className="flex-center gap2">
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: getOwnerColor(selected.ownerId),
                    }} />
                    <h3 style={{ fontSize: "var(--fs-lg)", fontWeight: 600, margin: 0 }}>{selected.title}</h3>
                  </div>
                  <span className="faint mono" style={{ fontSize: "var(--fs-xs)" }}>{selected.id}</span>
                </div>
                <button className="btn btn-danger btn-xs" onClick={() => handleDelete(selected.id)}>删除</button>
              </div>

              {/* Metadata row */}
              <div className="form-grid cols-3">
                <label className="field">
                  <span>ID</span>
                  <input className="input mono" value={selected.id}
                    onChange={(e) => updateKnowledgeDoc({ ...selected, id: e.target.value })} />
                </label>
                <label className="field">
                  <span>标题</span>
                  <input className="input" value={selected.title}
                    onChange={(e) => updateKnowledgeDoc({ ...selected, title: e.target.value })} />
                </label>
                <label className="field">
                  <span>所属角色</span>
                  <select className="input" value={selected.ownerId || ""}
                    onChange={(e) => updateKnowledgeDoc({ ...selected, ownerId: e.target.value || null })}>
                    <option value="">共享</option>
                    {chars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              </div>

              {/* Content editor */}
              <label className="field">
                <div className="flex-between mb1">
                  <span>内容 (Markdown)</span>
                  <span className="faint" style={{ fontSize: "var(--fs-xs)" }}>
                    {selected.content.length} 字符
                  </span>
                </div>
                <textarea
                  className="input mono"
                  rows={16}
                  style={{ minHeight: 260, resize: "vertical" }}
                  value={selected.content}
                  onChange={(e) => updateKnowledgeDoc({ ...selected, content: e.target.value })}
                />
              </label>

              {/* Linked documents */}
              <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "var(--s3)" }}>
                <div className="flex-between mb2">
                  <span className="section-title" style={{ padding: 0 }}>关联文档</span>
                  <span className="faint" style={{ fontSize: "var(--fs-xs)" }}>
                    {linkedDocs.length} 个引用关系
                  </span>
                </div>
                {linkedDocs.length === 0 ? (
                  <span className="faint" style={{ fontSize: "var(--fs-sm)" }}>
                    在内容中引用其他文档 ID 或标题即可自动建立关联
                  </span>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s1)" }}>
                    {linkedDocs.map((d) => {
                      const link = conceptLinks.find(
                        (l) => (l.from === selected.id && l.to === d.id) || (l.to === selected.id && l.from === d.id)
                      );
                      return (
                        <button
                          key={d.id}
                          onClick={() => setSelectedId(d.id)}
                          className="card"
                          style={{
                            padding: "var(--s2) var(--s3)", cursor: "pointer",
                            border: "1px solid var(--border-light)", borderRadius: "var(--r-md)",
                            background: "var(--bg2)", fontFamily: "var(--font)",
                            textAlign: "left", fontSize: "var(--fs-sm)",
                            display: "flex", alignItems: "center", gap: "var(--s2)",
                          }}
                        >
                          <span style={{
                            fontSize: 9, padding: "0 4px", borderRadius: 3,
                            background: "var(--accent-bg)", color: "var(--accent-hover)",
                            fontWeight: 600,
                          }}>
                            {link?.label || "关联"}
                          </span>
                          {d.title}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick nav */}
              <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "var(--s3)" }}>
                <span className="section-title" style={{ padding: 0 }}>切换文档</span>
                <select className="input mt2" value={selected.id}
                  onChange={(e) => setSelectedId(e.target.value)}>
                  {docs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>选择一个文档查看或编辑</p>
              <span className="hint">在左侧列表中点击文档标题</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
