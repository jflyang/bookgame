import { Handle, Position } from "@xyflow/react";
import type { FC } from "react";
import type { FlowNodeData } from "../../../lib/flowTypes.js";

export const RandomJudgmentNode: FC<{ data: FlowNodeData; selected?: boolean }> = ({ data, selected }) => {
  const pool = (data.randomPool || []) as Array<{ id: string; title: string }>;
  const branches = (data.branches || [
    { choiceText: "命中", targetStage: "hit" },
    { choiceText: "未命中", targetStage: "miss" },
  ]) as Array<{ choiceText?: string; targetStage: string; description?: string }>;

  return (
    <div style={{
      background: "#ede9fe", border: `2px solid ${selected ? "#000" : "#8b5cf6"}`,
      borderRadius: 10, padding: "10px 14px", minWidth: 150, maxWidth: 220,
      fontSize: 11, color: "#5b21b6", boxShadow: selected ? "0 0 0 2px #000" : undefined,
      position: "relative",
    }}>
      <Handle type="target" position={Position.Left} style={{ background: "#8b5cf6" }} />

      <div style={{ fontWeight: 700, marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 16 }}>🎯</span> {data.label}
      </div>

      <div style={{ fontSize: 9, opacity: 0.55 }}>随机判定</div>

      {pool.length > 0 && (
        <div style={{ fontSize: 9, opacity: 0.65, marginTop: 2 }}>
          条件池 ({pool.length})：{pool.slice(0, 3).map((p) => p.title).join("、")}
        </div>
      )}

      <Handle type="source" position={Position.Right} id="branch_0"
        style={{ background: "#22c55e", top: "30%" }} />
      <Handle type="source" position={Position.Right} id="branch_1"
        style={{ background: "#ef4444", top: "65%" }} />

      <div style={{ position: "absolute", right: -48, top: "26%", fontSize: 10, fontWeight: 600, color: "#166534" }}>
        {branches[0]?.choiceText || "命中"}
      </div>
      <div style={{ position: "absolute", right: -48, top: "61%", fontSize: 10, fontWeight: 600, color: "#991b1b" }}>
        {branches[1]?.choiceText || "未命中"}
      </div>
    </div>
  );
};
