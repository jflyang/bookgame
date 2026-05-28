import { useState } from "react";
import { useEditorStore } from "../store/editorStore.js";
import type { Character } from "@story-game/shared";

const CHIP_COLORS = ["var(--cat-blue)", "var(--cat-red)", "var(--cat-green)", "var(--cat-orange)", "var(--cat-purple)", "var(--cat-pink)"];

function charChipColor(idx: number) {
  return CHIP_COLORS[idx % CHIP_COLORS.length];
}

function avatarChar(name: string) {
  return name.charAt(0);
}

function isImageAvatar(avatar: string) {
  return avatar.startsWith("data:image") || avatar.startsWith("http");
}

function emptyCharacter(): Character {
  return {
    id: "", name: "", role: "", avatar: "",
    personaPrompt: "", rules: [], knowledgeBaseIds: [], attackableTargetIds: [],
  };
}

function readAvatarFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (!file.type.startsWith("image/")) { resolve(dataUrl); return; }
      const img = document.createElement("img");
      img.onload = () => {
        const max = 512;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        if (scale === 1 && file.size < 500 * 1024) { resolve(dataUrl); return; }
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function CharacterManager() {
  const { storyPackage, updateCharacter, updateCharacters } = useEditorStore();
  const chars = storyPackage?.characters || [];

  const [selectedId, setSelectedId] = useState<string>(chars[0]?.id || "");
  const [adding, setAdding] = useState(false);

  const selected = chars.find((c) => c.id === selectedId) || null;

  const [newForm, setNewForm] = useState({ name: "", role: "", personaPrompt: "" });

  const [draft, setDraft] = useState<Character | null>(null);
  if (selected && (!draft || draft.id !== selected.id)) {
    setDraft({ ...selected });
  }

  async function handleAvatarUpload(file: File) {
    if (!draft) return;
    const dataUrl = await readAvatarFile(file);
    const updated = { ...draft, avatar: dataUrl };
    setDraft(updated);
    updateCharacter(updated);
  }

  function handleSave() {
    if (!draft) return;
    const charIdx = chars.findIndex((c) => c.id === draft.id);
    const updated = [...chars];
    if (charIdx >= 0) updated[charIdx] = draft;
    updateCharacters(updated);
  }

  function handleDelete() {
    if (!draft || chars.length <= 1) return;
    const updated = chars.filter((c) => c.id !== draft.id);
    updateCharacters(updated);
    setSelectedId(updated[0]?.id || "");
    setDraft(null);
  }

  function handleCreate() {
    if (!newForm.name.trim()) return;
    const id = `char_${Date.now()}`;
    const c: Character = {
      id, name: newForm.name.trim(), role: newForm.role.trim(), avatar: "",
      personaPrompt: newForm.personaPrompt, rules: [], knowledgeBaseIds: [], attackableTargetIds: [],
    };
    updateCharacters([...chars, c]);
    setAdding(false);
    setNewForm({ name: "", role: "", personaPrompt: "" });
    setSelectedId(id);
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>角色管理</h2>
          <span className="faint">{chars.length} 角色</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ 新角色</button>
      </div>

      <div className="master-detail">
        {/* Left: Character list */}
        <div className="master-sidebar" style={{ gap: 0 }}>
          {chars.map((c, i) => {
            const active = selectedId === c.id && !adding;
            const hasImg = isImageAvatar(c.avatar);
            return (
              <button key={c.id}
                onClick={() => { setAdding(false); setSelectedId(c.id); }}
                style={{
                  display: "flex", alignItems: "center", gap: "var(--s3)", padding: "var(--s3)",
                  cursor: "pointer", border: "none", borderLeft: active ? "3px solid var(--accent)" : "3px solid transparent",
                  background: active ? "var(--accent-bg)" : "transparent",
                  fontFamily: "var(--font)", textAlign: "left", width: "100%",
                  transition: "background 0.1s",
                }}>
                <span style={{
                  width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                  background: hasImg ? `url(${c.avatar}) center/cover` : charChipColor(i),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "var(--fs-lg)", fontWeight: 700, color: "#fff",
                }}>
                  {!hasImg && avatarChar(c.name)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "var(--fs-sm)", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.role || "未设置定位"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Editor */}
        <div className="master-main">
          {adding ? (
            <div className="card">
              <div className="flex-center gap3 mb3">
                <span style={{
                  width: 52, height: 52, borderRadius: "50%",
                  background: "linear-gradient(135deg, #f97316, #fb923c)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "var(--fs-xl)", fontWeight: 700, color: "#fff", flexShrink: 0,
                }}>+</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "var(--fs-lg)" }}>新建角色</div>
                  <span className="faint">填写角色基本信息</span>
                </div>
              </div>

              <div className="form-grid cols-2">
                <label className="field"><span>角色名称 *</span>
                  <input className="input" value={newForm.name}
                    onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} placeholder="例如：扫地僧" />
                </label>
                <label className="field"><span>角色定位</span>
                  <input className="input" value={newForm.role}
                    onChange={(e) => setNewForm({ ...newForm, role: e.target.value })} placeholder="例如：隐藏高手" />
                </label>
              </div>

              <div className="card-section-title mt3">初始 Prompt（可选）</div>
              <p className="faint" style={{ marginBottom: "var(--s2)" }}>为新角色预设身份、性格和说话风格。</p>
              <textarea className="input mono" rows={6} style={{ minHeight: 120, resize: "vertical" }}
                value={newForm.personaPrompt}
                onChange={(e) => setNewForm({ ...newForm, personaPrompt: e.target.value })} />

              <div className="flex-center gap2 mt3" style={{ justifyContent: "flex-end" }}>
                <button className="btn btn-sm" onClick={() => { setAdding(false); setNewForm({ name: "", role: "", personaPrompt: "" }); }}>取消</button>
                <button className="btn btn-primary" onClick={handleCreate} disabled={!newForm.name.trim()}>创建角色</button>
              </div>
            </div>
          ) : draft ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s4)" }}>
              {/* Header */}
              <div className="card">
                <div className="flex-center gap4">
                  <span style={{
                    width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
                    background: isImageAvatar(draft.avatar) ? `url(${draft.avatar}) center/cover` : charChipColor(chars.findIndex((c) => c.id === draft.id)),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "var(--fs-2xl)", fontWeight: 700, color: "#fff",
                    position: "relative",
                  }}>
                    {!isImageAvatar(draft.avatar) && avatarChar(draft.name)}
                    <label style={{
                      position: "absolute", bottom: 0, right: 0,
                      width: 24, height: 24, borderRadius: "50%",
                      background: "var(--surface2)", border: "2px solid var(--border)",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      color: "var(--text-muted)",
                    }} title="上传头像">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      <input type="file" accept="image/*" hidden
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = ""; }} />
                    </label>
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "var(--fs-xl)" }}>{draft.name}</div>
                    <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>{draft.role || "未设置定位"}</div>
                    <span className="faint mono">{draft.id}</span>
                  </div>
                </div>
              </div>

              {/* Basic Info */}
              <div className="card">
                <div className="card-section-title" style={{ marginTop: 0 }}>基础信息</div>
                <div className="form-grid cols-2">
                  <label className="field"><span>角色名称</span>
                    <input className="input" value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  </label>
                  <label className="field"><span>角色定位</span>
                    <input className="input" value={draft.role}
                      onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
                  </label>
                </div>
              </div>

              {/* Persona Prompt */}
              <div className="card">
                <div className="card-section-title" style={{ marginTop: 0 }}>角色 Prompt</div>
                <p className="faint" style={{ marginBottom: "var(--s2)" }}>定义角色身份、性格、说话风格和行为边界。</p>
                <textarea className="input mono" rows={10} style={{ minHeight: 180, resize: "vertical" }}
                  value={draft.personaPrompt}
                  onChange={(e) => setDraft({ ...draft, personaPrompt: e.target.value })} />
              </div>

              {/* Actions */}
              <div className="flex-center gap2" style={{ justifyContent: "flex-end" }}>
                <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={chars.length <= 1}>
                  删除角色
                </button>
                <button className="btn btn-primary" onClick={handleSave}>
                  保存角色
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>选择左侧角色开始编辑</p>
              <span className="hint">或点击「+ 新角色」创建</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
