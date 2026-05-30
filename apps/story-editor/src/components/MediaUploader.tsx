import { useState, useRef } from "react";
import { uploadMedia, mediaUrl } from "../lib/api.js";

interface Props {
  label: string;
  currentPath?: string;
  onUploaded: (path: string) => void;
  onRemove: () => void;
  accept?: string;  // e.g. "image/*" or "audio/*"
}

export function MediaUploader({ label, currentPath, onUploaded, onRemove, accept = "image/*" }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAudio = accept.includes("audio");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const dataUrl = await readAsDataUrl(file);
      const result = await uploadMedia(dataUrl, file.name);
      if (result.ok && result.path) {
        onUploaded(result.path);
      } else {
        setError(result.error || "上传失败");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div style={{
      background: "var(--bg)", borderRadius: "var(--r-md)",
      border: "1px solid var(--border-light)", padding: "var(--s3)",
    }}>
      <div className="flex-between mb2">
        <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--text2)" }}>{label}</span>
        {currentPath && (
          <button className="btn btn-ghost btn-xs" style={{ color: "var(--danger)" }} onClick={onRemove}>
            移除
          </button>
        )}
      </div>

      {/* Preview */}
      {currentPath ? (
        isAudio ? (
          <audio controls style={{ width: "100%", height: 32, marginBottom: "var(--s2)" }}>
            <source src={mediaUrl(currentPath)} />
          </audio>
        ) : (
          <div style={{
            width: "100%", height: 140, borderRadius: "var(--r-sm)",
            background: `url("${mediaUrl(currentPath)}") center/cover`,
            border: "1px solid var(--border-light)", marginBottom: "var(--s2)",
            position: "relative", overflow: "hidden",
          }}>
            <span style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              padding: "2px 6px", background: "rgba(0,0,0,0.6)",
              fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)",
            }}>
              {currentPath}
            </span>
          </div>
        )
      ) : (
        <div style={{
          width: "100%", height: 80, borderRadius: "var(--r-sm)",
          border: "1px dashed var(--border)", display: "flex",
          alignItems: "center", justifyContent: "center",
          marginBottom: "var(--s2)",
        }}>
          <span className="faint">{isAudio ? "🔊 暂无音频" : "🖼️ 暂无图片"}</span>
        </div>
      )}

      {/* Upload button */}
      <div className="flex-center gap2">
        <input ref={fileRef} type="file" accept={accept} hidden onChange={handleFile} />
        <button
          className="btn btn-sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{ fontSize: "var(--fs-sm)", flex: 1 }}
        >
          {uploading ? "上传中..." : isAudio ? "🔊 上传音频" : "📷 上传图片"}
        </button>
      </div>

      {error && <p style={{ fontSize: "var(--fs-xs)", color: "var(--danger)", marginTop: 4 }}>{error}</p>}
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
