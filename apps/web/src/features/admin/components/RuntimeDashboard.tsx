import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare, Timer, Coins, Users, ShieldCheck, GitBranch,
  RotateCcw, Trash2, ChevronRight, ChevronDown, ArrowUp, ArrowDown,
  Swords, Info, BarChart3, Copy, Check, Filter,
} from "lucide-react";
import type { RuntimeTurnRecord, RuntimeStatsAggregate } from "@story-game/shared";
import { fetchRuntimeRecords, fetchRuntimeAggregates, fetchSessionSummaries, clearRuntimeStats, type SessionSummary } from "../../../lib/runtimeStatsApi.js";

type DetailTab = "prompt" | "response" | "operations" | "meta";

export function RuntimeDashboard() {
  const [records, setRecords] = useState<RuntimeTurnRecord[]>([]);
  const [aggregates, setAggregates] = useState<RuntimeStatsAggregate | null>(null);
  const [sessionSummaries, setSessionSummaries] = useState<SessionSummary[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sessionFilter, setSessionFilter] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("prompt");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [recData, aggData, sumData] = await Promise.all([
        fetchRuntimeRecords(50, sessionFilter || undefined),
        fetchRuntimeAggregates(sessionFilter || undefined),
        fetchSessionSummaries(),
      ]);
      setRecords(recData.records);
      setAggregates(aggData.aggregates);
      setSessionSummaries(sumData.sessions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load runtime stats");
    } finally {
      setLoading(false);
    }
  }, [sessionFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => { void load(); }, 5000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, load]);

  const handleClear = () => {
    if (!window.confirm("确定要清空所有运行时记录吗？此操作不可撤销。")) return;
    clearRuntimeStats().then(() => load()).catch((err) => setError(err.message));
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    }).catch(() => {});
  };

  const toggleRow = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setActiveTab("prompt");
  };

  const sessionLabel = (s: SessionSummary) =>
    `${fmtDate(s.startedAt)} ${fmtTime(s.startedAt)} · ${s.turnCount}回合 · ${s.speakers}`;

  const expanded = records.find((r) => r.id === expandedId);

  if (loading) {
    return (
      <section className="editor-page">
        <header className="editor-header">
          <div>
            <p className="editor-eyebrow">RUNTIME MONITOR</p>
            <h1 className="editor-title">运行时统计</h1>
          </div>
        </header>
        <div className="runtime-cards">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="runtime-card runtime-skeleton">
              <div className="skeleton-icon" />
              <div className="skeleton-value" />
              <div className="skeleton-label" />
            </div>
          ))}
        </div>
        <div className="runtime-list">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="runtime-row runtime-skeleton-row">
              <div className="skeleton-line" style={{ width: "60%" }} />
              <div className="skeleton-line" style={{ width: "40%" }} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="editor-page">
      <header className="editor-header">
        <div>
          <p className="editor-eyebrow">RUNTIME MONITOR</p>
          <h1 className="editor-title">运行时统计</h1>
        </div>
        <div className="editor-header-actions" style={{ flexWrap: "wrap" }}>
          <div className="runtime-filter">
            <Filter size={14} />
            <select
              value={sessionFilter}
              onChange={(e) => { setSessionFilter(e.target.value); setLoading(true); }}
            >
              <option value="">全部会话</option>
              {sessionSummaries.map((s) => (
                <option key={s.sessionId} value={s.sessionId}>{sessionLabel(s)}</option>
              ))}
            </select>
          </div>
          <label className="runtime-toggle-label">
            <div className={`runtime-toggle ${autoRefresh ? "on" : "off"}`}>
              <div className="runtime-toggle-dot" />
            </div>
            <span>自动刷新</span>
          </label>
          <button className="btn-secondary" onClick={() => { void load(); }} style={{ minHeight: 36, fontSize: "0.82rem" }}>
            <RotateCcw size={16} /> 刷新
          </button>
          <button className="btn-danger" onClick={handleClear} style={{ minHeight: 36, fontSize: "0.82rem" }}>
            <Trash2 size={16} /> 清空
          </button>
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}

      {aggregates && aggregates.totalTurns > 0 ? (
        <>
          <div className="runtime-cards">
            <div className="runtime-card">
              <MessageSquare size={20} className="runtime-card-icon" />
              <div className="runtime-card-value">{aggregates.totalTurns}</div>
              <div className="runtime-card-label">总回合</div>
            </div>
            <div className="runtime-card">
              <Timer size={20} className="runtime-card-icon" />
              <div className="runtime-card-value">{aggregates.avgLatencyMs}ms</div>
              <div className="runtime-card-label">平均延迟</div>
            </div>
            <div className="runtime-card">
              <Coins size={20} className="runtime-card-icon" />
              <div className="runtime-card-value">
                <span className="runtime-card-token-input">{fmtNum(aggregates.totalPromptTokens)}</span>
                {" / "}
                <span className="runtime-card-token-output">{fmtNum(aggregates.totalCompletionTokens)}</span>
              </div>
              <div className="runtime-card-label">输入 / 输出 Token</div>
            </div>
            <div className="runtime-card">
              <Users size={20} className="runtime-card-icon" />
              <div className="runtime-card-value">{aggregates.totalSessions}</div>
              <div className="runtime-card-label">个会话</div>
            </div>
            <div className={`runtime-card ${aggregates.validationFailCount > 0 ? "warning" : ""}`}>
              <ShieldCheck size={20} className="runtime-card-icon" />
              <div className="runtime-card-value">
                <span className="pass">{aggregates.validationPassCount}</span>
                {aggregates.validationFailCount > 0 && (
                  <span className="fail"> / {aggregates.validationFailCount} 失败</span>
                )}
              </div>
              <div className="runtime-card-label">通过率</div>
            </div>
            <div className="runtime-card">
              <GitBranch size={20} className="runtime-card-icon" />
              <div className="runtime-card-value">{aggregates.stageChanges}</div>
              <div className="runtime-card-label">次阶段推进</div>
            </div>
          </div>

          <div className="runtime-toolbar">
            <span className="runtime-toolbar-title">最近回合记录</span>
            <span className="runtime-toolbar-count">共 {aggregates.totalTurns} 条</span>
          </div>

          <div className="runtime-list">
            {records.map((rec) => (
              <div key={rec.id}>
                <div
                  className={`runtime-row ${rec.validationResult === "failed" ? "failed" : ""} ${expandedId === rec.id ? "selected" : ""}`}
                  onClick={() => toggleRow(rec.id)}
                >
                  <div className="runtime-col-round">
                    <span className="round-num">#{rec.round}</span>
                    <span className="round-time">{fmtTime(rec.timestamp)}</span>
                  </div>
                  <div className="runtime-col-session">{rec.sessionId.slice(0, 12)}...</div>
                  <div className="runtime-col-speaker">{rec.speakerName}</div>
                  <div className={`runtime-col-latency ${latencyClass(rec.latencyMs)}`}>{rec.latencyMs}ms</div>
                  <div className="runtime-col-validation">
                    <span className={`runtime-badge ${rec.validationResult}`}>
                      {rec.validationResult === "passed" ? "✓ 通过" : "✗ 失败"}
                    </span>
                  </div>
                  <div className="runtime-col-stage">
                    {rec.stageBefore !== rec.stageAfter
                      ? <span className="runtime-stage-change">{rec.stageBefore} → {rec.stageAfter}</span>
                      : <span className="runtime-stage-none">{rec.stageBefore || "—"}</span>}
                  </div>
                  <div className="runtime-col-expand">
                    {expandedId === rec.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                </div>

                {expandedId === rec.id && (
                  <div className="runtime-detail">
                    <div className="runtime-detail-tabs">
                      {(["prompt", "response", "operations", "meta"] as DetailTab[]).map((tab) => (
                        <button
                          key={tab}
                          className={`runtime-detail-tab ${activeTab === tab ? "active" : ""}`}
                          onClick={() => setActiveTab(tab)}
                        >
                          {tab === "prompt" && <><ArrowUp size={14} /> 发送 Prompt</>}
                          {tab === "response" && <><ArrowDown size={14} /> LLM 原始响应</>}
                          {tab === "operations" && <><Swords size={14} /> 状态变化</>}
                          {tab === "meta" && <><Info size={14} /> 回合详情</>}
                        </button>
                      ))}
                    </div>

                    <div className="runtime-detail-content">
                      {activeTab === "prompt" && (
                        <div className="runtime-code-block-wrap">
                          <button
                            className="runtime-copy-btn"
                            onClick={(e) => { e.stopPropagation(); handleCopy(rec.prompt, "prompt"); }}
                          >
                            {copiedField === "prompt" ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                          <pre className="runtime-code-block">{rec.prompt}</pre>
                        </div>
                      )}
                      {activeTab === "response" && (
                        <div className="runtime-code-block-wrap">
                          <button
                            className="runtime-copy-btn"
                            onClick={(e) => { e.stopPropagation(); handleCopy(rec.rawLlmResponse, "response"); }}
                          >
                            {copiedField === "response" ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                          <pre className={`runtime-code-block ${rec.validationResult === "failed" ? "error" : ""}`}>
                            {rec.rawLlmResponse}
                          </pre>
                        </div>
                      )}
                      {activeTab === "operations" && (
                        <div className="runtime-detail-section">
                          {rec.stateDelta && Object.keys(rec.stateDelta).length > 0 ? (
                            <table className="runtime-delta-table">
                              <thead>
                                <tr>
                                  <th>属性</th>
                                  <th>变化量</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(rec.stateDelta).map(([key, val]) => (
                                  <tr key={key}>
                                    <td className="delta-key">{key}</td>
                                    <td className={`delta-value ${val < 0 ? "negative" : "positive"}`}>
                                      {val > 0 ? "+" : ""}{val}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="muted">— 无变化</p>
                          )}
                          {rec.stageBefore !== rec.stageAfter && (
                            <div className="runtime-stage-info">
                              <GitBranch size={14} />
                              <span>阶段: {rec.stageBefore} → {rec.stageAfter}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {activeTab === "meta" && (
                        <dl className="runtime-meta-list">
                          <div className="runtime-meta-item">
                            <dt>发言者</dt>
                            <dd>{rec.speakerName}</dd>
                          </div>
                          <div className="runtime-meta-item">
                            <dt>延迟</dt>
                            <dd className={latencyClass(rec.latencyMs)}>{rec.latencyMs}ms</dd>
                          </div>
                          <div className="runtime-meta-item">
                            <dt>Prompt Tokens</dt>
                            <dd>{rec.tokenUsage?.promptTokens ?? "—"}</dd>
                          </div>
                          <div className="runtime-meta-item">
                            <dt>Completion Tokens</dt>
                            <dd>{rec.tokenUsage?.completionTokens ?? "—"}</dd>
                          </div>
                          <div className="runtime-meta-item">
                            <dt>阶段变化</dt>
                            <dd>{rec.stageBefore !== rec.stageAfter ? `${rec.stageBefore} → ${rec.stageAfter}` : "无变化"}</dd>
                          </div>
                          <div className="runtime-meta-item">
                            <dt>时间</dt>
                            <dd>{new Date(rec.timestamp).toLocaleString("zh-CN")}</dd>
                          </div>
                          <div className="runtime-meta-item">
                            <dt>会话 ID</dt>
                            <dd className="mono">{rec.sessionId}</dd>
                          </div>
                        </dl>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : aggregates && aggregates.totalTurns === 0 ? (
        <div className="placeholder-page">
          <BarChart3 size={48} strokeWidth={1} style={{ color: "#94a3b8" }} />
          <h2>暂无运行时数据</h2>
          <p>开始一场游戏对话后，每次 LLM 调用、状态变化、阶段推进都会记录在这里。</p>
        </div>
      ) : null}
    </section>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtNum(n: number) {
  return n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);
}

function latencyClass(ms: number) {
  if (ms < 1000) return "fast";
  if (ms > 3000) return "slow";
  return "";
}
