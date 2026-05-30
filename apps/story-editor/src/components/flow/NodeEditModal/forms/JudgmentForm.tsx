import type { FormProps } from "../types.js";
import { F, BranchRow } from "../shared.js";

export function JudgmentForm({ draft, setDraft, charOptions, stageOptions, moduleOptions }: FormProps) {
  return (
    <>
      <F label="判定名称" hint="如：皇帝满意度判定">
        <input className="input" value={draft.label || ""}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
      </F>
      <F label="判定者" hint="谁来判断（从角色列表中选择）">
        <select className="input" value={(draft.judgmentData as any)?.judge || ""}
          onChange={(e) => setDraft({ ...draft, judgmentData: { ...(draft.judgmentData as any || {}), judge: e.target.value } })}>
          <option value="">手动输入</option>
          {charOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </F>
      <F label="判定说明" hint="给 LLM 的判断逻辑解释">
        <textarea className="input" rows={3} value={(draft.judgmentData as any)?.description || ""}
          onChange={(e) => setDraft({ ...draft, judgmentData: { ...(draft.judgmentData as any || {}), description: e.target.value } })} />
      </F>
      <div className="card-section-title" style={{ margin: 0, padding: 0 }}>分支（默认：是 / 否）</div>
      <p className="faint">绿色端口 = 是/通过，红色端口 = 否/拒绝。连线到对应目标节点。</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s1)" }}>
        {(draft.branches as any[] || [{ choiceText: "是", targetStage: "" }, { choiceText: "否", targetStage: "" }]).map((b, i) => (
          <BranchRow key={i} b={b} i={i} stageOptions={stageOptions} moduleOptions={moduleOptions}
            onChange={(idx, field, val) => {
              const brs = [...(draft.branches as any[] || [{ choiceText: "是", targetStage: "" }, { choiceText: "否", targetStage: "" }])];
              brs[idx] = { ...brs[idx], [field]: val };
              setDraft({ ...draft, branches: brs });
            }}
            onRemove={(idx) => setDraft({ ...draft, branches: (draft.branches as any[] || []).filter((_, j) => j !== idx) })}
          />
        ))}
      </div>
      <F label="评分方法 (JSON)" hint="高级：定义多维度评分。留空则使用 LLM 自由判断。">
        <textarea className="input mono" rows={6}
          value={JSON.stringify((draft.judgmentData as any)?.scoringMethods || {}, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              setDraft({ ...draft, judgmentData: { ...(draft.judgmentData as any || {}), scoringMethods: parsed } });
            } catch { /* allow invalid JSON while typing */ }
          }}
          placeholder={`{\n  "score_3d": {\n    "dimensions": {\n      "服从度": { "min": 0, "max": 100 }\n    }\n  }\n}`}
        />
      </F>
    </>
  );
}
