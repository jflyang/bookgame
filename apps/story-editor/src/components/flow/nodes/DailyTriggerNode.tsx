import { Handle, Position } from "@xyflow/react";
import type { FC } from "react";
import type { FlowNodeData } from "../../../lib/flowTypes.js";

export const DailyTriggerNode: FC<{ data: FlowNodeData; selected?: boolean }> = ({ data, selected }) => {
  return (
    <div style={{
      background: "#f3f4f6", border: `2px dashed ${selected ? "#000" : "#9ca3af"}`,
      borderRadius: 8, padding: "8px 12px", minWidth: 160, maxWidth: 200,
      fontSize: 11, color: "#6b7280", boxShadow: selected ? "0 0 0 2px #000" : undefined,
    }}>
      <Handle type="target" position={Position.Left} style={{ background: "#9ca3af" }} />
      <div style={{ fontWeight: 600, marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}>
        <span>📋</span> {data.label}
      </div>
      {data.triggerRule && (
        <div style={{ fontSize: 9, opacity: 0.65, fontStyle: "italic" }}>{data.triggerRule}</div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: "#9ca3af" }} />
    </div>
  );
};
