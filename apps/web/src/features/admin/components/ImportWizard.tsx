import { useState } from "react";
import { Upload, FileArchive, Check } from "lucide-react";
import { importStoryPackageZip } from "../../../lib/adminApi.js";
import { useGameStore } from "../../../store/gameStore.js";

export function ImportWizard() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const { showLibrary, loadStoryPackages } = useGameStore();

  function handleFile(f: File) {
    setFile(f);
    setError("");
    setStep(2);
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setError("");
    try {
      await importStoryPackageZip(file, title.trim() || undefined);
      await loadStoryPackages();
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败，请检查文件格式");
    } finally {
      setImporting(false);
    }
  }

  function handleReset() {
    setStep(1);
    setFile(null);
    setTitle("");
    setError("");
  }

  return (
    <section className="import-wizard">
      <h2>导入故事包</h2>

      <div className="wizard-steps">
        <div className={`wizard-step ${step >= 1 ? "active" : ""} ${step > 1 ? "done" : ""}`}>
          <span className="step-number">{step > 1 ? <Check size={14} /> : 1}</span>
          <span className="step-label">选择 ZIP 文件</span>
        </div>
        <div className={`wizard-step ${step >= 2 ? "active" : ""} ${step > 2 ? "done" : ""}`}>
          <span className="step-number">{step > 2 ? <Check size={14} /> : 2}</span>
          <span className="step-label">确认导入</span>
        </div>
        <div className={`wizard-step ${step >= 3 ? "active" : ""}`}>
          <span className="step-number">3</span>
          <span className="step-label">完成</span>
        </div>
      </div>

      {step === 1 && (
        <div className="import-dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}>
          <FileArchive size={48} strokeWidth={1} />
          <p>拖拽 .story-package.zip 或 .json 到此处，或点击选择文件</p>
          <p className="muted">支持 ZIP 包和 JSON 故事包文件</p>
          <input type="file" accept=".zip,.json" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      )}

      {step === 2 && file && (
        <div className="import-preview">
          <h3><FileArchive size={20} /> {file.name}</h3>
          <p className="muted">{(file.size / 1024).toFixed(1)} KB</p>

          <label className="form-field" style={{ marginTop: 16 }}>
            <span className="form-label">故事包标题（可选，留空使用原名称）</span>
            <input
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入新标题或留空"
            />
          </label>

          {error && (
            <div className="import-errors">
              <p>{error}</p>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button onClick={handleImport} disabled={importing}>
              <Upload size={16} /> {importing ? "导入中..." : "确认导入"}
            </button>
            <button className="ghost-button" onClick={handleReset}>重新选择</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="import-preview">
          <div style={{ textAlign: "center", padding: 24 }}>
            <Check size={48} strokeWidth={1} style={{ color: "#16a34a" }} />
            <h3>导入成功</h3>
            <p className="muted">故事包已添加到管理台</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
              <button onClick={() => showLibrary()}>返回故事管理台</button>
              <button className="ghost-button" onClick={handleReset}>导入另一个</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
