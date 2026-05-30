import { useState, useCallback } from "react";

interface OutlineData {
  title: string;
  premise: string;
  setting: string;
  characters: { id: string; name: string; role: string; description: string }[];
  stages: { id: string; title: string; description: string; stageType: string; enterWhen: string; sortKey: number; isChoicePoint?: boolean; branches?: { choiceText: string; description: string }[] }[];
  flow: { mainLine: string[]; choicePoint?: string; branches?: Record<string, string[]>; converge?: string; finale: string[] };
}

interface StageDetail { guidance: string; directive: string }

type WizardStep = "input" | "outline" | "generating" | "done";

interface Props {
  onComplete: (packagePath: string) => void;
  onCancel: () => void;
}

export function AiGenerateWizard({ onComplete, onCancel }: Props) {
  const [step, setStep] = useState<WizardStep>("input");

  // Input state
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("");
  const [stageCount, setStageCount] = useState(18);
  const [branchCount, setBranchCount] = useState(3);
  const [characters, setCharacters] = useState<{ name: string; role: string }[]>([]);

  // Outline state
  const [outline, setOutline] = useState<OutlineData | null>(null);
  const [outlineError, setOutlineError] = useState("");
  const [outlineLoading, setOutlineLoading] = useState(false);

  // Generation state
  const [stageDetails, setStageDetails] = useState<Record<string, StageDetail>>({});
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentStage, setCurrentStage] = useState("");
  const [genError, setGenError] = useState("");

  // ─── Step 1: Generate Outline ───
  const handleGenerateOutline = useCallback(async () => {
    setOutlineLoading(true);
    setOutlineError("");
    try {
      const res = await fetch("/api/editor/ai/generate-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, style, stageCount, branchCount, characters: characters.length > 0 ? characters : undefined }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "生成失败");
      setOutline(data.outline);
      setStep("outline");
    } catch (err) {
      setOutlineError((err as Error).message);
    } finally {
      setOutlineLoading(false);
    }
  }, [description, style, stageCount, branchCount, characters]);

  // ─── Step 2: Create package first, then generate details incrementally ───
  const handleGenerateDetails = useCallback(async () => {
    if (!outline) return;
    setStep("generating");
    setGenError("");

    const stages = outline.stages;
    setTotal(stages.length);
    setProgress(0);

    // Step 3a: Create package immediately with empty details
    let pkgPath = "";
    try {
      const res = await fetch("/api/editor/ai/create-package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outline, stageDetails: {} }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "创建故事包失败");
      pkgPath = data.packagePath;
    } catch (err) {
      setGenError("创建故事包失败：" + (err as Error).message);
      return;
    }

    // Step 3b: Generate each stage and save incrementally
    const details: Record<string, StageDetail> = {};
    let prevGuidance: string | undefined;

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      setCurrentStage(stage.title);
      setProgress(i);

      try {
        const res = await fetch("/api/editor/ai/generate-stage-detail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outline, stageId: stage.id, previousGuidance: prevGuidance }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || `阶段 ${stage.title} 生成失败`);

        details[stage.id] = data.detail;
        prevGuidance = data.detail.guidance;
        setStageDetails({ ...details });

        // Save to disk immediately
        await fetch("/api/editor/ai/update-stage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packagePath: pkgPath, stageId: stage.id, guidance: data.detail.guidance, directive: data.detail.directive }),
        });
      } catch (err) {
        // Retry once
        try {
          const res = await fetch("/api/editor/ai/generate-stage-detail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ outline, stageId: stage.id, previousGuidance: prevGuidance }),
          });
          const data = await res.json();
          if (data.ok) {
            details[stage.id] = data.detail;
            prevGuidance = data.detail.guidance;
            setStageDetails({ ...details });
            await fetch("/api/editor/ai/update-stage", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ packagePath: pkgPath, stageId: stage.id, guidance: data.detail.guidance, directive: data.detail.directive }),
            });
          } else {
            details[stage.id] = { guidance: "", directive: "" };
          }
        } catch {
          details[stage.id] = { guidance: "", directive: "" };
        }
      }
    }

    setProgress(stages.length);
    setStep("done");
    onComplete(pkgPath);
  }, [outline, onComplete]);

  // ─── Render ───

  return (
    <div className="modal-backdrop" onClick={step === "generating" ? undefined : onCancel}>
      <div className="modal-popup" style={{ width: 700, maxHeight: "85vh", overflow: "auto" }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🤖 AI 创建新故事</h3>
          {step === "generating" ? (
            <span style={{ fontSize: 10, color: "var(--text-faint)" }}>生成中...已保存的内容不会丢失</span>
          ) : (
            <button className="btn btn-ghost btn-xs" onClick={onCancel}>✕</button>
          )}
        </div>

        <div className="modal-body" style={{ padding: "var(--s4)", display: "flex", flexDirection: "column", gap: "var(--s4)" }}>

          {/* ─── Step: Input ─── */}
          {step === "input" && (
            <>
              <div>
                <label style={{ fontWeight: 600, fontSize: 12, display: "block", marginBottom: 4 }}>故事描述 *</label>
                <textarea className="input" rows={4} value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="描述你想要的故事，如：虚竹得知丁春秋欺师灭祖，在乔峰段誉陪同下前往星宿海清理门户。三兄弟联手对抗丁春秋的毒功，最终以生死符制服对手。" />
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: 12, display: "block", marginBottom: 4 }}>风格提示词（可选）</label>
                <input className="input" value={style} onChange={e => setStyle(e.target.value)}
                  placeholder="如：武侠金庸风格、有分支选择、注重兄弟情义" />
              </div>
              <div style={{ display: "flex", gap: "var(--s4)" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontWeight: 600, fontSize: 12, display: "block", marginBottom: 4 }}>阶段数量</label>
                  <input className="input" type="number" min={6} max={40} value={stageCount} onChange={e => setStageCount(Number(e.target.value))} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontWeight: 600, fontSize: 12, display: "block", marginBottom: 4 }}>分支路线数</label>
                  <input className="input" type="number" min={0} max={5} value={branchCount} onChange={e => setBranchCount(Number(e.target.value))} />
                </div>
              </div>

              {/* Characters */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label style={{ fontWeight: 600, fontSize: 12 }}>角色（可选，留空自动生成）</label>
                  <button className="btn btn-xs" onClick={() => setCharacters([...characters, { name: "", role: "" }])}>+ 添加</button>
                </div>
                {characters.map((c, i) => (
                  <div key={i} style={{ display: "flex", gap: "var(--s1)", marginBottom: 4 }}>
                    <input className="input" style={{ flex: 1 }} value={c.name} placeholder="角色名"
                      onChange={e => { const arr = [...characters]; arr[i] = { ...arr[i], name: e.target.value }; setCharacters(arr); }} />
                    <input className="input" style={{ flex: 1 }} value={c.role} placeholder="角色定位（主角/辅助/反派）"
                      onChange={e => { const arr = [...characters]; arr[i] = { ...arr[i], role: e.target.value }; setCharacters(arr); }} />
                    <button className="btn btn-xs" onClick={() => setCharacters(characters.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
              </div>

              {outlineError && <div style={{ color: "var(--danger)", fontSize: 12 }}>❌ {outlineError}</div>}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--s2)" }}>
                <button className="btn" onClick={onCancel}>取消</button>
                <button className="btn btn-primary" onClick={handleGenerateOutline} disabled={!description.trim() || outlineLoading}>
                  {outlineLoading ? "⏳ 生成大纲中..." : "生成大纲 →"}
                </button>
              </div>
            </>
          )}

          {/* ─── Step: Outline Preview (Editable) ─── */}
          {step === "outline" && outline && (
            <>
              <div style={{ background: "var(--surface)", borderRadius: "var(--r-md)", padding: "var(--s3)" }}>
                <div style={{ display: "flex", gap: "var(--s2)", marginBottom: "var(--s2)" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-faint)" }}>标题</label>
                    <input className="input" value={outline.title}
                      onChange={e => setOutline({ ...outline, title: e.target.value })} />
                  </div>
                </div>
                <div style={{ marginBottom: "var(--s2)" }}>
                  <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-faint)" }}>前提</label>
                  <input className="input" value={outline.premise}
                    onChange={e => setOutline({ ...outline, premise: e.target.value })} />
                </div>
                <div style={{ fontSize: 11 }}>
                  <b>角色：</b>{outline.characters.map(c => `${c.name}(${c.role})`).join("、")}
                </div>
              </div>

              <div style={{ maxHeight: 350, overflow: "auto", border: "1px solid var(--border-light)", borderRadius: "var(--r-md)", padding: "var(--s2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--s2)" }}>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>阶段列表 ({outline.stages.length})</span>
                  <button className="btn btn-xs" onClick={() => {
                    const newId = `stage_${String(outline.stages.length + 1).padStart(3, "0")}`;
                    setOutline({
                      ...outline,
                      stages: [...outline.stages, { id: newId, title: `新阶段`, description: "", stageType: "serving", enterWhen: "", sortKey: outline.stages.length }],
                    });
                  }}>+ 添加阶段</button>
                </div>
                {outline.stages.map((s, i) => (
                  <div key={s.id} style={{ fontSize: 11, padding: "4px 0", display: "flex", gap: "var(--s1)", alignItems: "center", borderBottom: "1px solid var(--border-light)" }}>
                    <span style={{ color: "var(--text-faint)", width: 60, flexShrink: 0, fontSize: 9 }}>[{s.stageType}]</span>
                    <input className="input" style={{ flex: 1, padding: "2px 6px", fontSize: 11 }}
                      value={s.title}
                      onChange={e => {
                        const stages = [...outline.stages];
                        stages[i] = { ...stages[i], title: e.target.value };
                        setOutline({ ...outline, stages });
                      }} />
                    <select style={{ fontSize: 9, padding: "1px 2px", border: "1px solid var(--border-light)", borderRadius: 3 }}
                      value={s.stageType}
                      onChange={e => {
                        const stages = [...outline.stages];
                        stages[i] = { ...stages[i], stageType: e.target.value as any };
                        setOutline({ ...outline, stages });
                      }}>
                      <option value="training">training</option>
                      <option value="serving">serving</option>
                      <option value="punishment">punishment</option>
                      <option value="choice">choice</option>
                      <option value="event">event</option>
                      <option value="daily">daily</option>
                    </select>
                    <button className="btn btn-ghost btn-xs" style={{ color: "var(--danger)", fontSize: 9 }}
                      onClick={() => {
                        const stages = outline.stages.filter((_, j) => j !== i);
                        setOutline({ ...outline, stages });
                      }}>✕</button>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--s2)" }}>
                <button className="btn" onClick={() => setStep("input")}>← 返回修改</button>
                <button className="btn btn-primary" onClick={handleGenerateDetails}>
                  确认，生成详细内容 →
                </button>
              </div>
            </>
          )}

          {/* ─── Step: Generating ─── */}
          {step === "generating" && (
            <>
              <div style={{ textAlign: "center", padding: "var(--s4) 0" }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: "var(--s3)" }}>
                  ⏳ 正在生成详细内容...
                </div>
                <div style={{ background: "var(--border-light)", borderRadius: 4, height: 8, overflow: "hidden", marginBottom: "var(--s2)" }}>
                  <div style={{ background: "var(--primary)", height: "100%", width: `${total > 0 ? (progress / total) * 100 : 0}%`, transition: "width 0.3s" }} />
                </div>
                <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                  {progress}/{total} 阶段 · 当前：{currentStage}
                </div>
              </div>

              <div style={{ maxHeight: 200, overflow: "auto", fontSize: 11 }}>
                {outline?.stages.map((s, i) => (
                  <div key={s.id} style={{ padding: "2px 0", color: i < progress ? "var(--cat-green)" : i === progress ? "var(--cat-orange)" : "var(--text-faint)" }}>
                    {i < progress ? "✅" : i === progress ? "🔄" : "⏳"} {s.title}
                  </div>
                ))}
              </div>

              {genError && <div style={{ color: "var(--danger)", fontSize: 12 }}>❌ {genError}</div>}
            </>
          )}

          {/* ─── Step: Done ─── */}
          {step === "done" && (
            <div style={{ textAlign: "center", padding: "var(--s6) 0" }}>
              <div style={{ fontSize: 48, marginBottom: "var(--s3)" }}>🎉</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: "var(--s2)" }}>故事包创建成功！</div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: "var(--s4)" }}>
                {outline?.title} · {outline?.stages.length} 个阶段 · {outline?.characters.length} 个角色
              </div>
              <button className="btn btn-primary" onClick={onCancel}>打开编辑器</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
