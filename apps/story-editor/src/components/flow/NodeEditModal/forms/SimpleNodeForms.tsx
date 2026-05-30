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

/** Random Event form — 随机从事件池中选一个执行，执行完继续往下走 */
export function RandomEventForm({ draft, setDraft, moduleOptions }: FormProps) {
  return (
    <>
      <F label="随机事件名称" hint="如：路遇江湖奇事">
        <input className="input" value={draft.label || ""}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
      </F>
      <F label="事件说明" hint="给 AI 的整体说明，描述这组随机事件的主题">
        <textarea className="input" rows={2} value={(draft.eventDescription as string) || ""}
          onChange={(e) => setDraft({ ...draft, eventDescription: e.target.value })}
          placeholder="如：三人行路途中可能遇到的江湖趣事，随机触发一件" />
      </F>
      <div>
        <div className="flex-between mb2">
          <span className="card-section-title" style={{ margin: 0, padding: 0 }}>事件池（随机选一个执行）</span>
          <button className="btn btn-xs"
            onClick={() => setDraft({ ...draft, randomPool: [...(draft.randomPool as any[] || []), { id: "", title: "" }] })}>
            + 添加事件
          </button>
        </div>
        {(draft.randomPool as any[] || []).length === 0 && (
          <p className="faint" style={{ fontSize: "var(--fs-xs)", margin: "var(--s1) 0" }}>
            暂无事件，点击"+ 添加事件"创建
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s1)", maxHeight: 300, overflow: "auto" }}>
          {(draft.randomPool as any[] || []).map((item, i) => (
            <div key={i} style={{
              display: "flex", gap: "var(--s1)", alignItems: "center",
              padding: "var(--s1) var(--s2)", background: "var(--bg)",
              borderRadius: "var(--r-sm)", border: "1px solid var(--border-light)",
            }}>
              <span style={{ fontSize: 11, color: "var(--text-faint)", width: 20 }}>#{i + 1}</span>
              <input className="input" style={{ flex: 1 }}
                value={item.title || ""}
                onChange={(e) => {
                  const pool = [...(draft.randomPool as any[] || [])];
                  pool[i] = { ...pool[i], title: e.target.value, id: pool[i].id || `event_${Date.now()}_${i}` };
                  setDraft({ ...draft, randomPool: pool });
                }}
                placeholder="事件标题（如：遇到卖艺老人）" />
              <button className="btn btn-ghost btn-xs" style={{ color: "var(--danger)" }}
                onClick={() => setDraft({ ...draft, randomPool: (draft.randomPool as any[] || []).filter((_, j) => j !== i) })}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <p className="faint" style={{ fontSize: 10, marginTop: "var(--s2)" }}>
          💡 每个事件标题会作为 AI 的剧情指引。执行完毕后自动继续主线流程。
        </p>
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

/** Loop form — 循环节点配置：最大次数、退出条件、循环体说明 */
export function LoopForm({ draft, setDraft }: FormProps) {
  return (
    <>
      <F label="循环名称" hint="如：日常修炼">
        <input className="input" value={draft.label || ""}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
      </F>
      <div className="form-grid cols-2">
        <F label="最大循环次数" hint="0 或留空 = 无限循环">
          <input className="input" type="number" min={0}
            value={draft.loopMaxCycles ?? ""}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setDraft({ ...draft, loopMaxCycles: isNaN(val) || val <= 0 ? null : val });
            }}
            placeholder="0 = 无限" />
        </F>
        <F label="循环体简述" hint="显示在节点上的简短说明">
          <input className="input"
            value={(draft.loopBodyLabel as string) || ""}
            onChange={(e) => setDraft({ ...draft, loopBodyLabel: e.target.value })}
            placeholder="如：为弟子解毒 + 喝茶论武" />
        </F>
      </div>
      <F label="退出条件" hint="满足此条件时退出循环（AI 每轮判断）">
        <textarea className="input" rows={3}
          value={(draft.loopExitCondition as string) || ""}
          onChange={(e) => setDraft({ ...draft, loopExitCondition: e.target.value })}
          placeholder="如：所有星宿弟子体内余毒已全部化解，或玩家选择踏上归途" />
      </F>
      <div style={{ background: "var(--bg)", border: "1px solid var(--border-light)", borderRadius: "var(--r-md)", padding: "var(--s3)", marginTop: "var(--s2)" }}>
        <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, marginBottom: "var(--s1)", color: "#10b981" }}>
          🔁 连线说明
        </div>
        <div className="faint" style={{ fontSize: 11, lineHeight: 1.6 }}>
          <div>• <b>循环体出口</b>（绿色，下方）→ 连到循环体的第一个节点</div>
          <div>• 循环体最后一个节点 → 连回本循环节点的左侧入口</div>
          <div>• <b>退出出口</b>（红色，上方）→ 连到退出循环后的下一个节点</div>
        </div>
        <div className="faint" style={{ fontSize: 10, marginTop: "var(--s2)", opacity: 0.7 }}>
          退出时机：达到最大次数 / AI 判断退出条件成立 / 玩家在循环体中选择退出
        </div>
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
