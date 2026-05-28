import { useState } from "react";
import { useEditorStore } from "../store/editorStore.js";

const DATA_TYPES = [
  { value: "scenario", label: "场景" },
  { value: "character", label: "角色" },
  { value: "skill", label: "技能" },
  { value: "knowledge", label: "知识库文档" },
  { value: "promptRule", label: "Prompt 规则" },
  { value: "performance", label: "表演配置" },
  { value: "stageDetail", label: "阶段详情（含分支）" },
  { value: "branch", label: "阶段分支选项" },
  { value: "storySetting", label: "故事设定" },
];

export function AiAssistant() {
  const { storyPackage, aiLoading, aiResult, aiSuggest, clearAiResult } = useEditorStore();
  const [instruction, setInstruction] = useState("");
  const [context, setContext] = useState("");
  const [dataType, setDataType] = useState("skill");
  const [currentData, setCurrentData] = useState("");

  async function handleSuggest() {
    if (!instruction.trim()) return;
    let parsedData: unknown;
    try {
      parsedData = currentData.trim() ? JSON.parse(currentData) : undefined;
    } catch { /* not JSON, send as string */ }
    await aiSuggest(context, instruction, dataType, parsedData || currentData || undefined);
  }

  return (
    <div className="panel" style={{ display: "flex", gap: "var(--s6)" }}>
      <div style={{ flex: 1 }}>
        <h2>AI 辅助修改</h2>
        <p className="muted">选中要修改的数据类型，描述你想怎么改，AI 会生成新数据。</p>

        <label className="field">
          <span>数据类型</span>
          <select className="input" value={dataType} onChange={(e) => setDataType(e.target.value)}>
            {DATA_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </label>

        <label className="field">
          <span>背景上下文（可选）</span>
          <textarea className="input" rows={3} value={context} onChange={(e) => setContext(e.target.value)} placeholder="告诉 AI 这个故事的背景、角色关系等..." />
        </label>

        <label className="field">
          <span>当前数据（可选，留空则 AI 创建新数据）</span>
          <textarea className="input mono" rows={8} value={currentData} onChange={(e) => setCurrentData(e.target.value)} placeholder="粘贴当前数据的 JSON..." />
        </label>

        <label className="field">
          <span>修改指令</span>
          <textarea className="input" rows={6} style={{ minHeight: 120, resize: "vertical" }} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="例如：把这个技能改成群体攻击，伤害提高到50，加上3回合冷却..." />
        </label>

        <button className="btn btn-primary" onClick={handleSuggest} disabled={aiLoading || !instruction.trim()}>
          {aiLoading ? "AI 思考中..." : "让 AI 生成"}
        </button>
      </div>

      <div style={{ flex: 1 }}>
        <h2>AI 结果</h2>
        {aiLoading && <p className="muted">AI 正在分析中...</p>}

        {aiResult && !aiLoading && (
          <div>
            <div style={{ display: "flex", gap: "var(--s3)", marginBottom: "var(--s3)" }}>
              <button className="btn" onClick={() => navigator.clipboard.writeText(aiResult)}>复制文本</button>
              <button className="btn" onClick={clearAiResult}>清除</button>
            </div>

            <pre className="json-preview" style={{ maxHeight: 500 }}>
              {aiResult}
            </pre>
          </div>
        )}

        {!aiResult && !aiLoading && (
          <div className="empty-state">
            <p>输入左侧指令后点击「让 AI 生成」</p>
            <p style={{ marginTop: "var(--s6)", fontSize: "var(--fs-md)" }}>
              提示：AI 可以帮你做以下事情：<br />
              • 创建新技能/角色/规则<br />
              • 修改知识库文档（含被动联动反应）<br />
              • 调整阶段引导 (guidance)<br />
              • 设计阶段分支 (branches) 和抉择点<br />
              • 完善表演配置的触发词和 knowledgeTitle<br />
              • 润色故事设定文本
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
