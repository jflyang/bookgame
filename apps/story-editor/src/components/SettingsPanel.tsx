import { useState } from "react";
import { useEditorStore } from "../store/editorStore.js";
import type { Character, KnowledgeDocument } from "@story-game/shared";

/**
 * 高级设置面板 — 合并了角色管理、元数据、UI配置
 * 只展示用户需要维护的字段：
 * - 角色话术（personaPrompt、voiceId）
 * - 元数据基本信息（开场白等）
 * - 打开资源管理器按钮
 */

type Section = "characters" | "worldbuilding" | "knowledge" | "manifest" | "uiconfig";

export function SettingsPanel() {
  const { storyPackage, updateCharacter, manifest, updateManifest, updateKnowledgeDoc, updateKnowledgeDocs, storySetting, updateStorySetting } = useEditorStore();
  const [section, setSection] = useState<Section>("characters");
  const chars = storyPackage?.characters || [];
  const docs = storyPackage?.knowledgeDocuments || [];

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>高级设置</h2>
        <div className="flex-center gap2">
          <button className="btn btn-sm" onClick={() => {
            const dir = useEditorStore.getState().storyDir;
            if (dir) navigator.clipboard.writeText(dir);
            alert(`故事包路径已复制：\n${dir}\n\n请在资源管理器中打开此路径管理图片等资源文件。`);
          }}>
            📁 打开资源目录
          </button>
        </div>
      </div>

      {/* Section tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--border)", marginBottom: "var(--s4)" }}>
        {([
          { key: "characters", label: "角色话术" },
          { key: "worldbuilding", label: "世界观" },
          { key: "knowledge", label: "知识文档" },
          { key: "manifest", label: "项目元数据" },
          { key: "uiconfig", label: "UI配置" },
        ] as { key: Section; label: string }[]).map((t) => (
          <button key={t.key} onClick={() => setSection(t.key)}
            style={{
              padding: "var(--s2) var(--s5)", cursor: "pointer",
              background: section === t.key ? "var(--surface)" : "transparent",
              border: "none", borderBottom: section === t.key ? "2px solid var(--accent)" : "2px solid transparent",
              color: section === t.key ? "var(--text)" : "var(--text-muted)",
              fontFamily: "var(--font)", fontSize: "var(--fs-sm)", fontWeight: section === t.key ? 600 : 400,
              marginBottom: -2,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {section === "characters" && <CharacterPromptsSection chars={chars} updateCharacter={updateCharacter} />}
      {section === "worldbuilding" && <WorldbuildingSection storySetting={storySetting} storySettingPrompt={storyPackage?.storySettingPrompt || ""} updateStorySetting={updateStorySetting} />}
      {section === "knowledge" && <KnowledgeSection docs={docs} chars={chars} updateKnowledgeDoc={updateKnowledgeDoc} updateKnowledgeDocs={updateKnowledgeDocs} />}
      {section === "manifest" && <ManifestSection manifest={manifest} updateManifest={updateManifest} />}
      {section === "uiconfig" && <UIConfigSection />}
    </div>
  );
}

function CharacterPromptsSection({ chars, updateCharacter }: { chars: Character[]; updateCharacter: (c: Character) => void }) {
  const [selectedId, setSelectedId] = useState(chars[0]?.id || "");
  const selected = chars.find((c) => c.id === selectedId);

  if (!selected) return <p className="muted">暂无角色数据</p>;

  return (
    <div style={{ display: "flex", gap: "var(--s4)" }}>
      <div style={{ width: 160, flexShrink: 0 }}>
        {chars.map((c) => (
          <button key={c.id} onClick={() => setSelectedId(c.id)}
            style={{
              display: "block", width: "100%", textAlign: "left", padding: "var(--s2) var(--s3)",
              background: selectedId === c.id ? "var(--accent-bg)" : "transparent",
              border: "none", borderLeft: selectedId === c.id ? "3px solid var(--accent)" : "3px solid transparent",
              borderRadius: "var(--r-sm)", cursor: "pointer", fontFamily: "var(--font)",
              fontSize: "var(--fs-sm)", fontWeight: selectedId === c.id ? 600 : 400,
              color: selectedId === c.id ? "var(--text)" : "var(--text-muted)", marginBottom: 2,
            }}>
            {c.name} <span className="faint">({c.role})</span>
          </button>
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--s3)" }}>
        <div className="form-grid cols-2">
          <label className="field"><span>角色名</span>
            <input className="input" value={selected.name} onChange={(e) => updateCharacter({ ...selected, name: e.target.value })} />
          </label>
          <label className="field"><span>角色定位</span>
            <input className="input" value={selected.role} onChange={(e) => updateCharacter({ ...selected, role: e.target.value })} />
          </label>
        </div>
        <label className="field"><span>语音 ID (voiceId)</span>
          <input className="input mono" value={(selected as any).voiceId || ""} onChange={(e) => updateCharacter({ ...selected, voiceId: e.target.value } as any)} placeholder="ElevenLabs voice ID" />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span>角色话术 (personaPrompt)</span>
          <textarea className="input mono" rows={10} value={selected.personaPrompt}
            onChange={(e) => updateCharacter({ ...selected, personaPrompt: e.target.value })}
            placeholder="描述角色的说话风格、性格特征、行动策略..." />
        </label>
        <p className="faint" style={{ fontSize: "var(--fs-xs)", margin: 0 }}>
          💡 头像图片请直接放入故事包的 media/ 目录，点击上方"打开资源目录"按钮获取路径。
        </p>
      </div>
    </div>
  );
}

function ManifestSection({ manifest, updateManifest }: { manifest: Record<string, unknown> | null; updateManifest: (m: Record<string, unknown>) => void }) {
  if (!manifest) return <p className="muted">无 manifest 数据</p>;

  const title = (manifest.title as string) || "";
  const description = (manifest.description as string) || "";
  const introNarration = (manifest.introNarration as string) || "";
  const capabilities = (manifest.capabilities || {}) as Record<string, boolean>;

  function setField(key: string, value: unknown) {
    updateManifest({ ...manifest, [key]: value });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s3)" }}>
      <div className="form-grid cols-2">
        <label className="field"><span>标题</span>
          <input className="input" value={title} onChange={(e) => setField("title", e.target.value)} />
        </label>
        <label className="field"><span>描述</span>
          <input className="input" value={description} onChange={(e) => setField("description", e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>开场白 (introNarration)</span>
        <textarea className="input" rows={5} value={introNarration}
          onChange={(e) => setField("introNarration", e.target.value)}
          placeholder="游戏开始时显示给玩家的开场白文字..." />
      </label>
      <div>
        <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, marginBottom: "var(--s2)", display: "block" }}>功能开关</span>
        <div className="form-grid cols-3">
          {["tts", "bgm", "sfx", "performances", "saveSlots"].map((cap) => (
            <label key={cap} className="field field-row">
              <input type="checkbox" checked={capabilities[cap] || false}
                onChange={() => setField("capabilities", { ...capabilities, [cap]: !capabilities[cap] })} />
              <span style={{ textTransform: "none" }}>{cap}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function UIConfigSection() {
  const { storyPackage, updateManifest } = useEditorStore();
  const manifest = useEditorStore.getState().manifest || {};
  const uiConfig = (storyPackage as any)?.uiConfig || {};

  const sceneName = (uiConfig.scene?.name as string) || "";
  const introNarration = (uiConfig.scene?.introNarration as string) || (manifest as any).introNarration || "";
  const chatBackground = (uiConfig.scene?.chatBackground as string) || "";

  function updateUiConfig(path: string, value: string) {
    const pkg = useEditorStore.getState().storyPackage;
    if (!pkg) return;
    const current = (pkg as any).uiConfig || {};
    const scene = { ...(current.scene || {}), [path]: value };
    useEditorStore.setState({
      storyPackage: { ...pkg, uiConfig: { ...current, scene } } as any,
      dirty: true,
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s4)" }}>
      <label className="field">
        <span>场景名称</span>
        <input className="input" value={sceneName}
          onChange={(e) => updateUiConfig("name", e.target.value)}
          placeholder="如：紫禁城、少爷的密室" />
        <span className="faint" style={{ fontSize: "var(--fs-xs)", marginTop: 4 }}>
          显示在游戏界面顶部的场景标题
        </span>
      </label>

      <label className="field">
        <span>开场白</span>
        <textarea className="input" rows={4} value={introNarration}
          onChange={(e) => updateUiConfig("introNarration", e.target.value)}
          placeholder="游戏开始时显示给玩家的开场白文字..." />
        <span className="faint" style={{ fontSize: "var(--fs-xs)", marginTop: 4 }}>
          第一轮对话前展示的旁白文字
        </span>
      </label>

      <label className="field">
        <span>聊天窗口背景图</span>
        <input className="input" value={chatBackground}
          onChange={(e) => updateUiConfig("chatBackground", e.target.value)}
          placeholder="media/backgrounds/room.jpg" />
        <span className="faint" style={{ fontSize: "var(--fs-xs)", marginTop: 4 }}>
          相对于故事包目录的图片路径，用作聊天界面背景
        </span>
      </label>
    </div>
  );
}

function WorldbuildingSection({ storySetting, storySettingPrompt, updateStorySetting }: {
  storySetting: string;
  storySettingPrompt: string;
  updateStorySetting: (content: string) => void;
}) {
  const [content, setContent] = useState(storySetting || storySettingPrompt || "");

  function handleSave() { updateStorySetting(content); }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s3)", flex: 1 }}>
      <div className="flex-between">
        <span className="faint" style={{ fontSize: "var(--fs-xs)" }}>
          LLM 收到的世界观背景文本 — 灌输世界观、核心冲突、角色关系
        </span>
        <button className="btn btn-primary btn-sm" onClick={handleSave}>应用修改</button>
      </div>
      <textarea
        className="input mono"
        rows={18}
        style={{ flex: 1, minHeight: 300, resize: "vertical" }}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="在此编写故事世界观设定..."
      />
    </div>
  );
}

function KnowledgeSection({ docs, chars, updateKnowledgeDoc, updateKnowledgeDocs }: {
  docs: KnowledgeDocument[];
  chars: Character[];
  updateKnowledgeDoc: (doc: KnowledgeDocument) => void;
  updateKnowledgeDocs: (docs: KnowledgeDocument[]) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const selected = docs.find((d) => d.id === selectedId) || null;

  function handleAdd() {
    if (!newTitle.trim()) return;
    const id = `doc_${newTitle.trim().replace(/\s+/g, "_").toLowerCase()}_${Date.now()}`;
    const d: KnowledgeDocument = {
      id, title: newTitle.trim(), ownerId: null,
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
    <div style={{ display: "flex", gap: "var(--s4)", minHeight: 300 }}>
      {/* Left: doc list */}
      <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: "var(--s2)" }}>
        <div className="flex-between">
          <span className="faint" style={{ fontSize: "var(--fs-xs)" }}>{docs.length} 文档</span>
          <button className="btn btn-sm" onClick={() => setAdding(true)}>+ 新文档</button>
        </div>
        {adding && (
          <div className="flex-center gap1">
            <input className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
              placeholder="文档标题..." autoFocus style={{ flex: 1 }} />
            <button className="btn btn-primary btn-xs" onClick={handleAdd} disabled={!newTitle.trim()}>✓</button>
          </div>
        )}
        <div style={{ flex: 1, overflow: "auto" }}>
          {docs.map((d) => (
            <button key={d.id} onClick={() => setSelectedId(selectedId === d.id ? null : d.id)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "var(--s2) var(--s3)",
                background: selectedId === d.id ? "var(--accent-bg)" : "transparent",
                border: "none", borderRadius: "var(--r-sm)", cursor: "pointer",
                fontFamily: "var(--font)", fontSize: "var(--fs-sm)",
                fontWeight: selectedId === d.id ? 600 : 400,
                color: selectedId === d.id ? "var(--text)" : "var(--text-muted)", marginBottom: 2,
              }}>
              {d.title}
              <span className="faint" style={{ fontSize: 9, marginLeft: "var(--s1)" }}>
                {d.ownerId ? chars.find(c => c.id === d.ownerId)?.name || d.ownerId : "共享"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Right: editor */}
      {selected ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--s3)" }}>
          <div className="flex-between">
            <h4 style={{ margin: 0 }}>{selected.title}</h4>
            <button className="btn btn-danger btn-xs" onClick={() => handleDelete(selected.id)}>删除</button>
          </div>
          <div className="form-grid cols-2">
            <label className="field"><span>标题</span>
              <input className="input" value={selected.title}
                onChange={(e) => updateKnowledgeDoc({ ...selected, title: e.target.value })} />
            </label>
            <label className="field"><span>所属角色</span>
              <select className="input" value={selected.ownerId || ""}
                onChange={(e) => updateKnowledgeDoc({ ...selected, ownerId: e.target.value || null })}>
                <option value="">共享</option>
                {chars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <label className="field" style={{ flex: 1 }}>
            <span>内容 (Markdown)</span>
            <textarea className="input mono" rows={10} style={{ minHeight: 200, resize: "vertical" }}
              value={selected.content}
              onChange={(e) => updateKnowledgeDoc({ ...selected, content: e.target.value })} />
          </label>
          <p className="faint" style={{ fontSize: "var(--fs-xs)", margin: 0 }}>
            💡 知识文档用于 LLM 检索增强。内容会根据玩家输入关键词匹配后注入提示词。
          </p>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p className="faint">选择一个文档编辑，或创建新文档</p>
        </div>
      )}
    </div>
  );
}
