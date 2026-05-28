import { Handle, Position } from "@xyflow/react";
import type { FC } from "react";
import type { FlowNodeData } from "../../../lib/flowTypes.js";

export const ChoiceNode: FC<{ data: FlowNodeData; selected?: boolean }> = ({ data, selected }) => {
  const branches = data.branches || [];
  return (
    <div style={{
      background: "#ede9fe", border: `2px solid ${selected ? "#000" : "#8b5cf6"}`,
      borderRadius: 12, padding: "12px 16px", minWidth: 180, maxWidth: 260,
      fontSize: 12, color: "#5b21b6", boxShadow: selected ? "0 0 0 2px #000" : undefined,
    }}>
      <Handle type="target" position={Position.Left} style={{ background: "#8b5cf6" }} />
      <div style={{ fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 16 }}>🔀</span> {data.label}
      </div>
      {branches.length > 0 && (
        <div style={{ fontSize: 10, opacity: 0.8 }}>
          {(branches as Array<{ choiceText?: string; targetStage: string }>).map((b: { choiceText?: string; targetStage: string }, i: number) => (
            <div key={i} style={{ marginBottom: 2 }}>
              {i + 1}. {b.choiceText || b.targetStage}
            </div>
          ))}
        </div>
      )}
      {branches.map((b: { choiceText?: string; targetStage: string }, i: number) => (
        <Handle
          key={i}
          type="source"
          position={Position.Right}
          id={`branch_${i}`}
          style={{ background: "#8b5cf6", top: 30 + i * 20 }}
        />
      ))}
      {branches.length === 0 && (
        <Handle type="source" position={Position.Right} style={{ background: "#8b5cf6" }} />
      )}
    </div>
  );
};
