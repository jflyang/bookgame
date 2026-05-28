import { useState, useRef } from "react";
import { useEditorStore } from "../store/editorStore.js";

/* ─── Image file reading ─── */
function readImageFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (!file.type.startsWith("image/")) { resolve(dataUrl); return; }
      const img = document.createElement("img");
      img.onload = () => {
        const max = 1200;
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

export function ManifestPanel() {
  const { manifest, updateManifest, storyPackage } = useEditorStore();

  if (!manifest) {
    return (
      <div className="panel">
        <div className="panel-header"><h2>项目配置</h2></div>
        <p className="muted">无 manifest 数据</p>
      </div>
    );
  }

  const chars = storyPackage?.characters || [];

  function setField(key: string, value: unknown) {
    updateManifest({ ...manifest, [key]: value });
  }

  // Capabilities
  const caps = (manifest.capabilities || {}) as Record<string, boolean>;
  function toggleCap(key: string) {
    setField("capabilities", { ...caps, [key]: !caps[key] });
  }

  // Audio
  const audio = (manifest.audio || { bgm: { scenes: {} }, sfx: {} }) as Record<string, any>;
  const bgm = audio.bgm || { scenes: {} };
  const sfx = (audio.sfx || {}) as Record<string, string>;

  function setBgmDefault(val: string) {
    setField("audio", { ...audio, bgm: { ...bgm, default: val || undefined } });
  }
  function setBgmScene(scene: string, path: string) {
    setField("audio", { ...audio, bgm: { ...bgm, scenes: { ...bgm.scenes, [scene]: path } } });
  }
  function removeBgmScene(scene: string) {
    const scenes = { ...bgm.scenes };
    delete scenes[scene];
    setField("audio", { ...audio, bgm: { ...bgm, scenes } });
  }
  function setSfx(key: string, path: string) {
    setField("audio", { ...audio, sfx: { ...sfx, [key]: path } });
  }
  function removeSfx(key: string) {
    const s = { ...sfx }; delete s[key];
    setField("audio", { ...audio, sfx: s });
  }

  // Images
  const images = (manifest.images || { portraits: {}, backgrounds: {} }) as Record<string, any>;
  const portraits = (images.portraits || {}) as Record<string, string>;
  const backgrounds = (images.backgrounds || {}) as Record<string, string>;

  function setPortrait(charId: string, path: string) {
    setField("images", { ...images, portraits: { ...portraits, [charId]: path } });
  }
  function removePortrait(charId: string) {
    const p = { ...portraits }; delete p[charId];
    setField("images", { ...images, portraits: p });
  }
  function setBackground(key: string, path: string) {
    setField("images", { ...images, backgrounds: { ...backgrounds, [key]: path } });
  }
  function removeBackground(key: string) {
    const b = { ...backgrounds }; delete b[key];
    setField("images", { ...images, backgrounds: b });
  }

  // Fonts
  const fonts = (manifest.fonts || {}) as Record<string, string>;
  function setFont(key: string, val: string) {
    setField("fonts", { ...fonts, [key]: val || undefined });
  }

  // New entry state
  const [newSfxKey, setNewSfxKey] = useState("");
  const [newSfxPath, setNewSfxPath] = useState("");
  const [newBgmScene, setNewBgmScene] = useState("");
  const [newBgmScenePath, setNewBgmScenePath] = useState("");
  const [newBgKey, setNewBgKey] = useState("");
  const [newBgPath, setNewBgPath] = useState("");
  const [thumbUploading, setThumbUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Thumbnail
  const pkg = storyPackage;
  const thumbnail = (pkg as any)?.thumbnail as string | undefined;

  async function handleThumbUpload(file: File) {
    setThumbUploading(true);
    const dataUrl = await readImageFile(file);
    if (pkg) {
      useEditorStore.setState({ storyPackage: { ...pkg, thumbnail: dataUrl } as any, dirty: true });
    }
    setThumbUploading(false);
  }

  function handleThumbRemove() {
    if (pkg) {
      useEditorStore.setState({ storyPackage: { ...pkg, thumbnail: "" } as any, dirty: true });
    }
  }

  // Stats
  const stats = [
    { label: "角色", value: storyPackage?.characters?.length || 0 },
    { label: "技能", value: storyPackage?.skills?.length || 0 },
    { label: "知识库", value: storyPackage?.knowledgeDocuments?.length || 0 },
    { label: "规则", value: storyPackage?.promptRules?.length || 0 },
    { label: "阶段", value: storyPackage?.scenario?.stages?.length || 0 },
    { label: "模块", value: storyPackage?.modules?.length || 0 },
    { label: "演出", value: Object.keys(manifest.performances || {}).length },
  ];

  const CAP_LABELS: Record<string, string> = {
    audio: "音频", customFonts: "自定义字体", customCss: "自定义CSS",
    characterPortraits: "角色头像", backgroundImages: "背景图", performances: "演出系统",
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>项目配置</h2>
          <span className="faint">manifest.json</span>
        </div>
      </div>

      <div className="panel-body">
        {/* Stats */}
        <div className="stat-grid">
          {stats.map((s) => (
            <div className="stat" key={s.label}>
              <div className="val">{s.value}</div>
              <div className="lbl">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Metadata */}
        <div className="card mt4">
          <div className="card-section-title" style={{ marginTop: 0 }}>元数据</div>
          <div className="form-grid cols-2">
            <label className="field"><span>ID</span>
              <input className="input" value={(manifest.id as string) || ""} onChange={(e) => setField("id", e.target.value)} />
            </label>
            <label className="field"><span>类型</span>
              <input className="input" value={(manifest.type as string) || ""} onChange={(e) => setField("type", e.target.value)} />
            </label>
            <label className="field"><span>标题</span>
              <input className="input" value={(manifest.title as string) || ""} onChange={(e) => setField("title", e.target.value)} />
            </label>
            <label className="field"><span>Schema 版本</span>
              <input className="input" value={(manifest.schemaVersion as string) || ""} onChange={(e) => setField("schemaVersion", e.target.value)} />
            </label>
            <label className="field"><span>版本号</span>
              <input className="input" value={(manifest.version as string) || ""} onChange={(e) => setField("version", e.target.value)} placeholder="1.0.0" />
            </label>
            <label className="field"><span>作者</span>
              <input className="input" value={(manifest.author as string) || ""} onChange={(e) => setField("author", e.target.value)} />
            </label>
          </div>
          <label className="field mt3"><span>描述</span>
            <textarea className="input" rows={2} value={(manifest.description as string) || ""} onChange={(e) => setField("description", e.target.value)} />
          </label>
          <div className="form-grid cols-2 mt3">
            <label className="field"><span>入口文件</span>
              <input className="input" value={(manifest.entry as string) || ""} onChange={(e) => setField("entry", e.target.value)} />
            </label>
            <label className="field"><span>创建时间</span>
              <input className="input" value={(manifest.createdAt as string) || ""} onChange={(e) => setField("createdAt", e.target.value)} />
            </label>
          </div>
        </div>

        {/* Capabilities */}
        <div className="card mt4">
          <div className="card-section-title" style={{ marginTop: 0 }}>功能开关</div>
          <div className="form-grid cols-3">
            {Object.entries(CAP_LABELS).map(([key, label]) => {
              const on = caps[key] === true;
              return (
                <label key={key} className="field field-row" style={{
                  padding: "var(--s2) var(--s3)", borderRadius: "var(--r-md)",
                  background: on ? "var(--success-bg)" : "var(--bg)",
                  border: `1px solid ${on ? "rgba(63,185,80,0.3)" : "var(--border-light)"}`,
                  cursor: "pointer", margin: 0,
                }}>
                  <input type="checkbox" checked={on} onChange={() => toggleCap(key)} style={{ accentColor: "var(--success)" }} />
                  <span style={{ textTransform: "none", fontWeight: on ? 600 : 400, color: on ? "var(--success)" : "var(--text-muted)" }}>
                    {label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Audio */}
        <div className="card mt4">
          <div className="card-section-title" style={{ marginTop: 0 }}>音频配置</div>

          <label className="field"><span>默认 BGM</span>
            <input className="input" value={bgm.default || ""} onChange={(e) => setBgmDefault(e.target.value)}
              placeholder="assets/audio/bgm_default.mp3" />
          </label>

          {/* BGM Scenes */}
          <div className="mt3">
            <div className="card-section-title" style={{ marginTop: 0, marginBottom: "var(--s2)" }}>
              BGM 场景映射 ({Object.keys(bgm.scenes || {}).length})
            </div>
            {Object.entries(bgm.scenes || {}).map(([scene, path]) => (
              <div key={scene} className="kv-row">
                <input className="input kv-key" value={scene} readOnly />
                <input className="input mono kv-val" value={path as string}
                  onChange={(e) => setBgmScene(scene, e.target.value)} />
                <button className="btn btn-ghost btn-xs" style={{ color: "var(--danger)" }}
                  onClick={() => removeBgmScene(scene)}>✕</button>
              </div>
            ))}
            <div className="kv-row mt2">
              <input className="input kv-key" value={newBgmScene} onChange={(e) => setNewBgmScene(e.target.value)} placeholder="场景名" />
              <input className="input mono kv-val" value={newBgmScenePath} onChange={(e) => setNewBgmScenePath(e.target.value)} placeholder="音频路径" />
              <button className="btn btn-primary btn-xs"
                onClick={() => { if (newBgmScene && newBgmScenePath) { setBgmScene(newBgmScene, newBgmScenePath); setNewBgmScene(""); setNewBgmScenePath(""); } }}
                disabled={!newBgmScene || !newBgmScenePath}>添加</button>
            </div>
          </div>

          {/* SFX */}
          <div className="mt4">
            <div className="card-section-title" style={{ marginTop: 0, marginBottom: "var(--s2)" }}>
              SFX 音效 ({Object.keys(sfx).length})
            </div>
            {Object.entries(sfx).map(([key, path]) => (
              <div key={key} className="kv-row">
                <input className="input kv-key" value={key} readOnly />
                <input className="input mono kv-val" value={path}
                  onChange={(e) => setSfx(key, e.target.value)} />
                <button className="btn btn-ghost btn-xs" style={{ color: "var(--danger)" }}
                  onClick={() => removeSfx(key)}>✕</button>
              </div>
            ))}
            <div className="kv-row mt2">
              <input className="input kv-key" value={newSfxKey} onChange={(e) => setNewSfxKey(e.target.value)} placeholder="SFX 键名" />
              <input className="input mono kv-val" value={newSfxPath} onChange={(e) => setNewSfxPath(e.target.value)} placeholder="音频路径" />
              <button className="btn btn-primary btn-xs"
                onClick={() => { if (newSfxKey && newSfxPath) { setSfx(newSfxKey, newSfxPath); setNewSfxKey(""); setNewSfxPath(""); } }}
                disabled={!newSfxKey || !newSfxPath}>添加</button>
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="card mt4">
          <div className="card-section-title" style={{ marginTop: 0 }}>图片配置</div>

          {/* ─── Story Thumbnail ─── */}
          <div className="card-section-title" style={{ marginTop: 0, marginBottom: "var(--s2)" }}>
            故事缩略图
          </div>
          <p className="faint" style={{ marginBottom: "var(--s3)" }}>
            存档槽显示的封面图。建议 16:9，500KB 以内。
          </p>
          {thumbnail ? (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--s4)" }}>
              <img src={thumbnail} alt="缩略图预览" style={{
                width: 200, height: 112, objectFit: "cover",
                borderRadius: "var(--r-md)", border: "1px solid var(--border)",
                background: "var(--bg)",
              }} />
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--s2)" }}>
                <button className="btn btn-sm" onClick={() => fileInputRef.current?.click()} disabled={thumbUploading}>
                  {thumbUploading ? "处理中..." : "更换缩略图"}
                </button>
                <button className="btn btn-sm" onClick={handleThumbRemove} style={{ color: "var(--danger)", borderColor: "var(--danger-border)" }}>
                  移除缩略图
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={thumbUploading}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--s3)",
                width: "100%", padding: "var(--s6)", cursor: "pointer",
                border: "1px dashed var(--border)", borderRadius: "var(--r-md)",
                background: "var(--bg)", fontFamily: "var(--font)", fontSize: "var(--fs-sm)",
                color: "var(--text-muted)", transition: "border-color 0.12s",
              }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              {thumbUploading ? "处理中..." : "上传缩略图"}
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleThumbUpload(f); e.target.value = ""; }} />

          {/* ─── Portraits ─── */}
          <div className="mt4">
            <div className="card-section-title" style={{ marginTop: 0, marginBottom: "var(--s2)" }}>
              角色头像 ({Object.keys(portraits).length})
            </div>
            {chars.map((c) => {
              const path = portraits[c.id] || "";
              const isDataUrl = path.startsWith("data:image");
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "var(--s2)", marginBottom: "var(--s1)" }}>
                  {/* Avatar preview */}
                  <span style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: isDataUrl ? `url(${path}) center/cover` : "var(--surface)",
                    border: `1px solid ${isDataUrl ? "var(--border)" : "var(--border-light)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: "var(--text-muted)",
                  }}>
                    {!isDataUrl && (path ? "图" : c.name.charAt(0))}
                  </span>
                  <span style={{ width: 72, fontSize: "var(--fs-sm)", fontWeight: 500, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                  <input className="input mono" style={{ flex: 1, fontSize: "var(--fs-xs)" }} value={path}
                    onChange={(e) => setPortrait(c.id, e.target.value)}
                    placeholder={path ? "" : "未设置头像路径"} />
                  <label style={{ cursor: "pointer", padding: "2px 6px", borderRadius: "var(--r-sm)", fontSize: "var(--fs-xs)", color: "var(--text-muted)", border: "1px solid var(--border-light)", whiteSpace: "nowrap", flexShrink: 0 }}>
                    上传
                    <input type="file" accept="image/*" hidden
                      onChange={async (e) => {
                        const f = e.target.files?.[0]; if (!f) return;
                        const dataUrl = await readImageFile(f);
                        setPortrait(c.id, dataUrl);
                        e.target.value = "";
                      }} />
                  </label>
                  {path && (
                    <button className="btn btn-ghost btn-xs" style={{ color: "var(--danger)", flexShrink: 0 }}
                      onClick={() => removePortrait(c.id)}>✕</button>
                  )}
                </div>
              );
            })}
          </div>

          {/* ─── Backgrounds ─── */}
          <div className="mt4">
            <div className="card-section-title" style={{ marginTop: 0, marginBottom: "var(--s2)" }}>
              场景背景 ({Object.keys(backgrounds).length})
            </div>
            {Object.entries(backgrounds).map(([key, path]) => {
              const isDataUrl = path.startsWith("data:image");
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: "var(--s2)", marginBottom: "var(--s1)" }}>
                  {/* Preview */}
                  <span style={{
                    width: 44, height: 28, borderRadius: "var(--r-sm)", flexShrink: 0,
                    background: isDataUrl ? `url(${path}) center/cover` : "var(--surface)",
                    border: `1px solid ${isDataUrl ? "var(--border)" : "var(--border-light)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, color: "var(--text-muted)",
                  }}>
                    {!isDataUrl && "BG"}
                  </span>
                  <input className="input kv-key" value={key} readOnly style={{ fontSize: "var(--fs-xs)", flexShrink: 0 }} />
                  <input className="input mono kv-val" value={path}
                    onChange={(e) => setBackground(key, e.target.value)} style={{ fontSize: "var(--fs-xs)" }} />
                  <label style={{ cursor: "pointer", padding: "2px 6px", borderRadius: "var(--r-sm)", fontSize: "var(--fs-xs)", color: "var(--text-muted)", border: "1px solid var(--border-light)", whiteSpace: "nowrap", flexShrink: 0 }}>
                    上传
                    <input type="file" accept="image/*" hidden
                      onChange={async (e) => {
                        const f = e.target.files?.[0]; if (!f) return;
                        const dataUrl = await readImageFile(f);
                        setBackground(key, dataUrl);
                        e.target.value = "";
                      }} />
                  </label>
                  <button className="btn btn-ghost btn-xs" style={{ color: "var(--danger)", flexShrink: 0 }}
                    onClick={() => removeBackground(key)}>✕</button>
                </div>
              );
            })}
            <div className="kv-row mt2">
              <input className="input kv-key" value={newBgKey} onChange={(e) => setNewBgKey(e.target.value)} placeholder="场景键名" />
              <input className="input mono kv-val" value={newBgPath} onChange={(e) => setNewBgPath(e.target.value)} placeholder="图片路径或URL" />
              <button className="btn btn-primary btn-xs"
                onClick={() => { if (newBgKey && newBgPath) { setBackground(newBgKey, newBgPath); setNewBgKey(""); setNewBgPath(""); } }}
                disabled={!newBgKey || !newBgPath}>添加</button>
            </div>
          </div>
        </div>

        {/* Fonts */}
        <div className="card mt4">
          <div className="card-section-title" style={{ marginTop: 0 }}>字体配置</div>
          <div className="form-grid cols-3">
            {(["heading", "body", "ui"] as const).map((key) => (
              <label className="field" key={key}>
                <span>{key === "heading" ? "标题字体" : key === "body" ? "正文字体" : "UI 字体"}</span>
                <input className="input" value={fonts[key] || ""}
                  onChange={(e) => setFont(key, e.target.value)} placeholder="字体名称或路径" />
              </label>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
