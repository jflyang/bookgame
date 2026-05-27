import { useEffect, useState, useRef, useCallback } from "react";
import {
  MessageSquare, Timer, Users, Activity,
  RotateCcw, Trash2, Filter, ChevronDown, ChevronRight,
  Circle, Play, CheckCircle2
} from "lucide-react";
import { fetchSessions, fetchSessionDetail, clearSessions, type SessionSummary, type SessionDetail } from "../../../lib/sessionApi.js";
import { useGameStore } from "../../../store/gameStore.js";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  active: { label: "进行中", color: "#166534", icon: Play },
  completed: { label: "已结束", color: "#64748b", icon: CheckCircle2 },
  idle: { label: "空闲", color: "#94a3b8", icon: Circle },
};

type DetailTab = "info" | "messages" | "llm";

export function SessionList() {
  const { storyPackages } = useGameStore();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storyFilter, setStoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("info");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchSessions(storyFilter || undefined, statusFilter || undefined);
      setSessions(result.sessions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [storyFilter, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => { void load(); }, 5000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, load]);

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setActiveTab("info");
    setDetailLoading(true);
    try {
      const result = await fetchSessionDetail(id);
      setDetail(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载详情失败");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleClear = () => {
    if (!window.confirm("确定要清空所有会话记录吗？此操作不可撤销。")) return;
    clearSessions().then(() => load()).catch((err) => setError(err.message));
  };

  const activeCount = sessions.filter((s) => s.status === "active").length;
  const avgRound = sessions.length > 0 ? Math.round(sessions.reduce((sum, s) => sum + s.round, 0) / sessions.length) : 0;
  const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0);

  const headerCards = [
    { icon: Users, value: sessions.length, label: "总会话" },
    { icon: Play, value: activeCount, label: "进行中", color: "#166534" },
    { icon: Activity, value: avgRound, label: "平均回合" },
    { icon: MessageSquare, value: totalMessages, label: "总消息" },
  ];

  if (loading) {
    return (
      <section className="editor-page">
        <header className="editor-header">
          <div>
            <p className="editor-eyebrow">SESSION MANAGER</p>
            <h1 className="editor-title">会话管理</h1>
          </div>
        </header>
        <div className="runtime-cards">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="runtime-card runtime-skeleton">
              <div className="skeleton-icon" />
              <div className="skeleton-value" />
              <div className="skeleton-label" />
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
          <p className="editor-eyebrow">SESSION MANAGER</p>
          <h1 className="editor-title">会话管理</h1>
        </div>
        <div className="editor-header-actions" style={{ flexWrap: "wrap" }}>
          <div className="runtime-filter">
            <Filter size={14} />
            <select value={storyFilter} onChange={(e) => { setStoryFilter(e.target.value); setLoading(true); }}>
              <option value="">全部故事包</option>
              {storyPackages.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
          <div className="runtime-filter" style={{ marginLeft: 8 }}>
            <Filter size={14} />
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setLoading(true); }}>
              <option value="">全部状态</option>
              <option value="active">进行中</option>
              <option value="idle">空闲</option>
              <option value="completed">已结束</option>
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

      {error && <p className="error-banner">{error}</p>}

      {sessions.length === 0 ? (
        <div className="placeholder-page">
          <MessageSquare size={40} strokeWidth={1} style={{ color: "#94a3b8" }} />
          <h2>暂无会话记录</h2>
          <p>进入展示界面开始一场游戏后，会话信息会出现在这里。</p>
        </div>
      ) : (
        <>
          <div className="runtime-cards">
            {headerCards.map((card) => {
              const Icon = card.icon;
              return (
                <div className="runtime-card" key={card.label}>
                  <Icon size={20} className="runtime-card-icon" style={card.color ? { color: card.color } : undefined} />
                  <div className="runtime-card-value" style={card.color ? { color: card.color } : undefined}>{card.value}</div>
                  <div className="runtime-card-label">{card.label}</div>
                </div>
              );
            })}
          </div>

          <div className="session-list">
            {sessions.map((s) => {
              const st = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.idle;
              const StatusIcon = st.icon;
              const isExpanded = expandedId === s.id;

              return (
                <div key={s.id} className={`session-row ${isExpanded ? "expanded" : ""}`}>
                  <button className="session-row-main" onClick={() => handleExpand(s.id)}>
                    <span className="session-row-chevron">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </span>
                    <StatusIcon size={14} style={{ color: st.color, flexShrink: 0 }} />
                    <span className="session-row-title">{s.storyPackageTitle || s.storyPackageId}</span>
                    <span className="session-row-meta">
                      {s.round} 回合 · {s.messageCount} 条消息
                    </span>
                    <span className="session-row-status" style={{ color: st.color, borderColor: st.color + "40", background: st.color + "10" }}>
                      {st.label}
                    </span>
                    <span className="session-row-time">{fmtRelative(s.updatedAt)}</span>
                    <span className="session-row-id">{s.id.slice(0, 14)}...</span>
                  </button>

                  {isExpanded && (
                    <div className="session-detail">
                      <div className="session-detail-tabs">
                        {(["info", "messages", "llm"] as DetailTab[]).map((tab) => (
                          <button
                            key={tab}
                            className={`session-detail-tab ${activeTab === tab ? "active" : ""}`}
                            onClick={() => setActiveTab(tab)}
                          >
                            {{ info: "基本信息", messages: "消息历史", llm: "LLM 调用记录" }[tab]}
                          </button>
                        ))}
                      </div>

                      {detailLoading ? (
                        <p className="muted" style={{ padding: 24, textAlign: "center" }}>加载中...</p>
                      ) : detail ? (
                        <div className="session-detail-body">
                          {activeTab === "info" && <SessionInfo detail={detail} />}
                          {activeTab === "messages" && <SessionMessages detail={detail} />}
                          {activeTab === "llm" && <SessionLlmCalls sessionId={s.id} />}
                        </div>
                      ) : (
                        <p className="muted" style={{ padding: 24, textAlign: "center" }}>暂无数据</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function SessionInfo({ detail }: { detail: SessionDetail }) {
  const s = detail.session;
  const st = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.idle;

  return (
    <div className="session-info-grid">
      <div className="session-info-section">
        <h4>会话概况</h4>
        <dl className="session-info-dl">
          <div><dt>故事包</dt><dd>{s.storyPackageTitle}</dd></div>
          <div><dt>状态</dt><dd style={{ color: st.color }}>{st.label}</dd></div>
          <div><dt>回合</dt><dd>{s.round}</dd></div>
          <div><dt>阶段</dt><dd>{s.currentStage || "—"}</dd></div>
          <div><dt>消息数</dt><dd>{s.messageCount}</dd></div>
          <div><dt>创建时间</dt><dd>{new Date(s.createdAt).toLocaleString("zh-CN")}</dd></div>
          <div><dt>更新时间</dt><dd>{new Date(s.updatedAt).toLocaleString("zh-CN")}</dd></div>
        </dl>
      </div>

      {s.characterStates.length > 0 && (
        <div className="session-info-section">
          <h4>角色状态</h4>
          <div className="session-character-bars">
            {s.characterStates.map((cs) => {
              const hpPct = cs.maxHp > 0 ? Math.max(0, Math.round((cs.hp / cs.maxHp) * 100)) : 0;
              const mpPct = cs.maxMp > 0 ? Math.max(0, Math.round((cs.mp / cs.maxMp) * 100)) : 0;
              return (
                <div key={cs.name} className="session-character-bar">
                  <div className="session-character-name">{cs.name}</div>
                  <div className="session-character-stat">
                    <span>HP</span>
                    <div className="session-bar-track">
                      <div className="session-bar-fill hp" style={{ width: `${hpPct}%` }} />
                    </div>
                    <span className="session-bar-num">{cs.hp}/{cs.maxHp}</span>
                  </div>
                  <div className="session-character-stat">
                    <span>MP</span>
                    <div className="session-bar-track">
                      <div className="session-bar-fill mp" style={{ width: `${mpPct}%` }} />
                    </div>
                    <span className="session-bar-num">{cs.mp}/{cs.maxMp}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionMessages({ detail }: { detail: SessionDetail }) {
  if (!detail.messages || detail.messages.length === 0) {
    return <p className="muted" style={{ padding: 24, textAlign: "center" }}>暂无消息（会话可能已过期或服务已重启）</p>;
  }
  return (
    <div className="session-messages-list">
      {detail.messages.map((msg, i) => (
        <div key={msg.id || i} className={`session-msg ${msg.role}`}>
          <span className="session-msg-role">{msg.role === "user" ? "玩家" : (msg.speakerId || "系统")}</span>
          <span className="session-msg-content">{msg.content.slice(0, 200)}{msg.content.length > 200 ? "..." : ""}</span>
          <span className="session-msg-time">{new Date(msg.createdAt).toLocaleTimeString("zh-CN")}</span>
        </div>
      ))}
    </div>
  );
}

function SessionLlmCalls({ sessionId }: { sessionId: string }) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/runtime-stats/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((data) => setRecords(data.records ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <p className="muted" style={{ padding: 24, textAlign: "center" }}>加载中...</p>;
  if (records.length === 0) return <p className="muted" style={{ padding: 24, textAlign: "center" }}>暂无 LLM 调用记录</p>;

  return (
    <div className="session-llm-list">
      {records.map((r: any) => (
        <div key={r.id} className={`session-llm-row ${r.validationResult === "failed" ? "failed" : ""}`}>
          <div className="session-llm-header">
            <span>回合 {r.round} · {r.speakerName}</span>
            <span className={r.validationResult === "passed" ? "pass" : "fail"}>
              {r.validationResult === "passed" ? "通过" : "失败"}
            </span>
            <span>{r.latencyMs}ms · prompt {r.tokenUsage?.promptTokens ?? "?"}t / completion {r.tokenUsage?.completionTokens ?? "?"}t</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}
