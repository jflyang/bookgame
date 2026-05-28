import { useEditorStore } from "../store/editorStore.js";
import type { StageBranch } from "@story-game/shared";

function emptyBranch(): StageBranch {
  return { targetStage: "", choiceText: "", condition: "", description: "" };
}

export function ScenarioEditor() {
  const { storyPackage, updateScenario, updateStageDetail } = useEditorStore();
  const s = storyPackage?.scenario;
  if (!s) return <p className="muted">暂无场景数据</p>;

  const choicePoints = (s.stageDetails || []).filter((d) => d.isChoicePoint);
  const allStageIds = s.stages || [];

  return (
    <div className="editor-panel">
      <h2>场景与阶段</h2>
      <p className="muted">
        {(s.stageDetails || []).length} 个阶段详情 | {choicePoints.length} 个抉择点 | {allStageIds.length} 个阶段 ID
      </p>

      <label className="field">
        <span>场景 ID</span>
        <input className="input" value={s.id} onChange={(e) => updateScenario({ ...s, id: e.target.value })} />
      </label>
      <label className="field">
        <span>标题</span>
        <input className="input" value={s.title} onChange={(e) => updateScenario({ ...s, title: e.target.value })} />
      </label>
      <label className="field">
        <span>故事前提 (premise)</span>
        <textarea className="input" rows={3} value={s.premise} onChange={(e) => updateScenario({ ...s, premise: e.target.value })} />
      </label>

      <details open>
        <summary>阶段 ID 列表 ({allStageIds.length})</summary>
        <div className="field">
          <span>阶段 ID 列表（逗号分隔）</span>
          <input
            className="input"
            value={allStageIds.join(", ")}
            onChange={(e) => updateScenario({ ...s, stages: e.target.value.split(",").map((i) => i.trim()).filter(Boolean) })}
          />
        </div>
        <p className="muted" style={{ marginTop: 4 }}>
          分支阶段用数字+字母命名：stage_7a, stage_7b。所有分支目标必须在此列表中。
        </p>
      </details>

      <label className="field">
        <span>当前阶段</span>
        <input className="input" value={s.currentStage} onChange={(e) => updateScenario({ ...s, currentStage: e.target.value })} />
      </label>
      <label className="field">
        <span>默认发言角色</span>
        <input className="input" value={s.defaultSpeakerId || ""} onChange={(e) => updateScenario({ ...s, defaultSpeakerId: e.target.value || undefined })} />
      </label>
      <label className="field">
        <span>当前目标</span>
        <input className="input" value={s.currentGoal} onChange={(e) => updateScenario({ ...s, currentGoal: e.target.value })} />
      </label>
      <label className="field">
        <span>规则（每行一条）</span>
        <textarea className="input" rows={4} value={(s.rules || []).join("\n")} onChange={(e) => updateScenario({ ...s, rules: e.target.value.split("\n").filter(Boolean) })} />
      </label>

      <h3>初始状态</h3>
      {(s.initialStates || []).map((is, i) => (
        <div key={i} className="card" style={{ marginBottom: 8 }}>
          <div className="inline-fields">
            <label className="field">
              <span>角色 ID</span>
              <input className="input" value={is.characterId} onChange={(e) => {
                const arr = [...(s.initialStates || [])];
                arr[i] = { ...arr[i], characterId: e.target.value };
                updateScenario({ ...s, initialStates: arr });
              }} />
            </label>
            <label className="field">
              <span>HP</span>
              <input className="input" type="number" value={is.hp} onChange={(e) => {
                const arr = [...(s.initialStates || [])];
                arr[i] = { ...arr[i], hp: Number(e.target.value) };
                updateScenario({ ...s, initialStates: arr });
              }} />
            </label>
            <label className="field">
              <span>MP</span>
              <input className="input" type="number" value={is.mp} onChange={(e) => {
                const arr = [...(s.initialStates || [])];
                arr[i] = { ...arr[i], mp: Number(e.target.value) };
                updateScenario({ ...s, initialStates: arr });
              }} />
            </label>
          </div>
        </div>
      ))}

      {/* Branch structure visualization */}
      {choicePoints.length > 0 && (
        <details open>
          <summary>分支结构预览 ({choicePoints.length} 个抉择点)</summary>
          <div className="card" style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.8 }}>
            {choicePoints.map((cp) => (
              <div key={cp.id} style={{ marginBottom: 8 }}>
                <div style={{ color: "#f59e0b" }}>✦ {cp.title || cp.id} (抉择点)</div>
                {cp.branches?.map((b, bi) => (
                  <div key={bi} style={{ marginLeft: 16, color: "var(--text-muted)" }}>
                    {bi === 0 ? "├─" : "└─"} {b.choiceText || `选项${bi + 1}`} → <span style={{ color: "var(--primary-hover)" }}>{b.targetStage}</span>
                    {b.description ? ` — ${b.description}` : ""}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Stage Details */}
      <h3>阶段详情 (stageDetails)</h3>
      <p className="muted">展开每个阶段编辑 guidance、分支等。标 <span style={{ color: "#f59e0b" }}>✦</span> 的为抉择点。</p>
      {(s.stageDetails || []).map((stage) => (
        <details key={stage.id} className="card" style={{ marginBottom: 12, borderLeft: stage.isChoicePoint ? "3px solid #f59e0b" : undefined }}>
          <summary>
            {stage.isChoicePoint && <span style={{ color: "#f59e0b" }}>✦ </span>}
            <strong>{stage.title || stage.id}</strong>
            {stage.isChoicePoint && <span style={{ color: "#f59e0b", fontSize: 12 }}> — 抉择点 ({stage.branches?.length || 0} 个分支)</span>}
            {!stage.isChoicePoint && <span style={{ color: "var(--text-muted)", fontSize: 12 }}> — {stage.description}</span>}
          </summary>
          <div style={{ marginTop: 8 }}>
            <label className="field"><span>ID</span><input className="input" value={stage.id} onChange={(e) => updateStageDetail({ ...stage, id: e.target.value })} /></label>
            <label className="field"><span>标题</span><input className="input" value={stage.title} onChange={(e) => updateStageDetail({ ...stage, title: e.target.value })} /></label>
            <label className="field"><span>描述</span><input className="input" value={stage.description} onChange={(e) => updateStageDetail({ ...stage, description: e.target.value })} /></label>
            <label className="field"><span>进入条件 (enterWhen)</span><input className="input" value={stage.enterWhen} onChange={(e) => updateStageDetail({ ...stage, enterWhen: e.target.value })} /></label>
            <label className="field">
              <span>阶段引导 (guidance) — LLM 看到的指令</span>
              <textarea className="input" rows={8} value={stage.guidance} onChange={(e) => updateStageDetail({ ...stage, guidance: e.target.value })} />
            </label>
            <label className="field">
              <span>阶段指令 (directive) — 必须推动到的方向</span>
              <textarea className="input" rows={4} value={stage.directive || ""} onChange={(e) => updateStageDetail({ ...stage, directive: e.target.value })} placeholder="必须发生的具体事件，如：虚竹必须击中丁春秋右肩。留空则无强制指令。" />
            </label>

            {/* Choice Point Toggle & Branches */}
            <label className="field inline-check" style={{ marginTop: 12 }}>
              <input
                type="checkbox"
                checked={stage.isChoicePoint === true}
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  updateStageDetail({
                    ...stage,
                    isChoicePoint: isChecked || undefined,
                    branches: isChecked ? (stage.branches || [emptyBranch()]) : [],
                  });
                }}
              />
              <span style={{ color: "#f59e0b", fontWeight: 600 }}>✦ 设为抉择点</span>
            </label>
            {stage.isChoicePoint && (
              <div className="card" style={{ marginTop: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 14 }}>分支选项 ({stage.branches?.length || 0})</h4>
                  <button className="btn-secondary" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => {
                    const brs = [...(stage.branches || []), emptyBranch()];
                    updateStageDetail({ ...stage, branches: brs });
                  }}>+ 添加分支</button>
                </div>
                {(stage.branches || []).map((branch, bi) => (
                  <div key={bi} className="card" style={{ marginBottom: 8, padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>选项 {bi + 1}</span>
                      <button className="btn-danger" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => {
                        const brs = (stage.branches || []).filter((_, j) => j !== bi);
                        updateStageDetail({ ...stage, branches: brs });
                      }}>删除</button>
                    </div>
                    <div className="inline-fields">
                      <label className="field" style={{ flex: 2 }}><span>目标阶段 targetStage *</span>
                        <select className="input" value={branch.targetStage} onChange={(e) => {
                          const brs = [...(stage.branches || [])];
                          brs[bi] = { ...brs[bi], targetStage: e.target.value };
                          updateStageDetail({ ...stage, branches: brs });
                        }}>
                          <option value="">选择目标阶段...</option>
                          {allStageIds.map((sid) => <option key={sid} value={sid}>{sid}</option>)}
                        </select>
                      </label>
                      <label className="field" style={{ flex: 3 }}><span>按钮文本 choiceText</span>
                        <input className="input" value={branch.choiceText || ""} onChange={(e) => {
                          const brs = [...(stage.branches || [])];
                          brs[bi] = { ...brs[bi], choiceText: e.target.value || undefined };
                          updateStageDetail({ ...stage, branches: brs });
                        }} placeholder="如：温柔引导" />
                      </label>
                    </div>
                    <label className="field"><span>触发条件 condition（供 LLM 参考）</span>
                      <input className="input" value={branch.condition || ""} onChange={(e) => {
                        const brs = [...(stage.branches || [])];
                        brs[bi] = { ...brs[bi], condition: e.target.value || undefined };
                        updateStageDetail({ ...stage, branches: brs });
                      }} placeholder="如：小薇接受自己的身体反应" />
                    </label>
                    <label className="field"><span>分支描述 description</span>
                      <input className="input" value={branch.description || ""} onChange={(e) => {
                        const brs = [...(stage.branches || [])];
                        brs[bi] = { ...brs[bi], description: e.target.value || undefined };
                        updateStageDetail({ ...stage, branches: brs });
                      }} placeholder="如：进入 A 路线：身体诚实、温柔顺从" />
                    </label>
                  </div>
                ))}
                {/* Guidance hint for choice points */}
                <div className="card" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", padding: 10, marginTop: 8 }}>
                  <p style={{ fontSize: 12, color: "#f59e0b", margin: 0 }}>
                    <strong>抉择点 guidance 提示：</strong><br />
                    1. 在 guidance 中加 <code>⚠️ 本轮必须把剧情推到抉择时刻。</code><br />
                    2. LLM 收到指令后会把故事写到分叉时刻，不填写 stageSuggestion<br />
                    3. 前端收到后渲染选项按钮，玩家选择 → API 应用 → 自动继续下一轮
                  </p>
                </div>
              </div>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
