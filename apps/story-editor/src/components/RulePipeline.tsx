import { useState, useMemo } from "react";
import { useEditorStore } from "../store/editorStore.js";
import type { StoryPromptRule } from "@story-game/shared";

const CATEGORY_INFO: Record<string, { label: string; color: string }> = {
  knowledge_forcing: { label: "知识库强制", color: "var(--cat-blue)" },
  group_chat_boundary: { label: "群聊边界", color: "var(--cat-green)" },
  scenario_injection: { label: "场景注入", color: "var(--cat-orange)" },
  state_output: { label: "状态输出", color: "var(--cat-red)" },
  history_state: { label: "历史状态", color: "var(--cat-purple)" },
  combat: { label: "战斗", color: "var(--cat-pink)" },
  skill_linkage: { label: "技能联动", color: "var(--cat-cyan, var(--cat-blue))" },
  custom: { label: "自定义", color: "var(--cat-gray)" },
};

export function RulePipeline() {
  const { storyPackage } = useEditorStore();
  const rules = storyPackage?.promptRules || [];
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const enabledCount = rules.filter((r) => r.enabled).length;

  const grouped = useMemo(() => {
    const g: Record<string, StoryPromptRule[]> = {};
    for (const r of rules) {
      const cat = r.category || "custom";
      if (!g[cat]) g[cat] = [];
      g[cat].push(r);
    }
    return g;
  }, [rules]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>规则管线</h2>
          <span className="faint">{rules.length} 条规则 · {enabledCount} 启用 · 只读</span>
        </div>
      </div>

      <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: "var(--s3)" }}>
        {Object.keys(grouped).length === 0 ? (
          <div className="empty-state"><p>暂无规则</p></div>
        ) : (
          Object.entries(grouped).map(([cat, group]) => {
            const info = CATEGORY_INFO[cat] || CATEGORY_INFO.custom;
            return (
              <div key={cat}>
                <div style={{
                  fontSize: "var(--fs-xs)", fontWeight: 700, color: info.color,
                  padding: "var(--s1) 0", marginBottom: "var(--s1)",
                  borderBottom: `1px solid var(--border-light)`,
                }}>
                  {info.label} ({group.length})
                </div>
                {group.map((rule) => {
                  const expanded = expandedId === rule.id;
                  return (
                    <div key={rule.id} style={{ marginBottom: "var(--s1)" }}>
                      <button onClick={() => setExpandedId(expanded ? null : rule.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: "var(--s2)",
                          width: "100%", textAlign: "left", padding: "var(--s2) var(--s3)",
                          background: expanded ? "var(--accent-bg)" : "transparent",
                          border: "none", borderRadius: "var(--r-sm)", cursor: "pointer",
                          fontFamily: "var(--font)",
                        }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                          background: rule.enabled ? info.color : "var(--border)",
                        }} />
                        <span style={{
                          flex: 1, fontSize: "var(--fs-sm)", fontWeight: expanded ? 600 : 400,
                          color: rule.enabled ? "var(--text)" : "var(--text-muted)",
                          textDecoration: rule.enabled ? "none" : "line-through",
                        }}>{rule.title}</span>
                        <span className={`tag ${rule.enabled ? "tag-green" : "tag-gray"}`} style={{ fontSize: 9 }}>
                          {rule.enabled ? "启用" : "禁用"}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-faint)" }}>{expanded ? "▼" : "▶"}</span>
                      </button>
                      {expanded && (
                        <div style={{
                          padding: "var(--s3)", margin: "var(--s1) 0 var(--s2) var(--s4)",
                          background: "var(--bg2)", borderRadius: "var(--r-sm)",
                          border: "1px solid var(--border-light)",
                          fontSize: "var(--fs-sm)", lineHeight: 1.6, whiteSpace: "pre-wrap",
                          fontFamily: "var(--font-mono)", maxHeight: 300, overflow: "auto",
                        }}>
                          {rule.content || "（无内容）"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
