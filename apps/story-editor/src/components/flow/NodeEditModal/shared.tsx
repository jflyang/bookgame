import { useState } from "react";

/** Field label with optional help hint */
export function F({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="field" style={{ gap: 2 }}>
      <span>{label}</span>
      {hint && <span className="faint" style={{ textTransform: "none", fontSize: 9, fontWeight: 400, letterSpacing: 0, marginBottom: 1 }}>{hint}</span>}
      {children}
    </label>
  );
}

/** Tag-style multi-select: dropdown + add button + tag list */
export function TagSelect({ label, options, selected, onAdd, onRemove }: {
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
          onClick={() => { if (pick) { onAdd(pick); setPick(""); } }}>+ 添加</button>
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

/** Branch row for choice/judgment nodes */
export function BranchRow({ b, i, stageOptions, moduleOptions, onChange, onRemove }: {
  b: any; i: number;
  stageOptions: { id: string; label: string }[];
  moduleOptions: { id: string; label: string }[];
  onChange: (i: number, field: string, val: string) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1.5fr auto", gap: "var(--s1)", alignItems: "center",
      padding: "var(--s2)", background: "var(--bg)", borderRadius: "var(--r-md)", border: "1px solid var(--border-light)",
    }}>
      <input className="input" style={{ fontSize: "var(--fs-sm)", padding: "4px 8px" }}
        value={b.choiceText || ""} placeholder="按钮文字，如：接受训练"
        onChange={(e) => onChange(i, "choiceText", e.target.value)} />
      <select className="input" style={{ fontSize: "var(--fs-sm)", padding: "4px 8px" }}
        value={b.targetStage || ""}
        onChange={(e) => onChange(i, "targetStage", e.target.value)}>
        <option value="">目标阶段（手动输入或选择）</option>
        {stageOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        <option disabled>── 模块 ──</option>
        {moduleOptions.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
      <button className="btn btn-ghost btn-xs" style={{ color: "var(--danger)" }}
        onClick={() => onRemove(i)}>✕</button>
    </div>
  );
}

/** Pool item row for random event/judgment nodes */
export function PoolRow({ item, i, moduleOptions, onChange, onRemove }: {
  item: any; i: number;
  moduleOptions: { id: string; label: string }[];
  onChange: (i: number, field: string, val: string) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: "var(--s1)", alignItems: "center",
      padding: "var(--s2)", background: "var(--bg)", borderRadius: "var(--r-md)", border: "1px solid var(--border-light)",
    }}>
      <select className="input" style={{ fontSize: "var(--fs-sm)", padding: "4px 8px" }}
        value={item.id || ""}
        onChange={(e) => onChange(i, "id", e.target.value)}>
        <option value="">手动输入ID</option>
        {moduleOptions.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
      <input className="input" style={{ fontSize: "var(--fs-sm)", padding: "4px 8px" }}
        value={item.title || ""} placeholder="标题"
        onChange={(e) => onChange(i, "title", e.target.value)} />
      <button className="btn btn-ghost btn-xs" style={{ color: "var(--danger)" }}
        onClick={() => onRemove(i)}>✕</button>
    </div>
  );
}
