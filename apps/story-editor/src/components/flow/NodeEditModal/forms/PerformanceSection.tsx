import { useState } from "react";
import { F } from "../shared.js";
import { useEditorStore } from "../../../../store/editorStore.js";

/**
 * 演出绑定区域 — 嵌入在 ModuleForm 中。
 * 允许用户为当前阶段绑定一个 stageEnter 类型的演出（图片/音频/视频）。
 * 
 * 数据存储在 editorStore.manifest.performances 中，key 为 `stage_enter_<stageId>`。
 * trigger.type = "stageEnter", trigger.stageId = 当前模块对应的 stage ID。
 */

interface PerformanceSectionProps {
  stageId: string | undefined;
  moduleLabel: string;
}

type RendererType = "image" | "audio" | "video" | "none";

interface PerformanceConfig {
  name: string;
  renderer: RendererType;
  durationMs: number;
  playOnce: "session" | "story" | "never" | "perStage";
  layers: Record<string, string>;
  audio: Record<string, string>;
  video: { mp4?: string; webm?: string; poster?: string; containsAudio?: boolean };
}

export function PerformanceSection({ stageId, moduleLabel }: PerformanceSectionProps) {
  const manifest = useEditorStore((s) => s.manifest);
  const updateManifest = useEditorStore((s) => s.updateManifest);
  const [uploading, setUploading] = useState(false);

  if (!stageId) {
    return (
      <div style={{ opacity: 0.5, fontSize: 11, fontStyle: "italic", padding: "8px 0" }}>
        需要先绑定模块（moduleRef）或设置来源阶段才能配置演出
      </div>
    );
  }

  const perfKey = `stage_enter_${stageId}`;
  const performances = (manifest as any)?.performances || {};
  const existing: PerformanceConfig | undefined = performances[perfKey];

  const updatePerformance = (config: PerformanceConfig | null) => {
    const newPerformances = { ...performances };
    if (config) {
      newPerformances[perfKey] = {
        ...config,
        trigger: {
          type: "stageEnter" as const,
          stageId,
        },
      };
    } else {
      delete newPerformances[perfKey];
    }
    updateManifest({ ...(manifest as any || {}), performances: newPerformances });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "audio" | "video") => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const endpoint = type === "audio"
        ? "performance-audio"
        : type === "video"
          ? "performance-video"
          : "performance-image";

      const res = await fetch(
        `/api/editor/upload-media?performanceId=${encodeURIComponent(perfKey)}&type=${endpoint}`,
        { method: "POST", body: form }
      );
      const data = await res.json();

      if (!data.path) {
        alert("上传失败：" + (data.error || "未知错误"));
        return;
      }

      // Update performance config with the uploaded file path
      const current: PerformanceConfig = existing || {
        name: moduleLabel || stageId,
        renderer: type === "audio" ? "audio" : type === "video" ? "video" : "image",
        durationMs: type === "audio" ? 3000 : 5000,
        playOnce: "session",
        layers: {},
        audio: {},
        video: {},
      };

      if (type === "image") {
        current.renderer = "image";
        current.layers = { ...current.layers, main: data.path };
      } else if (type === "audio") {
        current.renderer = current.layers.main ? "image" : "audio";
        current.audio = { ...current.audio, main: data.path };
      } else if (type === "video") {
        current.renderer = "video";
        current.video = { ...current.video, mp4: data.path };
      }

      updatePerformance(current);
    } catch (err) {
      alert("上传失败：" + (err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    if (confirm("确定删除此阶段的演出配置？")) {
      updatePerformance(null);
    }
  };

  return (
    <div style={{
      border: "1px solid var(--border-light)",
      borderRadius: "var(--r-md)",
      padding: "var(--s3)",
      background: "var(--surface)",
    }}>
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: "var(--s2)", display: "flex", alignItems: "center", gap: 6 }}>
        🎬 阶段演出
        <span style={{ fontSize: 10, fontWeight: 400, color: "var(--text-faint)" }}>
          进入此阶段时自动触发
        </span>
      </div>

      {existing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s2)" }}>
          {/* Show current config */}
          <div className="form-grid cols-2">
            <F label="演出名称">
              <input className="input" value={existing.name || ""}
                onChange={(e) => updatePerformance({ ...existing, name: e.target.value })} />
            </F>
            <F label="渲染方式">
              <select className="input" value={existing.renderer}
                onChange={(e) => updatePerformance({ ...existing, renderer: e.target.value as RendererType })}>
                <option value="image">图片</option>
                <option value="audio">音频</option>
                <option value="video">视频</option>
                <option value="none">无（仅标记）</option>
              </select>
            </F>
          </div>

          <div className="form-grid cols-2">
            <F label="持续时间 (ms)">
              <input className="input" type="number" value={existing.durationMs}
                onChange={(e) => updatePerformance({ ...existing, durationMs: parseInt(e.target.value) || 3000 })} />
            </F>
            <F label="播放次数">
              <select className="input" value={existing.playOnce}
                onChange={(e) => updatePerformance({ ...existing, playOnce: e.target.value as any })}>
                <option value="session">每次会话播一次</option>
                <option value="perStage">每次进入播一次</option>
                <option value="story">整个故事只播一次</option>
                <option value="never">每次都播</option>
              </select>
            </F>
          </div>

          {/* Show uploaded files */}
          <div style={{ fontSize: 10, color: "var(--text-faint)", lineHeight: 1.6 }}>
            {existing.layers?.main && <div>🖼️ 图片: {existing.layers.main}</div>}
            {existing.audio?.main && <div>🔊 音频: {existing.audio.main}</div>}
            {existing.video?.mp4 && <div>🎥 视频: {existing.video.mp4}</div>}
          </div>

          {/* Upload buttons */}
          <div style={{ display: "flex", gap: "var(--s2)", flexWrap: "wrap" }}>
            <label className="btn btn-xs" style={{ cursor: "pointer" }}>
              🖼️ 上传图片
              <input type="file" accept="image/*" hidden onChange={(e) => handleFileUpload(e, "image")} />
            </label>
            <label className="btn btn-xs" style={{ cursor: "pointer" }}>
              🔊 上传音频
              <input type="file" accept="audio/*" hidden onChange={(e) => handleFileUpload(e, "audio")} />
            </label>
            <label className="btn btn-xs" style={{ cursor: "pointer" }}>
              🎥 上传视频
              <input type="file" accept="video/*" hidden onChange={(e) => handleFileUpload(e, "video")} />
            </label>
            <button className="btn btn-xs" style={{ color: "var(--cat-red)" }} onClick={handleRemove}>
              🗑️ 删除演出
            </button>
          </div>

          {uploading && <div style={{ fontSize: 10, color: "var(--cat-orange)" }}>上传中...</div>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s2)" }}>
          <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
            尚未配置演出。上传媒体文件即可创建：
          </div>
          <div style={{ display: "flex", gap: "var(--s2)", flexWrap: "wrap" }}>
            <label className="btn btn-xs" style={{ cursor: "pointer" }}>
              🖼️ 上传图片
              <input type="file" accept="image/*" hidden onChange={(e) => handleFileUpload(e, "image")} />
            </label>
            <label className="btn btn-xs" style={{ cursor: "pointer" }}>
              🔊 上传音频
              <input type="file" accept="audio/*" hidden onChange={(e) => handleFileUpload(e, "audio")} />
            </label>
            <label className="btn btn-xs" style={{ cursor: "pointer" }}>
              🎥 上传视频
              <input type="file" accept="video/*" hidden onChange={(e) => handleFileUpload(e, "video")} />
            </label>
          </div>
          {uploading && <div style={{ fontSize: 10, color: "var(--cat-orange)" }}>上传中...</div>}
        </div>
      )}
    </div>
  );
}
