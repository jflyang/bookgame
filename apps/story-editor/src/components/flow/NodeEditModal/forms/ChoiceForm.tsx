import type { FormProps } from "../types.js";
import { F, BranchRow } from "../shared.js";

export function ChoiceForm({ draft, setDraft, stageOptions, moduleOptions }: FormProps) {
  return (
    <>
      <F label="抉择标题" hint="如：侍女的选择">
        <input className="input" value={draft.label || ""}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
      </F>
      <div>
        <div className="flex-between mb2">
          <span className="card-section-title" style={{ margin: 0, padding: 0 }}>分支选项</span>
          <button className="btn btn-xs"
            onClick={() => setDraft({ ...draft, branches: [...(draft.branches as any[] || []), { choiceText: "", targetStage: "" }] })}>
            + 添加分支
          </button>
        </div>
        <p className="faint mb2">每个分支 = 玩家看到的选择按钮 + 跳转目标阶段。连线时从右侧端口拖到目标节点。</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s1)", maxHeight: 240, overflow: "auto" }}>
          {(draft.branches as any[] || []).map((b, i) => (
            <BranchRow key={i} b={b} i={i} stageOptions={stageOptions} moduleOptions={moduleOptions}
              onChange={(idx, field, val) => {
                const brs = [...(draft.branches as any[] || [])];
                brs[idx] = { ...brs[idx], [field]: val };
                setDraft({ ...draft, branches: brs });
              }}
              onRemove={(idx) => setDraft({ ...draft, branches: (draft.branches as any[] || []).filter((_, j) => j !== idx) })}
            />
          ))}
        </div>
      </div>
      <F label="条件 (可选)" hint="显示此抉择的前置条件">
        <input className="input" value={(draft as any).condition || ""}
          onChange={(e) => setDraft({ ...draft, condition: e.target.value })} />
      </F>
    </>
  );
}
