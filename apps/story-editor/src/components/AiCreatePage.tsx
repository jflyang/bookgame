/**
 * AI Create Page — 独立页面版本的 AI 故事创建向导
 * 不是浮层，不会被误关。中间产物实时保存。
 */
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
type Step = "input" | "outline" | "generating" | "done";

interface Props {
  onComplete: (packagePath: string) => void;
  onBack: () => void;
}

export function AiCreatePage({ onComplete, onBack }: Props) {
  const [step, setStep] = useState<Step>("input");

  // Input
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("");
  const [stageCount, setStageCount] = useState(18);
  const [branchCount, setBranchCount] = useState(3);
  const [characters, setCharacters] = useState<{ name: string; role: string }[]>([]);

  // Outline
  const [outline, setOutline] = useState<OutlineData | null>(null);
  const [outlineError, setOutlineError] = useState("");
  const [outlineLoading, setOutlineLoading] = useState(false);

  // Generation
  const [packagePath, setPackagePath] = useState("");
  const [stageDetails, setStageDetails] = useState<Record<string, StageDetail>>({});
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentStage, setCurrentStage] = useState("");
  const [genError, setGenError] = useState("");
  const [generating, setGenerating] = useState(false);

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

  // ─── Step 2: Create package + generate details ───
  const handleGenerateDetails = useCallback(async () => {
    if (!outline) return;
    setStep("generating");
    setGenError("");
    setGenerating(true);

    const stages = outline.stages;
    setTotal(stages.length);
    setProgress(0);

    // Create package immediately
    let pkgPath = packagePath;
    if (!pkgPath) {
      try {
        const res = await fetch("/api/editor/ai/create-package", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outline, stageDetails: stageDetails }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "创建故事包失败");
        pkgPath = data.packagePath;
        setPackagePath(pkgPath);
      } catch (err) {
        setGenError("创建故事包失败：" + (err as Error).message);
        setGenerating(false);
        return;
      }
    }

    // Generate each stage incrementally
    const details = { ...stageDetails };
    let prevGuidance: string | undefined;

    // Find where we left off
    const startIdx = Object.keys(details).length;
    if (startIdx > 0) {
      const lastDone = stages[startIdx - 1];
      prevGuidance = details[lastDone?.id]?.guidance;
    }

    for (let i = startIdx; i < stages.length; i++) {
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
        if (!data.ok) throw new Error(data.error);

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
            setStageDetails({ ...details });
          }
        } catch {
          details[stage.id] = { guidance: "", directive: "" };
          setStageDetails({ ...details });
        }
      }
    }

    setProgress(stages.length);
    setGenerating(false);
    setStep("done");
  }, [outline, packagePath, stageDetails]);

  // ─── Render ───
  return (
    <div style={{ padding: "var(--s6)", maxWidth: 800, margin: "0 auto" }}>

      {/* ─── Step: Input ─── */}
      {step === "input" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s4)" }}>
          <h2 style={{ margin: 0 }}>描述你的故事</h2>
          <div>
            <label style={{ fontWeight: 600, fontSize: 12, display: "block", marginBottom: 4 }}>故事描述 *</label>
            <textarea className="input" rows={5} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="描述你想要的故事，越详细越好。如：虚竹得知丁春秋欺师灭祖，在乔峰段誉陪同下前往星宿海清理门户..." />
          </div>
          <div>
            <label style={{ fontWeight: 600, fontSize: 12, display: "block", marginBottom: 4 }}>风格提示词</label>
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

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <label style={{ fontWeight: 600, fontSize: 12 }}>角色（可选）</label>
              <button className="btn btn-xs" onClick={() => setCharacters([...characters, { name: "", role: "" }])}>+ 添加</button>
            </div>
            {characters.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: "var(--s1)", marginBottom: 4 }}>
                <input className="input" style={{ flex: 1 }} value={c.name} placeholder="角色名"
                  onChange={e => { const arr = [...characters]; arr[i] = { ...arr[i], name: e.target.value }; setCharacters(arr); }} />
                <input className="input" style={{ flex: 1 }} value={c.role} placeholder="定位（主角/辅助/反派）"
                  onChange={e => { const arr = [...characters]; arr[i] = { ...arr[i], role: e.target.value }; setCharacters(arr); }} />
                <button className="btn btn-xs" onClick={() => setCharacters(characters.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
          </div>

          {outlineError && <div style={{ color: "var(--danger)", fontSize: 12, padding: "var(--s2)", background: "var(--danger-bg)", borderRadius: "var(--r-sm)" }}>❌ {outlineError}</div>}

          <div style={{ display: "flex", gap: "var(--s2)" }}>
            <button className="btn" onClick={onBack}>← 返回首页</button>
            <button className="btn btn-primary" onClick={handleGenerateOutline} disabled={!description.trim() || outlineLoading} style={{ flex: 1 }}>
              {outlineLoading ? "⏳ 生成大纲中..." : "生成大纲 →"}
            </button>
          </div>
        </div>
      )}

      {/* ─── Step: Outline ─── */}
      {step === "outline" && outline && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s4)" }}>
          <h2 style={{ margin: 0 }}>确认故事大纲</h2>

          <div style={{ background: "var(--surface)", borderRadius: "var(--r-md)", padding: "var(--s4)" }}>
            <div style={{ display: "flex", gap: "var(--s2)", marginBottom: "var(--s3)" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-faint)" }}>标题</label>
                <input className="input" value={outline.title} onChange={e => setOutline({ ...outline, title: e.target.value })} />
              </div>
            </div>
            <div style={{ marginBottom: "var(--s2)" }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-faint)" }}>前提</label>
              <input className="input" value={outline.premise} onChange={e => setOutline({ ...outline, premise: e.target.value })} />
            </div>
            <div style={{ fontSize: 11 }}>
              <b>角色：</b>{outline.characters.map(c => `${c.name}(${c.role})`).join("、")}
            </div>
          </div>

          <div style={{ border: "1px solid var(--border-light)", borderRadius: "var(--r-md)", padding: "var(--s3)", maxHeight: 400, overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--s2)" }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>阶段列表 ({outline.stages.length})</span>
              <button className="btn btn-xs" onClick={() => {
                const newId = `stage_${String(outline.stages.length + 1).padStart(3, "0")}`;
                setOutline({ ...outline, stages: [...outline.stages, { id: newId, title: "新阶段", description: "", stageType: "serving", enterWhen: "", sortKey: outline.stages.length }] });
              }}>+ 添加阶段</button>
            </div>
            {outline.stages.map((s, i) => (
              <div key={s.id} style={{ fontSize: 11, padding: "6px 0", display: "flex", gap: "var(--s1)", alignItems: "center", borderBottom: "1px solid var(--border-light)" }}>
                <span style={{ color: "var(--text-faint)", width: 65, flexShrink: 0, fontSize: 9 }}>[{s.stageType}]</span>
                <input className="input" style={{ flex: 1, padding: "2px 6px", fontSize: 11 }} value={s.title}
                  onChange={e => { const stages = [...outline.stages]; stages[i] = { ...stages[i], title: e.target.value }; setOutline({ ...outline, stages }); }} />
                <select style={{ fontSize: 9, padding: "2px", border: "1px solid var(--border-light)", borderRadius: 3 }} value={s.stageType}
                  onChange={e => { const stages = [...outline.stages]; stages[i] = { ...stages[i], stageType: e.target.value }; setOutline({ ...outline, stages }); }}>
                  <option value="training">training</option>
                  <option value="serving">serving</option>
                  <option value="punishment">punishment</option>
                  <option value="choice">choice</option>
                  <option value="event">event</option>
                  <option value="daily">daily</option>
                </select>
                <button className="btn btn-ghost btn-xs" style={{ color: "var(--danger)" }}
                  onClick={() => setOutline({ ...outline, stages: outline.stages.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "var(--s2)" }}>
            <button className="btn" onClick={() => setStep("input")}>← 返回修改</button>
            <button className="btn btn-primary" onClick={handleGenerateDetails} style={{ flex: 1 }}>
              确认，开始生成详细内容 →
            </button>
          </div>
        </div>
      )}

      {/* ─── Step: Generating ─── */}
      {step === "generating" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s4)" }}>
          <h2 style={{ margin: 0 }}>
            {generating ? "⏳ 正在生成..." : "生成暂停"}
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-faint)" }}>
            每个阶段生成后立即保存到磁盘，关闭页面不会丢失已生成的内容。
          </p>

          {/* Progress bar */}
          <div>
            <div style={{ background: "var(--border-light)", borderRadius: 4, height: 10, overflow: "hidden" }}>
              <div style={{ background: "var(--primary)", height: "100%", width: `${total > 0 ? (progress / total) * 100 : 0}%`, transition: "width 0.3s" }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>
              {progress}/{total} 阶段 {currentStage && `· 当前：${currentStage}`}
            </div>
          </div>

          {/* Stage list */}
          <div style={{ maxHeight: 400, overflow: "auto", border: "1px solid var(--border-light)", borderRadius: "var(--r-md)", padding: "var(--s2)" }}>
            {outline?.stages.map((s, i) => {
              const detail = stageDetails[s.id];
              const status = detail?.guidance ? "done" : i === progress && generating ? "active" : "pending";
              return (
                <div key={s.id} style={{ padding: "4px 8px", fontSize: 11, display: "flex", gap: "var(--s2)", alignItems: "flex-start" }}>
                  <span style={{ width: 20 }}>
                    {status === "done" ? "✅" : status === "active" ? "🔄" : "⏳"}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: status === "done" ? 400 : 600 }}>{s.title}</div>
                    {detail?.guidance && (
                      <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2, maxHeight: 40, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {detail.guidance.slice(0, 100)}...
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {genError && <div style={{ color: "var(--danger)", fontSize: 12 }}>❌ {genError}</div>}

          <div style={{ display: "flex", gap: "var(--s2)" }}>
            {!generating && progress < total && (
              <button className="btn btn-primary" onClick={handleGenerateDetails} style={{ flex: 1 }}>
                ▶ 继续生成（从第 {progress + 1} 阶段）
              </button>
            )}
            {!generating && (
              <button className="btn" onClick={() => { if (packagePath) onComplete(packagePath); else onBack(); }}>
                {packagePath ? "打开编辑器" : "返回首页"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Step: Done ─── */}
      {step === "done" && (
        <div style={{ textAlign: "center", padding: "var(--s8) 0" }}>
          <div style={{ fontSize: 64, marginBottom: "var(--s4)" }}>🎉</div>
          <h2>故事包创建完成！</h2>
          <p style={{ color: "var(--text-faint)" }}>
            {outline?.title} · {outline?.stages.length} 个阶段 · {outline?.characters.length} 个角色
          </p>
          <div style={{ display: "flex", gap: "var(--s2)", justifyContent: "center", marginTop: "var(--s4)" }}>
            <button className="btn btn-primary" onClick={() => onComplete(packagePath)}>
              打开编辑器
            </button>
            <button className="btn" onClick={onBack}>返回首页</button>
          </div>
        </div>
      )}
    </div>
  );
}
