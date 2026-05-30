/**
 * AI Create Tab — 在当前故事包内用 AI 生成/填充内容
 * 
 * 流程：
 * 1. 用户输入描述 → AI 生成大纲
 * 2. 用户确认/编辑大纲 → 大纲立即写入当前包的 scenario.json + modules.json
 * 3. 逐阶段生成详情 → 每完成一个立即写入磁盘
 * 4. 用户可随时退出，下次进来看到已完成的进度，继续生成
 */
import { useState, useCallback, useEffect } from "react";
import { useEditorStore } from "../store/editorStore.js";

interface StageDetail { guidance: string; directive: string }

type Step = "input" | "outline" | "generating";

export function AiCreateTab() {
  const { storyPackage, storyDir, reload } = useEditorStore();

  const [step, setStep] = useState<Step>("input");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("");
  const [stageCount, setStageCount] = useState(18);
  const [branchCount, setBranchCount] = useState(3);

  // Outline
  const [outline, setOutline] = useState<any>(null);
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [outlineError, setOutlineError] = useState("");

  // Generation progress
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentStage, setCurrentStage] = useState("");
  const [completedStages, setCompletedStages] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  // On mount: check if current package already has stages with empty guidance (= can continue)
  const stageDetails = (storyPackage?.scenario?.stageDetails || []) as any[];
  const filledStages = stageDetails.filter((s: any) => s.guidance);
  const emptyStages = stageDetails.filter((s: any) => !s.guidance);

  // Auto-detect: if we have stages but some are empty, show "continue" mode
  useEffect(() => {
    if (stageDetails.length > 0 && emptyStages.length > 0 && filledStages.length > 0) {
      setStep("generating");
      setTotal(stageDetails.length);
      setProgress(filledStages.length);
      setCompletedStages(new Set(filledStages.map((s: any) => s.id)));
    }
  }, []);

  // ─── Step 1: Generate Outline ───
  const handleGenerateOutline = useCallback(async () => {
    setOutlineLoading(true);
    setOutlineError("");
    try {
      const res = await fetch("/api/editor/ai/generate-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description || storyPackage?.scenario?.premise || storyPackage?.title || "",
          style, stageCount, branchCount,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "大纲生成失败");
      setOutline(data.outline);
      setStep("outline");
    } catch (err) {
      setOutlineError((err as Error).message);
    } finally {
      setOutlineLoading(false);
    }
  }, [description, style, stageCount, branchCount, storyPackage]);

  // ─── Step 2: Confirm outline → write to current package ───
  const handleConfirmOutline = useCallback(async () => {
    if (!outline || !storyDir) return;
    setStep("generating");
    setError("");

    try {
      // Write outline to current package via update-stage API (creates scenario + modules)
      const res = await fetch("/api/editor/ai/create-package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outline, stageDetails: {}, targetPath: storyDir }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "写入大纲失败");

      // Reload editor to pick up new scenario/modules
      await reload();

      // Set up generation state
      setTotal(outline.stages.length);
      setProgress(0);
      setCompletedStages(new Set());

      // Start generating details
      await generateAllDetails(outline);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [outline, storyDir, reload]);

  // ─── Step 3: Generate details for all/remaining stages ───
  const generateAllDetails = useCallback(async (outlineData?: any) => {
    const ol = outlineData || buildOutlineFromCurrentPackage();
    if (!ol || !storyDir) return;

    setGenerating(true);
    setError("");

    const stages = ol.stages || [];
    setTotal(stages.length);

    let prevGuidance: string | undefined;
    const done = new Set(completedStages);

    // Find last completed stage's guidance for context
    for (let i = stages.length - 1; i >= 0; i--) {
      if (done.has(stages[i].id)) {
        const sd = stageDetails.find((s: any) => s.id === stages[i].id);
        if (sd?.guidance) { prevGuidance = sd.guidance; break; }
      }
    }

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      if (done.has(stage.id)) continue; // Skip already done

      setCurrentStage(stage.title);
      setProgress(done.size);

      try {
        const res = await fetch("/api/editor/ai/generate-stage-detail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outline: ol, stageId: stage.id, previousGuidance: prevGuidance }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        prevGuidance = data.detail.guidance;

        // Save to disk immediately
        await fetch("/api/editor/ai/update-stage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packagePath: storyDir, stageId: stage.id, guidance: data.detail.guidance, directive: data.detail.directive }),
        });

        done.add(stage.id);
        setCompletedStages(new Set(done));
        setProgress(done.size);
      } catch (err) {
        // Retry once
        try {
          const res = await fetch("/api/editor/ai/generate-stage-detail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ outline: ol, stageId: stage.id, previousGuidance: prevGuidance }),
          });
          const data = await res.json();
          if (data.ok) {
            prevGuidance = data.detail.guidance;
            await fetch("/api/editor/ai/update-stage", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ packagePath: storyDir, stageId: stage.id, guidance: data.detail.guidance, directive: data.detail.directive }),
            });
            done.add(stage.id);
            setCompletedStages(new Set(done));
            setProgress(done.size);
          }
        } catch { /* skip this stage */ }
      }
    }

    setProgress(stages.length);
    setGenerating(false);
    // Reload to show updated data in other tabs
    await reload();
  }, [storyDir, completedStages, stageDetails, reload]);

  // Build outline from current package data (for "continue" mode)
  function buildOutlineFromCurrentPackage() {
    if (!storyPackage) return null;
    return {
      title: storyPackage.title || "",
      premise: storyPackage.scenario?.premise || "",
      setting: "",
      characters: (storyPackage.characters || []).map((c: any) => ({ id: c.id, name: c.name, role: c.role, description: "" })),
      stages: stageDetails.map((s: any) => ({ id: s.id, title: s.title, description: s.description || "", stageType: s.stageType || "training", enterWhen: s.enterWhen || "", sortKey: s.sortKey || 0 })),
      flow: { mainLine: storyPackage.scenario?.stages || [], finale: [] },
    };
  }

  // ─── Render ───
  return (
    <div style={{ padding: "var(--s4)", maxWidth: 800, overflow: "auto", height: "100%" }}>
      <h3 style={{ margin: "0 0 var(--s3)" }}>🤖 AI 创作助手</h3>

      {/* Status bar */}
      <div style={{ background: "var(--surface)", borderRadius: "var(--r-md)", padding: "var(--s3)", marginBottom: "var(--s4)", display: "flex", gap: "var(--s4)", fontSize: 12 }}>
        <span>总阶段：<b>{stageDetails.length}</b></span>
        <span style={{ color: "var(--cat-green)" }}>已填充：<b>{filledStages.length}</b></span>
        <span style={{ color: "var(--cat-orange)" }}>待填充：<b>{emptyStages.length}</b></span>
      </div>

      {/* ─── Step: Input ─── */}
      {step === "input" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s3)" }}>
          <div style={{ background: "var(--surface)", borderRadius: "var(--r-md)", padding: "var(--s4)" }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: "var(--s3)" }}>从描述生成故事大纲</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s2)" }}>
              <textarea className="input" rows={4} value={description} onChange={e => setDescription(e.target.value)}
                placeholder={storyPackage?.scenario?.premise || "输入故事描述，越详细越好..."} />
              <input className="input" value={style} onChange={e => setStyle(e.target.value)}
                placeholder="风格提示词（可选，如：武侠金庸风格、注重兄弟情义）" />
              <div style={{ display: "flex", gap: "var(--s2)" }}>
                <div>
                  <label style={{ fontSize: 10, color: "var(--text-faint)" }}>阶段数</label>
                  <input className="input" type="number" min={6} max={40} value={stageCount} onChange={e => setStageCount(Number(e.target.value))} style={{ width: 70 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "var(--text-faint)" }}>分支数</label>
                  <input className="input" type="number" min={0} max={5} value={branchCount} onChange={e => setBranchCount(Number(e.target.value))} style={{ width: 70 }} />
                </div>
                <button className="btn btn-primary" onClick={handleGenerateOutline} disabled={outlineLoading} style={{ flex: 1, marginTop: 14 }}>
                  {outlineLoading ? "⏳ 生成大纲中..." : "生成大纲 →"}
                </button>
              </div>
            </div>
            {outlineError && <div style={{ color: "var(--danger)", fontSize: 11, marginTop: "var(--s2)" }}>❌ {outlineError}</div>}
          </div>

          {/* Quick action: fill empty stages */}
          {emptyStages.length > 0 && (
            <div style={{ background: "var(--surface)", borderRadius: "var(--r-md)", padding: "var(--s3)" }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: "var(--s2)" }}>快速补全</div>
              <p style={{ fontSize: 11, color: "var(--text-faint)", margin: "0 0 var(--s2)" }}>
                有 {emptyStages.length} 个阶段缺少 guidance，点击下方按钮继续生成。
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => { setStep("generating"); generateAllDetails(); }}>
                ▶ 继续生成 {emptyStages.length} 个空阶段
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Step: Outline Preview ─── */}
      {step === "outline" && outline && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s3)" }}>
          <div style={{ background: "var(--surface)", borderRadius: "var(--r-md)", padding: "var(--s4)" }}>
            <div style={{ display: "flex", gap: "var(--s2)", marginBottom: "var(--s2)" }}>
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
              <b>角色：</b>{outline.characters?.map((c: any) => `${c.name}(${c.role})`).join("、") || "无"}
            </div>
          </div>

          <div style={{ border: "1px solid var(--border-light)", borderRadius: "var(--r-md)", padding: "var(--s3)", maxHeight: 350, overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--s2)" }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>阶段列表 ({outline.stages?.length || 0})</span>
              <button className="btn btn-xs" onClick={() => {
                const newId = `stage_${String((outline.stages?.length || 0) + 1).padStart(3, "0")}`;
                setOutline({ ...outline, stages: [...(outline.stages || []), { id: newId, title: "新阶段", description: "", stageType: "serving", enterWhen: "", sortKey: (outline.stages?.length || 0) }] });
              }}>+ 添加</button>
            </div>
            {(outline.stages || []).map((s: any, i: number) => (
              <div key={s.id} style={{ fontSize: 11, padding: "4px 0", display: "flex", gap: "var(--s1)", alignItems: "center", borderBottom: "1px solid var(--border-light)" }}>
                <span style={{ color: "var(--text-faint)", width: 60, flexShrink: 0, fontSize: 9 }}>[{s.stageType}]</span>
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
                  onClick={() => setOutline({ ...outline, stages: outline.stages.filter((_: any, j: number) => j !== i) })}>✕</button>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "var(--s2)" }}>
            <button className="btn" onClick={() => setStep("input")}>← 返回修改</button>
            <button className="btn btn-primary" onClick={handleConfirmOutline} style={{ flex: 1 }}>
              ✅ 确认大纲，开始逐条生成
            </button>
          </div>
        </div>
      )}

      {/* ─── Step: Generating ─── */}
      {step === "generating" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s3)" }}>
          <div style={{ background: "var(--surface)", borderRadius: "var(--r-md)", padding: "var(--s3)" }}>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: "var(--s2)" }}>
              {generating ? "⏳ 正在生成..." : progress >= total && total > 0 ? "✅ 全部完成" : "⏸ 已暂停"}
            </div>
            <div style={{ background: "var(--border-light)", borderRadius: 4, height: 8, overflow: "hidden", marginBottom: "var(--s2)" }}>
              <div style={{ background: "var(--primary)", height: "100%", width: `${total > 0 ? (progress / total) * 100 : 0}%`, transition: "width 0.3s" }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
              {progress}/{total} 阶段已完成
              {generating && currentStage && ` · 当前：${currentStage}`}
            </div>
          </div>

          {/* Stage list with status */}
          <div style={{ maxHeight: 400, overflow: "auto", border: "1px solid var(--border-light)", borderRadius: "var(--r-md)", padding: "var(--s2)" }}>
            {stageDetails.map((s: any, i: number) => {
              const isDone = !!s.guidance || completedStages.has(s.id);
              const isActive = generating && currentStage === s.title;
              return (
                <div key={s.id} style={{ padding: "4px 8px", fontSize: 11, display: "flex", gap: "var(--s2)", alignItems: "flex-start", opacity: isDone ? 0.7 : 1 }}>
                  <span style={{ width: 18, flexShrink: 0 }}>
                    {isDone ? "✅" : isActive ? "🔄" : "⏳"}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: isActive ? 700 : 400 }}>{s.title}</div>
                    {isDone && s.guidance && (
                      <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2, maxHeight: 30, overflow: "hidden" }}>
                        {s.guidance.slice(0, 80)}...
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {error && <div style={{ color: "var(--danger)", fontSize: 11 }}>❌ {error}</div>}

          {/* Actions */}
          {!generating && (
            <div style={{ display: "flex", gap: "var(--s2)" }}>
              {progress < total && (
                <button className="btn btn-primary" onClick={() => generateAllDetails()} style={{ flex: 1 }}>
                  ▶ 继续生成（从第 {progress + 1} 阶段）
                </button>
              )}
              <button className="btn" onClick={() => { setStep("input"); reload(); }}>
                {progress >= total ? "✅ 完成，返回" : "← 返回"}
              </button>
            </div>
          )}

          {progress >= total && total > 0 && !generating && (
            <div style={{ fontSize: 11, color: "var(--cat-green)", textAlign: "center" }}>
              🎉 所有阶段已生成完毕！切换到「流程编辑」tab 查看结果。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
