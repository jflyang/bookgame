import { useState } from "react";
import { useEditorStore } from "../store/editorStore.js";
import type { Character } from "@story-game/shared";

/**
 * 高级设置面板 — 合并了角色管理、元数据、UI配置
 * 只展示用户需要维护的字段：
 * - 角色话术（personaPrompt、voiceId）
 * - 元数据基本信息（开场白等）
 * - 打开资源管理器按钮
 */

type Section = "characters" | "manifest" | "uiconfig";

export function SettingsPanel() {
  const { storyPackage, updateCharacter, manifest, updateManifest } = useEditorStore();
  const [section, setSection] = useState<Section>("characters");
  const chars = storyPackage?.characters || [];

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
  const { storyPackage } = useEditorStore();
  const uiConfig = (storyPackage as any)?.uiConfig || {};
  const [raw, setRaw] = useState(JSON.stringify(uiConfig, null, 2));
  const [error, setError] = useState("");

  function handleSave() {
    try {
      const parsed = JSON.parse(raw);
      const pkg = useEditorStore.getState().storyPackage;
      if (pkg) {
        useEditorStore.setState({ storyPackage: { ...pkg, uiConfig: parsed } as any, dirty: true });
        setError("");
      }
    } catch {
      setError("JSON 格式错误");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s3)" }}>
      <div className="flex-between">
        <span className="faint">直接编辑 JSON（高级用户）</span>
        <div className="flex-center gap2">
          {error && <span className="tag tag-red">{error}</span>}
          <button className="btn btn-primary btn-sm" onClick={handleSave}>应用</button>
        </div>
      </div>
      <textarea className="input mono" rows={12} value={raw} onChange={(e) => setRaw(e.target.value)} />
    </div>
  );
}
