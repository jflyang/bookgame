import { useEffect, useState } from "react";
import { useEditorStore } from "../store/editorStore.js";
import { fetchPackages, type StoryPackageInfo } from "../lib/api.js";

export function FileManager() {
  const { openPackage, error, clearError } = useEditorStore();
  const [packages, setPackages] = useState<StoryPackageInfo[]>([]);
  const [path, setPath] = useState("");
  const [opening, setOpening] = useState(false);
  const [scanning, setScanning] = useState(true);

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
