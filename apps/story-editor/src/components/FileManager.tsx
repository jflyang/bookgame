import { useEffect, useState } from "react";
import { useEditorStore } from "../store/editorStore.js";
import { fetchPackages, type StoryPackageInfo } from "../lib/api.js";

function AiConfigPanel() {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com");
  const [model, setModel] = useState("deepseek-chat");
  const [maskedKey, setMaskedKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/editor/ai/config").then(r => r.json()).then(data => {
      setMaskedKey(data.apiKey || "");
      setBaseUrl(data.baseUrl || "https://api.deepseek.com");
      setModel(data.model || "deepseek-chat");
      setHasKey(data.hasKey || false);
    }).catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/editor/ai/save-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() || undefined, baseUrl, model }),
      });
      const data = await res.json();
      if (data.ok) {
        setMaskedKey(data.apiKey);
        setHasKey(data.hasKey);
        setApiKey("");
        setExpanded(false);
      } else {
        alert("保存失败：" + data.error);
      }
    } catch (err) { alert("保存失败：" + (err as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: "var(--r-md)", padding: "var(--s3)", marginBottom: "var(--s4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s2)" }}>
          <span style={{ fontSize: 14 }}>🤖</span>
          <span style={{ fontWeight: 600, fontSize: 12 }}>AI 配置</span>
          {hasKey ? (
            <span style={{ fontSize: 10, color: "var(--cat-green)" }}>✓ 已配置 ({maskedKey})</span>
          ) : (
            <span style={{ fontSize: 10, color: "var(--cat-orange)" }}>⚠ 未配置 Key</span>
          )}
        </div>
        <button className="btn btn-xs" onClick={() => setExpanded(!expanded)}>
          {expanded ? "收起" : "设置"}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: "var(--s3)", display: "flex", flexDirection: "column", gap: "var(--s2)" }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-faint)" }}>API Key</label>
            <input className="input" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder={hasKey ? `当前: ${maskedKey}（留空不修改）` : "输入 DeepSeek API Key"} />
          </div>
          <div style={{ display: "flex", gap: "var(--s2)" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-faint)" }}>Base URL</label>
              <input className="input" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-faint)" }}>模型</label>
              <select className="input" value={model} onChange={e => setModel(e.target.value)}>
                <option value="deepseek-chat">deepseek-chat (Pro)</option>
                <option value="deepseek-reasoner">deepseek-reasoner (R1)</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存配置"}
          </button>
        </div>
      )}
    </div>
  );
}

export function FileManager() {
  const { openPackage, error, clearError } = useEditorStore();
  const [packages, setPackages] = useState<StoryPackageInfo[]>([]);
  const [path, setPath] = useState("");
  const [opening, setOpening] = useState(false);
  const [scanning, setScanning] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchPackages().then((list) => {
      setPackages(list);
      setScanning(false);
    }).catch(() => setScanning(false));
  }, []);

  async function handleOpen(p: string) {
    setOpening(true);
    try { await openPackage(p); } finally { setOpening(false); }
  }

  async function handleOpenPath() {
    if (!path.trim()) return;
    await handleOpen(path.trim());
  }

  async function handleCreateEmpty() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/editor/ai/create-package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outline: {
            title: newTitle.trim(),
            premise: "",
            setting: "",
            characters: [],
            stages: [],
            flow: { mainLine: [], finale: [] },
          },
          stageDetails: {},
        }),
      });
      const data = await res.json();
      if (data.ok) {
        await handleOpen(data.packagePath);
      } else {
        alert("创建失败：" + data.error);
      }
    } catch (err) {
      alert("创建失败：" + (err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="file-manager">
      <h2>Story Editor</h2>
      <p className="muted">本地故事包编辑器 — 打开已有存档或输入路径</p>

      {error && (
        <div className="error-banner mt4" style={{ borderRadius: "var(--r-md)" }}>
          <span>{error}</span>
          <button onClick={clearError}>✕</button>
        </div>
      )}

      <AiConfigPanel />

      {/* Create new package */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: "var(--r-md)", padding: "var(--s3)", marginBottom: "var(--s4)" }}>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: "var(--s2)" }}>✨ 创建新故事</div>
        <div style={{ display: "flex", gap: "var(--s1)" }}>
          <input className="input" style={{ flex: 1 }} value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="输入故事标题" onKeyDown={e => { if (e.key === "Enter") handleCreateEmpty(); }} />
          <button className="btn btn-primary btn-sm" onClick={handleCreateEmpty} disabled={creating || !newTitle.trim()}>
            {creating ? "创建中..." : "创建"}
          </button>
        </div>
        <p style={{ fontSize: 10, color: "var(--text-faint)", margin: "var(--s1) 0 0" }}>
          创建空故事包后进入编辑器，可在「🤖 AI创作」tab 中用 AI 填充内容
        </p>
      </div>

      {/* Manual path input */}
      <div className="input-row mt6">
        <input
          className="input"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleOpenPath(); }}
          placeholder="目录路径，如 story_N1WIx-Y0J8"
        />
        <button className="btn btn-primary" onClick={handleOpenPath} disabled={opening || !path.trim()}>
          {opening ? "打开中..." : "打开"}
        </button>
      </div>

      {/* Package list */}
      <div className="mt6">
        <div className="flex-between mb3">
          <span className="section-title" style={{ padding: 0 }}>
            {scanning ? "扫描中..." : `已找到 ${packages.length} 个故事包`}
          </span>
        </div>

        {packages.length === 0 && !scanning && (
          <div className="empty-state">
            <p>未找到故事包</p>
            <span className="hint">在上方输入路径手动打开</span>
          </div>
        )}

        <div className="pkg-grid">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="pkg-card"
              onClick={() => handleOpen(pkg.path)}
              title={`路径: ${pkg.path}`}
            >
              <div className="pkg-card-title">{pkg.title}</div>
              <div className="pkg-card-id mono">{pkg.id}</div>
              {pkg.description && (
                <div className="pkg-card-desc">
                  {pkg.description.slice(0, 100)}{pkg.description.length > 100 ? "..." : ""}
                </div>
              )}
              <div className="pkg-card-meta">
                <span className="faint mono">{pkg.path.split("/").pop()}</span>
                {pkg.updatedAt && (
                  <span className="faint">
                    {new Date(pkg.updatedAt).toLocaleDateString("zh-CN")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {opening && (
        <div className="mt4 faint" style={{ textAlign: "center" }}>加载中...</div>
      )}
    </div>
  );
}
