import { Handle, Position } from "@xyflow/react";
import type { FC } from "react";
import type { FlowNodeData } from "../../../lib/flowTypes.js";

export const JudgmentNode: FC<{ data: FlowNodeData; selected?: boolean }> = ({ data, selected }) => {
  const branches = (data.branches || [
    { choiceText: "是", targetStage: "yes" },
    { choiceText: "否", targetStage: "no" },
  ]) as Array<{ choiceText?: string; targetStage: string; description?: string }>;

  const judge = (data.judgmentData || {}) as Record<string, any>;
  const scoring = judge?.scoringMethods;

  return (
    <div style={{
      background: "#fef9c3", border: `2px solid ${selected ? "#000" : "#eab308"}`,
      borderRadius: 10, padding: "10px 14px", minWidth: 150, maxWidth: 220,
      fontSize: 11, color: "#854d0e", boxShadow: selected ? "0 0 0 2px #000" : undefined,
      position: "relative",
    }}>
      <Handle type="target" position={Position.Left} style={{ background: "#eab308" }} />

      <div style={{ fontWeight: 700, marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 16 }}>⚖️</span> {data.label}
      </div>

      {scoring ? (
        <div style={{ fontSize: 9, opacity: 0.55 }}>评分模式：{Object.keys(scoring).join("、")}</div>
      ) : (
        <div style={{ fontSize: 9, opacity: 0.55 }}>玩家选择</div>
      )}

      {/* Two handles: Yes (bottom-right, green) and No (top-right, red) */}
      <Handle type="source" position={Position.Right} id="branch_0"
        style={{ background: "#22c55e", top: "30%" }} />
      <Handle type="source" position={Position.Right} id="branch_1"
        style={{ background: "#ef4444", top: "65%" }} />

      {/* Branch labels */}
      <div style={{ position: "absolute", right: -42, top: "26%", fontSize: 10, fontWeight: 600, color: "#166534" }}>
        {branches[0]?.choiceText || "是"}
      </div>
      <div style={{ position: "absolute", right: -42, top: "61%", fontSize: 10, fontWeight: 600, color: "#991b1b" }}>
        {branches[1]?.choiceText || "否"}
      </div>
    </div>
  );
};
