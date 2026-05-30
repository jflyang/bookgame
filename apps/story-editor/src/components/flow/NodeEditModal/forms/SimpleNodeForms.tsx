import type { FormProps } from "../types.js";
import { F, BranchRow, PoolRow } from "../shared.js";

/** Event Trigger form */
export function EventTriggerForm({ draft, setDraft }: FormProps) {
  return (
    <>
      <F label="事件名称">
        <input className="input" value={draft.label || ""}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          placeholder="如：突发事件" />
      </F>
      <F label="事件描述" hint="给 LLM 的事件说明">
        <textarea className="input" rows={4} value={(draft.eventDescription as string) || ""}
          onChange={(e) => setDraft({ ...draft, eventDescription: e.target.value })}
          placeholder="如：皇帝突然驾到，要求侍女立刻展示这段时间所学的技能..." />
      </F>
    </>
  );
}

/** Random Event form */
export function RandomEventForm({ draft, setDraft, moduleOptions }: FormProps) {
  return (
    <>
      <F label="随机事件名称" hint="如：随机惩戒事件池">
        <input className="input" value={draft.label || ""}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
      </F>
      <div>
        <div className="flex-between mb2">
          <span className="card-section-title" style={{ margin: 0, padding: 0 }}>随机池（触发时从中随机选一个）</span>
          <button className="btn btn-xs"
            onClick={() => setDraft({ ...draft, randomPool: [...(draft.randomPool as any[] || []), { id: "", title: "" }] })}>
            + 添加条目
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s1)", maxHeight: 240, overflow: "auto" }}>
          {(draft.randomPool as any[] || []).map((item, i) => (
            <PoolRow key={i} item={item} i={i} moduleOptions={moduleOptions}
              onChange={(idx, field, val) => {
                const pool = [...(draft.randomPool as any[] || [])];
                pool[idx] = { ...pool[idx], [field]: val };
                setDraft({ ...draft, randomPool: pool });
              }}
              onRemove={(idx) => setDraft({ ...draft, randomPool: (draft.randomPool as any[] || []).filter((_, j) => j !== idx) })}
            />
          ))}
        </div>
      </div>
    </>
  );
}

/** Random Judgment form */
export function RandomJudgmentForm({ draft, setDraft, stageOptions, moduleOptions }: FormProps) {
  return (
    <>
      <F label="随机判定名称" hint="如：随机检查">
        <input className="input" value={draft.label || ""}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
      </F>
      <div>
        <div className="flex-between mb2">
          <span className="card-section-title" style={{ margin: 0, padding: 0 }}>随机判题池</span>
          <button className="btn btn-xs"
            onClick={() => setDraft({ ...draft, randomPool: [...(draft.randomPool as any[] || []), { id: "", title: "" }] })}>
            + 添加
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s1)", maxHeight: 160, overflow: "auto" }}>
          {(draft.randomPool as any[] || []).map((item, i) => (
            <PoolRow key={i} item={item} i={i} moduleOptions={moduleOptions}
              onChange={(idx, field, val) => {
                const pool = [...(draft.randomPool as any[] || [])];
                pool[idx] = { ...pool[idx], [field]: val };
                setDraft({ ...draft, randomPool: pool });
              }}
              onRemove={(idx) => setDraft({ ...draft, randomPool: (draft.randomPool as any[] || []).filter((_, j) => j !== idx) })}
            />
          ))}
        </div>
      </div>
      <div className="card-section-title" style={{ margin: 0, padding: 0 }}>结果分支（命中 / 未命中）</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s1)" }}>
        {(draft.branches as any[] || [{ choiceText: "命中", targetStage: "" }, { choiceText: "未命中", targetStage: "" }]).map((b, i) => (
          <BranchRow key={i} b={b} i={i} stageOptions={stageOptions} moduleOptions={moduleOptions}
            onChange={(idx, field, val) => {
              const brs = [...(draft.branches as any[] || [{ choiceText: "命中", targetStage: "" }, { choiceText: "未命中", targetStage: "" }])];
              brs[idx] = { ...brs[idx], [field]: val };
              setDraft({ ...draft, branches: brs });
            }}
            onRemove={(idx) => setDraft({ ...draft, branches: (draft.branches as any[] || []).filter((_, j) => j !== idx) })}
          />
        ))}
      </div>
    </>
  );
}

/** Loop form */
export function LoopForm({ draft, setDraft }: FormProps) {
  return (
    <>
      <F label="循环名称" hint="如：侍寝循环">
        <input className="input" value={draft.label || ""}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
      </F>
      <div className="form-grid cols-2">
        <F label="起始循环编号">
          <input className="input" type="number" value={(draft.loopData as any)?.initialCycle || 1}
            onChange={(e) => setDraft({ ...draft, loopData: { ...(draft.loopData as any || {}), initialCycle: Math.max(1, Number(e.target.value) || 1) } })} />
        </F>
        <F label="最大循环次数 (0=无限)">
          <input className="input" type="number" value={(draft.loopData as any)?.maxCycles || 0}
            onChange={(e) => setDraft({ ...draft, loopData: { ...(draft.loopData as any || {}), maxCycles: Number(e.target.value) === 0 ? null : Math.max(1, Number(e.target.value)) } })} />
        </F>
      </div>
      <F label="循环描述" hint="给 LLM 看到的循环说明">
        <textarea className="input" rows={2} value={(draft.loopData as any)?.description || ""}
          onChange={(e) => setDraft({ ...draft, loopData: { ...(draft.loopData as any || {}), description: e.target.value } })} />
      </F>
      <div style={{ background: "var(--bg)", border: "1px solid var(--border-light)", borderRadius: "var(--r-md)", padding: "var(--s3)", marginTop: "var(--s2)" }}>
        <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, marginBottom: "var(--s1)", color: "var(--cat-blue)" }}>
          周期模块映射由连线自动决定
        </div>
        <p className="faint" style={{ margin: 0 }}>
          在画布上连接判定节点的 <b>红色端口 (branch_1/否)</b> 到惩戒模块即可自动建立周期映射。
        </p>
      </div>
    </>
  );
}

/** Daily Trigger form */
export function DailyTriggerForm({ draft, setDraft, modules: allModules }: FormProps) {
  return (
    <>
      <F label="触发器名称">
        <input className="input" value={draft.label || ""}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          placeholder="如：每日早起检查" />
      </F>
      <F label="触发规则" hint="自然语言描述触发条件，由 LLM 判断是否触发">
        <textarea className="input" rows={3} value={(draft.triggerRule as string) || ""}
          onChange={(e) => setDraft({ ...draft, triggerRule: e.target.value })}
          placeholder="如：每天早晨自动触发。检查侍女的仪容仪表、房间卫生..." />
      </F>
      <F label="关联模块" hint="触发后执行的模块">
        <select className="input" value={(draft.moduleRef as string) || ""}
          onChange={(e) => setDraft({ ...draft, moduleRef: e.target.value || undefined })}>
          <option value="">不关联</option>
          {allModules.map((m) => <option key={m.id} value={m.id}>{m.title} ({m.id})</option>)}
        </select>
      </F>
    </>
  );
}

/** Start/End form */
export function StartEndForm({ draft, setDraft, nodeType }: FormProps & { nodeType: string }) {
  return (
    <F label={nodeType === "start" ? "开始节点名称" : "结束节点名称"}>
      <input className="input" value={draft.label || (nodeType === "start" ? "START" : "END")}
        onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
    </F>
  );
}
