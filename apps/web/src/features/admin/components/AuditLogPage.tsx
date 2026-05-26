import { useEffect, useState } from "react";
import { FileText, RotateCcw } from "lucide-react";

interface AuditEntry {
  id: string;
  timestamp: string;
  type: string;
  sessionId?: string;
  speakerId?: string;
  summary: string;
  details?: Record<string, unknown>;
}

const TYPE_LABELS: Record<string, string> = {
  llm_request: "LLM 请求",
  llm_response: "LLM 响应",
  validation_failed: "校验失败",
  state_change: "状态变更",
  session_created: "会话创建",
  session_completed: "会话完成",
};

const TYPE_COLORS: Record<string, string> = {
  llm_response: "#166534",
  llm_request: "#1e40af",
  validation_failed: "#991b1b",
  state_change: "#92400e",
  session_created: "#0f766e",
  session_completed: "#6d28d9",
};

export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/audit-log");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <section className="editor-page">
      <header className="editor-header">
        <div>
          <p className="editor-eyebrow">AUDIT LOG</p>
          <h1 className="editor-title">审计日志</h1>
        </div>
        <button className="btn-secondary" onClick={() => void load()}><RotateCcw size={16} /> 刷新</button>
      </header>

      {error && <p className="error-banner">{error}</p>}

      {loading ? (
        <p className="muted" style={{ padding: 32, textAlign: "center" }}>加载中...</p>
      ) : entries.length === 0 ? (
        <div className="placeholder-page">
          <FileText size={40} strokeWidth={1} style={{ color: "#94a3b8" }} />
          <h2>暂无审计记录</h2>
          <p>开始一场游戏后，LLM 调用、状态变更等事件会出现在这里。</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {entries.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: "grid",
                gridTemplateColumns: "160px 90px 1fr auto",
                gap: 16,
                alignItems: "center",
                padding: "10px 16px",
                background: "#fff",
                border: "1px solid #e8edf3",
                borderRadius: 8,
                fontSize: "0.85rem",
              }}
            >
              <span style={{ color: "#94a3b8", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                {new Date(entry.timestamp).toLocaleString("zh-CN")}
              </span>
              <span style={{
                color: TYPE_COLORS[entry.type] ?? "#475569",
                background: (TYPE_COLORS[entry.type] ?? "#475569") + "10",
                border: "1px solid " + (TYPE_COLORS[entry.type] ?? "#475569") + "30",
                borderRadius: 4,
                fontSize: "0.72rem",
                fontWeight: 700,
                padding: "2px 6px",
                textAlign: "center",
                whiteSpace: "nowrap",
              }}>
                {TYPE_LABELS[entry.type] ?? entry.type}
              </span>
              <span style={{ color: "#0f172a" }}>{entry.summary}</span>
              <span style={{ color: "#94a3b8", fontSize: "0.72rem", textAlign: "right" }}>
                {entry.sessionId ? entry.sessionId.slice(0, 12) + "..." : "-"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
