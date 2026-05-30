import { useState } from "react";
import * as api from "../../lib/api.js";
import type { FlowAIContext, FlowAnalysisReport } from "../../lib/api.js";
import { useEditorStore } from "../../store/editorStore.js";

interface Props {
  visible: boolean;
  onClose: () => void;
  buildContext: () => FlowAIContext;
  selectedModuleId: string | null;
  onScenarioGenerated?: (scenario: unknown) => void;
  onStageRefined?: (moduleId: string, stageDetail: unknown) => void;
}

type LoadingState = null | "analyze" | "generate" | "refine";

export function FlowAIPanel({ visible, onClose, buildContext, selectedModuleId, onScenarioGenerated, onStageRefined }: Props) {
  const [loading, setLoading] = useState<LoadingState>(null);
  const [result, setResult] = useState<{ type: string; rawText: string; data: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"full" | "incremental">("incremental");
  const [instruction, setInstruction] = useState("");

  if (!visible) return null;

  // ─── Handlers ───

  async function handleAnalyze() {
    setLoading("analyze");
    setError(null);
    setResult(null);
    try {
      const ctx = buildContext();
      const r = await api.analyzeFlow(ctx);
      if (r.ok && r.report) {
        setResult({
          type: "analyze",
          rawText: r.report.summary,
          data: r.report,
        });
      } else {
        setError((r as any).error || "分析失败");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function handleGenerate() {
    setLoading("generate");
    setError(null);
    setResult(null);
    try {
      const ctx = buildContext();
      const r = await api.generateScenario(ctx, { mode });
      if (r.ok && r.result) {
        setResult({
          type: "generate",
          rawText: r.result.rawText,
          data: r.result.scenario,
        });
      } else {
        setError((r as any).error || "生成失败");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function handleRefine() {
    if (!selectedModuleId || !instruction.trim()) return;
    setLoading("refine");
    setError(null);
    setResult(null);
    try {
      const ctx = buildContext();
      const r = await api.refineStage(ctx, selectedModuleId, instruction);
      if (r.ok && r.result) {
        setResult({
          type: "refine",
          rawText: r.result.rawText,
          data: r.result.stageDetail,
        });
        onStageRefined?.(selectedModuleId, r.result.stageDetail);
      } else {
        setError((r as any).error || "精修失败");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  function handleApplyScenario() {
    if (result?.data) {
      onScenarioGenerated?.(result.data);
      setResult(null);
    }
  }

  // ─── Render helpers ───

  function renderAnalysisReport(report: FlowAnalysisReport) {
    return (
      <div>
        <p className="muted mb3">{report.summary}</p>
        {report.issues.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s3)" }}>
            {report.issues.map((iss, i) => (
              <div key={i} style={{
                padding: "var(--s3)", borderRadius: "var(--r-md)",
                background: iss.severity === "error" ? "var(--danger-bg)" : iss.severity === "warn" ? "var(--warning-bg)" : "var(--info-bg)",
                border: `1px solid ${iss.severity === "error" ? "var(--danger-border)" : iss.severity === "warn" ? "rgba(210,153,29,0.25)" : "rgba(88,166,255,0.2)"}`,
              }}>
                <div style={{ fontWeight: 600, fontSize: "var(--fs-sm)", marginBottom: 4, display: "flex", gap: "var(--s1)", alignItems: "center" }}>
                  <span>{iss.severity === "error" ? "❌" : iss.severity === "warn" ? "⚠️" : "ℹ️"}</span>
                  {iss.title}
                  <span className="tag tag-gray" style={{ fontSize: 9 }}>{iss.category}</span>
                </div>
                <p style={{ fontSize: "var(--fs-sm)", color: "var(--text2)", margin: "4px 0" }}>{iss.description}</p>
                {iss.affectedModules.length > 0 && (
                  <p className="faint" style={{ margin: "2px 0" }}>涉及模块：{iss.affectedModules.join(", ")}</p>
                )}
                <p style={{ fontSize: "var(--fs-sm)", color: "var(--cat-green)", margin: "4px 0 0 0" }}>💡 {iss.suggestion}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">AI 未发现明显问题。</p>
        )}
      </div>
    );
  }

  function renderScenarioPreview(scenario: any) {
    const stageCount = scenario?.stages?.length || 0;
    const detailCount = scenario?.stageDetails?.length || 0;
    return (
      <div>
        <div className="flex-between mb3">
          <span>ID: <span className="mono">{scenario?.id || "?"}</span></span>
          <span>{stageCount} 阶段，{detailCount} 详情</span>
        </div>
        <p className="muted mb2">标题：{scenario?.title || "?"}</p>
        {scenario?.premise && <p className="muted mb3" style={{ fontStyle: "italic" }}>前提：{scenario.premise}</p>}
        <div className="section-title mb2">阶段详情预览（前10个）</div>
        <div style={{ maxHeight: 300, overflow: "auto", display: "flex", flexDirection: "column", gap: "var(--s2)" }}>
          {(scenario?.stageDetails || []).slice(0, 10).map((d: any, i: number) => (
            <div key={i} style={{ padding: "var(--s2)", background: "var(--bg)", borderRadius: "var(--r-sm)", fontSize: "var(--fs-sm)" }}>
              <div style={{ fontWeight: 600 }}>{d.id}: {d.title || "无标题"}</div>
              <div className="faint">{d.description?.slice(0, 80)}{d.description?.length > 80 ? "..." : ""}</div>
              <div style={{ marginTop: 2 }}>
                <span className="tag tag-green" style={{ fontSize: 9 }}>enterWhen</span>
                <span className="faint" style={{ marginLeft: 4 }}>{d.enterWhen?.slice(0, 60) || "?"}</span>
              </div>
            </div>
          ))}
          {(scenario?.stageDetails || []).length > 10 && (
            <p className="faint" style={{ textAlign: "center" }}>... 还有 {(scenario.stageDetails.length - 10)} 个阶段</p>
          )}
        </div>
      </div>
    );
  }

  function renderRefineResult(data: any) {
    return (
      <div style={{
        padding: "var(--s3)", background: "var(--bg)", borderRadius: "var(--r-md)",
        border: "1px solid var(--border-light)", fontSize: "var(--fs-sm)",
      }}>
        <div className="kv-row"><span className="kv-key faint">ID</span><span className="kv-val mono">{data.id}</span></div>
        <div className="kv-row"><span className="kv-key faint">标题</span><span className="kv-val">{data.title || "?"}</span></div>
        <div className="kv-row"><span className="kv-key faint">描述</span><span className="kv-val">{data.description?.slice(0, 120) || "?"}</span></div>
        <div className="kv-row"><span className="kv-key faint">enterWhen</span><span className="kv-val">{data.enterWhen?.slice(0, 120) || "?"}</span></div>
        <div className="kv-row"><span className="kv-key faint">guidance</span><span className="kv-val" style={{ whiteSpace: "pre-wrap" }}>{data.guidance?.slice(0, 300) || "?"}</span></div>
        <div className="kv-row"><span className="kv-key faint">directive</span><span className="kv-val" style={{ whiteSpace: "pre-wrap" }}>{data.directive?.slice(0, 300) || "?"}</span></div>
      </div>
    );
  }

  // ─── Main render ───

  return (
    <div style={{
      width: 360, flexShrink: 0, background: "var(--bg2)",
      borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "var(--s3) var(--s4)", borderBottom: "1px solid var(--border-light)",
        flexShrink: 0,
      }}>
        <div className="flex-center gap3">
          <span style={{ fontSize: 16 }}>🤖</span>
          <h3 style={{ fontSize: "var(--fs-md)", fontWeight: 600, margin: 0 }}>AI 流程助手</h3>
        </div>
        <button className="btn btn-ghost btn-xs" onClick={onClose}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "var(--s4)", display: "flex", flexDirection: "column", gap: "var(--s3)" }}>
        {/* ═══ Card 1: Analyze ═══ */}
        <div className="card">
          <div className="card-header">
            <h4 style={{ margin: 0 }}>📊 全貌分析</h4>
          </div>
          <p className="faint mb2" style={{ marginTop: "var(--s2)" }}>检查连接断裂、动机缺失、节奏问题、角色缺口</p>
          <button
            className="btn btn-primary"
            style={{ width: "100%", fontSize: "var(--fs-sm)" }}
            onClick={handleAnalyze}
            disabled={loading !== null}
          >
            {loading === "analyze" ? "分析中..." : "分析流程逻辑"}
          </button>
        </div>

        {/* ═══ Card 2: Generate ═══ */}
        <div className="card">
          <div className="card-header">
            <h4 style={{ margin: 0 }}>📝 批量生成</h4>
          </div>
          <div style={{ marginTop: "var(--s2)", display: "flex", gap: "var(--s1)", marginBottom: "var(--s2)" }}>
            <select className="input" style={{ fontSize: "var(--fs-sm)", padding: "4px 8px", flex: 1 }}
              value={mode} onChange={(e) => setMode(e.target.value as "full" | "incremental")}>
              <option value="incremental">增量更新（保留已有好的）</option>
              <option value="full">完全重写（忽略已有）</option>
            </select>
          </div>
          <button
            className="btn"
            style={{ width: "100%", fontSize: "var(--fs-sm)", background: "var(--cat-purple)", borderColor: "var(--cat-purple)", color: "#fff" }}
            onClick={handleGenerate}
            disabled={loading !== null}
          >
            {loading === "generate" ? "生成中..." : "生成剧情阶段"}
          </button>
        </div>

        {/* ═══ Card 3: Refine ═══ */}
        <div className="card">
          <div className="card-header">
            <h4 style={{ margin: 0 }}>✏️ 逐块精修</h4>
          </div>
          <div style={{ marginTop: "var(--s2)" }}>
            {selectedModuleId ? (
              <>
                <p className="faint mb2">选中模块：<span className="mono" style={{ color: "var(--cat-blue)" }}>{selectedModuleId}</span></p>
                <textarea
                  className="input"
                  rows={2}
                  style={{ fontSize: "var(--fs-sm)", marginBottom: "var(--s2)" }}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="如：让 guidance 更煽情，加入羞辱元素..."
                />
                <button
                  className="btn"
                  style={{ width: "100%", fontSize: "var(--fs-sm)", background: "var(--cat-orange)", borderColor: "var(--cat-orange)", color: "#fff" }}
                  onClick={handleRefine}
                  disabled={loading !== null || !instruction.trim()}
                >
                  {loading === "refine" ? "精修中..." : "重写此阶段"}
                </button>
              </>
            ) : (
              <p className="faint" style={{ textAlign: "center" }}>在流程图中选中一个模块后<br />即可逐块精修</p>
            )}
          </div>
        </div>

        {/* ═══ Error ═══ */}
        {error && (
          <div className="error-banner" style={{ borderRadius: "var(--r-md)", padding: "var(--s2) var(--s3)" }}>
            <span style={{ fontSize: "var(--fs-sm)" }}>{error}</span>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}>✕</button>
          </div>
        )}

        {/* ═══ Result ═══ */}
        {result && (
          <div style={{ borderTop: "2px solid var(--accent)", paddingTop: "var(--s3)" }}>
            <div className="flex-between mb3">
              <span className="section-title" style={{ padding: 0, fontSize: "var(--fs-sm)" }}>
                {result.type === "analyze" ? "📊 分析报告" : result.type === "generate" ? "📝 生成预览" : "✏️ 精修结果"}
              </span>
              <button className="btn btn-ghost btn-xs" onClick={() => setResult(null)}>清除</button>
            </div>

            <div style={{ maxHeight: 400, overflow: "auto" }}>
              {result.type === "analyze" && renderAnalysisReport(result.data as FlowAnalysisReport)}
              {result.type === "generate" && renderScenarioPreview(result.data)}
              {result.type === "refine" && renderRefineResult(result.data)}
            </div>

            {/* Raw text expand */}
            {result.rawText && (
              <details style={{ marginTop: "var(--s3)" }}>
                <summary className="faint" style={{ cursor: "pointer", fontSize: "var(--fs-xs)" }}>查看 AI 原始输出</summary>
                <pre className="json-preview" style={{ maxHeight: 200, marginTop: "var(--s2)", fontSize: 10 }}>
                  {result.rawText}
                </pre>
              </details>
            )}

            {/* Apply button for scenario */}
            {result.type === "generate" && (
              <button
                className="btn btn-success"
                style={{ width: "100%", marginTop: "var(--s3)", fontSize: "var(--fs-sm)" }}
                onClick={handleApplyScenario}
              >
                ✅ 应用此 scenario（将替换当前剧情阶段）
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
