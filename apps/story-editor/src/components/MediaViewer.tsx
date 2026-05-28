import { useState } from "react";
import { useEditorStore } from "../store/editorStore.js";
import { mediaUrl } from "../lib/api.js";

const AUDIO_EXTS = [".mp3", ".wav", ".ogg", ".aac", ".m4a"];
const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];
const VIDEO_EXTS = [".mp4", ".webm", ".mov"];

function fileIcon(name: string): string {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  if (AUDIO_EXTS.includes(ext)) return "🔊";
  if (IMAGE_EXTS.includes(ext)) return "🖼️";
  if (VIDEO_EXTS.includes(ext)) return "🎬";
  return "📄";
}

export function MediaViewer() {
  const { mediaFiles } = useEditorStore();
  const [selected, setSelected] = useState("");
  const [filter, setFilter] = useState("");

  const filtered = mediaFiles.filter((f) => f.toLowerCase().includes(filter.toLowerCase()));
  const ext = selected.slice(selected.lastIndexOf(".")).toLowerCase();
  const isAudio = AUDIO_EXTS.includes(ext);
  const isImage = IMAGE_EXTS.includes(ext);
  const isVideo = VIDEO_EXTS.includes(ext);

  return (
    <div className="panel">
      <h2>媒体文件 ({mediaFiles.length})</h2>
      <input className="input" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="搜索文件名..." style={{ marginBottom: "var(--s5)" }} />

      <div style={{ display: "flex", gap: "var(--s5)" }}>
        <div style={{ flex: 1, maxHeight: 400, overflowY: "auto", border: "1px solid var(--border)", borderRadius: "var(--r-lg)" }}>
          {filtered.map((f) => (
            <button key={f} className="list-item" style={{ width: "100%", border: "none", borderRadius: 0, background: selected === f ? "var(--accent-bg)" : "transparent" }}
              onClick={() => setSelected(f)}>
              {fileIcon(f)} {f}
            </button>
          ))}
          {filtered.length === 0 && <p className="muted" style={{ padding: "var(--s6)" }}>无匹配文件</p>}
        </div>

        <div style={{ flex: 2 }}>
          {!selected && <p className="muted">选择左侧文件预览</p>}
          {selected && isAudio && (
            <div>
              <p><strong>{selected}</strong></p>
              <audio controls src={mediaUrl(selected)} style={{ width: "100%" }} />
            </div>
          )}
          {selected && isImage && (
            <div>
              <p><strong>{selected}</strong></p>
              <img src={mediaUrl(selected)} alt={selected} style={{ maxWidth: "100%", borderRadius: 8 }} />
            </div>
          )}
          {selected && isVideo && (
            <div>
              <p><strong>{selected}</strong></p>
              <video controls src={mediaUrl(selected)} style={{ maxWidth: "100%", borderRadius: 8 }} />
            </div>
          )}
          {selected && !isAudio && !isImage && !isVideo && (
            <p className="muted">此文件类型不支持预览</p>
          )}
        </div>
      </div>
    </div>
  );
}
