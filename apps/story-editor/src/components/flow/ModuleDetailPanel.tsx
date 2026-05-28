import { useState, useEffect } from "react";
import type { StoryModule } from "@story-game/shared";
import { useFlowStore } from "../../store/flowStore.js";
import { useEditorStore } from "../../store/editorStore.js";

const MODULE_TYPES = ["training", "serving", "punishment", "daily", "finale"] as const;
const TYPE_LABELS: Record<string, string> = {
  training: "训练", serving: "侍寝", punishment: "惩戒", daily: "日常", finale: "终章",
};
const TYPE_COLORS: Record<string, string> = {
  training: "#58a6ff", serving: "#f778ba", punishment: "#f85149", daily: "#6e7681", finale: "#d2991d",
};

interface Props {
  moduleId: string;
  onClose: () => void;
}

/* ─── Tag multi-select ─── */
function TagSelect({ label, options, selected, onAdd, onRemove }: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const available = options.filter((o) => !selected.includes(o.id));
  const [pick, setPick] = useState("");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", gap: "var(--s1)" }}>
        <select className="input" style={{ flex: 1, fontSize: "var(--fs-sm)", padding: "4px 8px" }}
          value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">选择{label}...</option>
          {available.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <button className="btn btn-xs" disabled={!pick}
          onClick={() => { if (pick) { onAdd(pick); setPick(""); } }}>+</button>
      </div>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {selected.map((id) => {
            const found = options.find((o) => o.id === id);
            return (
              <span key={id} style={{
                background: "var(--surface2)", border: "1px solid var(--border-light)",
                borderRadius: "var(--r-sm)", padding: "1px 6px", fontSize: "var(--fs-xs)",
                display: "flex", alignItems: "center", gap: 4,
              }}>
                {found?.label || id}
                <button className="btn btn-ghost btn-xs" style={{ padding: 0, fontSize: 10, lineHeight: 1, color: "var(--danger)" }}
                  onClick={() => onRemove(id)}>✕</button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ModuleDetailPanel({ moduleId, onClose }: Props) {
  const modules = useFlowStore((s) => s.modules);
  const nodes = useFlowStore((s) => s.nodes);
  const updateModule = useFlowStore((s) => s.updateModule);
  const storyPackage = useEditorStore((s) => s.storyPackage);

  const mod = modules.find((m) => m.id === moduleId);
  const [draft, setDraft] = useState<StoryModule | null>(null);

  useEffect(() => {
    if (mod) setDraft({ ...mod });
  }, [moduleId]);

  const triggerNode = nodes.find((n) => n.data.moduleRef === moduleId && n.type === "dailyTrigger");
  const triggerRule = (triggerNode?.data.triggerRule as string) || "";

  // Dropdown data
  const characters = storyPackage?.characters || [];
  const skills = storyPackage?.skills || [];
  const stages = storyPackage?.scenario?.stageDetails || [];
  const charOptions = characters.map((c) => ({ id: c.id, label: `${c.name} (${c.role})` }));
  const skillOptions = skills.map((s) => ({ id: s.id, label: s.name }));
  const stageOptions = stages.map((s) => ({ id: s.id, label: s.title || s.id }));

  if (!mod || !draft) {
    return (
      <div className="detail-panel" style={{ width: 340, flexShrink: 0 }}>
        <div className="dp-header">
          <h3>模块详情</h3>
          <button className="btn btn-ghost btn-xs" onClick={onClose}>✕</button>
        </div>
        <div className="dp-body"><p className="muted">模块未找到</p></div>
      </div>
    );
  }

  function update<K extends keyof StoryModule>(key: K, value: StoryModule[K]) {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  return (
    <div className="detail-panel" style={{ width: 380, flexShrink: 0, height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="dp-header">
        <div>
          <h3>模块详情</h3>
          <span className="faint mono">{moduleId}</span>
        </div>
        <button className="btn btn-ghost btn-xs" onClick={onClose}>✕</button>
      </div>

      <div className="dp-body" style={{ flex: 1, overflow: "auto" }}>
        {/* Type */}
        <label className="field">
          <span>类型</span>
          <select
            className="input"
            value={draft.type}
            onChange={(e) => update("type", e.target.value as StoryModule["type"])}
            style={{ borderColor: TYPE_COLORS[draft.type] || "var(--border)" }}
          >
            {MODULE_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]} ({t})</option>
            ))}
          </select>
        </label>

        <label className="field mt3">
          <span>标题</span>
          <input className="input" value={draft.title} onChange={(e) => update("title", e.target.value)} />
        </label>

        <label className="field mt3">
          <span>来源阶段</span>
          <select className="input" value={draft.sourceStage || ""}
            onChange={(e) => update("sourceStage", e.target.value || undefined)}>
            <option value="">无</option>
            {stageOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>

        <label className="field mt3">
          <span>需要角色</span>
          <TagSelect label="角色" options={charOptions}
            selected={draft.requiredCharacters || []}
            onAdd={(id) => update("requiredCharacters", [...(draft.requiredCharacters || []), id])}
            onRemove={(id) => update("requiredCharacters", (draft.requiredCharacters || []).filter((c) => c !== id))}
          />
        </label>

        <label className="field mt3">
          <span>消耗技能</span>
          <TagSelect label="技能" options={skillOptions}
            selected={draft.consumesSkills || []}
            onAdd={(id) => update("consumesSkills", [...(draft.consumesSkills || []), id])}
            onRemove={(id) => update("consumesSkills", (draft.consumesSkills || []).filter((s) => s !== id))}
          />
        </label>

        <label className="field field-row mt3">
          <input type="checkbox" checked={draft.reusable || false}
            onChange={(e) => update("reusable", e.target.checked)} />
          <span style={{ textTransform: "none" }}>可复用</span>
        </label>

        <label className="field mt3">
          <span>描述</span>
          <textarea className="input" rows={3} value={draft.description || ""}
            onChange={(e) => update("description", e.target.value)} />
        </label>

        <label className="field mt3">
          <span>进入条件</span>
          <input className="input" value={draft.enterWhen || ""}
            onChange={(e) => update("enterWhen", e.target.value)} />
        </label>

        <label className="field mt3">
          <span>退出条件</span>
          <input className="input" value={draft.exitCondition || ""}
            onChange={(e) => update("exitCondition", e.target.value)} />
        </label>

        {draft.type === "daily" && (
          <label className="field mt3">
            <span style={{ color: "#f778ba" }}>触发规则 (triggerRule)</span>
            <span className="faint" style={{ textTransform: "none" }}>注入到 PromptService，AI 根据条件自动触发</span>
            <input className="input" value={triggerRule} readOnly
              style={{ background: "rgba(247,119,186,0.08)", borderColor: "rgba(247,119,186,0.3)", fontFamily: "var(--font-mono)" }} />
          </label>
        )}

        <label className="field mt3">
          <span>AI 引导语 (guidance)</span>
          <textarea
            className="input mono"
            rows={8}
            value={draft.guidance || ""}
            onChange={(e) => update("guidance", e.target.value)}
            placeholder={"氛围：xxx\n\n角色A：**动作**（描述）\n角色B：**动作**（描述）\n→ 推进条件：xxx"}
          />
        </label>
      </div>

      <div style={{ padding: "var(--s3) var(--s4)", borderTop: "1px solid var(--border)", display: "flex", gap: "var(--s2)" }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { if (draft) { updateModule(moduleId, draft); onClose(); } }}>
          保存并关闭
        </button>
        <button className="btn" onClick={onClose}>取消</button>
      </div>
    </div>
  );
}
