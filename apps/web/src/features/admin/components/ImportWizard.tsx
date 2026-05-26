import { useState } from "react";
import { Upload, Check, AlertTriangle } from "lucide-react";
import type { StoryPackage } from "@story-game/shared";
import { useGameStore } from "../../../store/gameStore.js";

export function ImportWizard() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<StoryPackage | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const { importStoryPackage, showLibrary, storyPackages } = useGameStore();

  function handleFile(file: File) {
    setFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as StoryPackage;
        const issues: string[] = [];
        if (!data.id) issues.push("缺少 id 字段");
        if (!data.title) issues.push("缺少 title 字段");
        if (!data.scenario) issues.push("缺少 scenario 字段");
        if (!data.characters || data.characters.length === 0) issues.push("缺少角色配置");
        setErrors(issues);
        setParsed(data);
        setStep(2);
      } catch {
        setErrors(["无法解析 JSON 文件，请确保是合法的 .story-package.json"]);
        setParsed(null);
      }
    };
    reader.readAsText(file);
  }

  function handleImport() {
    if (!parsed) return;
    void importStoryPackage(parsed).then(() => {
      showLibrary();
    });
  }

  return (
    <section className="import-wizard">
      <h2>导入故事包</h2>

      <div className="wizard-steps">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`wizard-step ${step >= s ? "active" : ""} ${step > s ? "done" : ""}`}>
            <span className="step-number">{s}</span>
            <span className="step-label">{s === 1 ? "选择文件" : s === 2 ? "预览校验" : "确认导入"}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="import-dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}>
          <Upload size={40} strokeWidth={1} />
          <p>拖拽 .story-package.json 到此处，或点击选择文件</p>
          <input type="file" accept=".story-package.json,.json" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      )}

      {step >= 2 && parsed && (
        <div className="import-preview">
          <h3>{parsed.title || "未命名故事包"}</h3>
          <p>{parsed.description || "无描述"}</p>
          <dl>
            <div><dt>角色数</dt><dd>{parsed.characters?.length ?? 0}</dd></div>
            <div><dt>技能数</dt><dd>{parsed.skills?.length ?? 0}</dd></div>
            <div><dt>阶段数</dt><dd>{parsed.scenario?.stages?.length ?? 0}</dd></div>
          </dl>
          {errors.length > 0 ? (
            <div className="import-errors">
              {errors.map((e, i) => (
                <p key={i}><AlertTriangle size={14} /> {e}</p>
              ))}
            </div>
          ) : step === 2 ? (
            <p className="import-ok"><Check size={14} /> 校验通过</p>
          ) : null}
          {step === 2 && (
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => setStep(3)}>继续</button>
              <button className="ghost-button" onClick={() => { setStep(1); setFile(null); setParsed(null); setErrors([]); }}>重新选择</button>
            </div>
          )}
          {step === 3 && (
            <div style={{ marginTop: 16 }}>
              <label className="checkbox-line" style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0" }}>
                <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
                覆盖同名包（如果已存在）
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleImport} disabled={errors.length > 0}><Upload size={16} /> 确认导入</button>
                <button className="ghost-button" onClick={() => setStep(2)}>返回上一步</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
