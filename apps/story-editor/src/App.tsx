import { useEffect, useState } from "react";
import { useEditorStore } from "./store/editorStore.js";
import { FileManager } from "./components/FileManager.js";
import { CharacterSkills } from "./components/CharacterSkills.js";
import { RulePipeline } from "./components/RulePipeline.js";
import { FlowEditor } from "./components/flow/FlowEditor.js";
import { PerformanceMapper } from "./components/PerformanceMapper.js";
import { SettingsPanel } from "./components/SettingsPanel.js";
import { AiCreateTab } from "./components/AiCreateTab.js";
import { StoryExportTab } from "./components/StoryExportTab.js";

const TABS: { key: string; label: string }[] = [
  { key: "flow", label: "流程编辑" },
  { key: "aiCreate", label: "🤖 AI创作" },
  { key: "skills", label: "角色技能" },
  { key: "performances", label: "演出映射" },
  { key: "promptRules", label: "规则管线" },
  { key: "export", label: "📖 导出小说" },
  { key: "settings", label: "高级设置" },
];

function encodeHash(path: string): string {
  return btoa(encodeURIComponent(path));
}
function decodeHash(hash: string): string | null {
  try { return decodeURIComponent(atob(hash)); } catch { return null; }
}

export function App() {
  const {
    loaded, storyPackage, storyDir, dirty, saving, error, activeTab,
    setActiveTab, save, reload, exportZip, clearError, upload, uploadResult
  } = useEditorStore();

  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [uploadUrl, setUploadUrl] = useState("http://localhost:4000");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && !loaded) {
      const p = decodeHash(hash);
      if (p) {
        useEditorStore.getState().openPackage(p).catch(() => {
          window.location.hash = "";
        });
      }
    }
  }, []);

  useEffect(() => {
    if (loaded && storyDir) {
      window.location.hash = encodeHash(storyDir);
    }
  }, [loaded, storyDir]);

  function handleClose() {
    window.location.hash = "";
    useEditorStore.setState({ loaded: false, storyDir: "", storyPackage: null, error: null });
  }

  async function handleSave() {
    await save();
    setFeedbackMsg("已保存");
    setTimeout(() => setFeedbackMsg(""), 2000);
  }

  async function handleReload() {
    await reload();
    setFeedbackMsg("已刷新");
    setTimeout(() => setFeedbackMsg(""), 2000);
  }

  async function handleUpload() {
    setUploading(true);
    await upload(uploadUrl);
    setUploading(false);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      if (loaded) handleSave();
    }
  }

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loaded]);

  if (!loaded) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <h1>Story Editor</h1>
          <span className="subtitle">本地故事包编辑器</span>
        </header>
        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={clearError}>✕</button>
          </div>
        )}
        <FileManager />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>{storyPackage?.title || "未命名故事"}</h1>
        <span className="subtitle">{storyDir}</span>
        <div className="header-actions">
          {dirty && <span className="status-dot dirty" title="未保存" />}
          {feedbackMsg && <span className="tag tag-green">{feedbackMsg}</span>}
          <button className="btn btn-sm" onClick={handleReload} title="从磁盘重新加载">刷新</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </button>
          <button className="btn btn-sm" onClick={exportZip}>导出ZIP</button>
          <input
            className="input"
            value={uploadUrl}
            onChange={(e) => setUploadUrl(e.target.value)}
            placeholder="上传地址"
            style={{ width: 160 }}
          />
          <button className="btn btn-primary btn-sm" onClick={handleUpload} disabled={uploading}>
            {uploading ? "上传中..." : "上传"}
          </button>
          <button className="btn btn-sm" onClick={handleClose}>关闭</button>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={clearError}>✕</button>
        </div>
      )}

      {uploadResult && (
        <div className={uploadResult.includes("成功") ? "success-banner" : "error-banner"}>
          <span>{uploadResult}</span>
          <button onClick={() => useEditorStore.setState({ uploadResult: null })}>✕</button>
        </div>
      )}

      <div className="app-body">
        <nav className="tab-nav">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab-btn${activeTab === t.key ? " active" : ""}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <main className="tab-content">
          {activeTab === "flow" && <FlowEditor />}
          {activeTab === "aiCreate" && <AiCreateTab />}
          {activeTab === "skills" && <CharacterSkills />}
          {activeTab === "promptRules" && <RulePipeline />}
          {activeTab === "performances" && <PerformanceMapper />}
          {activeTab === "export" && <StoryExportTab />}
          {activeTab === "settings" && <SettingsPanel />}
        </main>
      </div>
    </div>
  );
}
