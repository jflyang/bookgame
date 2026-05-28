import { Handle, Position } from "@xyflow/react";
import type { FC } from "react";
import type { FlowNodeData } from "../../../lib/flowTypes.js";

export const EventTriggerNode: FC<{ data: FlowNodeData; selected?: boolean }> = ({ data, selected }) => {
  return (
    <div style={{
      background: "#fef3c7", border: `2px solid ${selected ? "#000" : "#f59e0b"}`,
      borderRadius: 8, padding: "8px 12px", minWidth: 150, maxWidth: 220,
      fontSize: 11, color: "#92400e", boxShadow: selected ? "0 0 0 2px #000" : undefined,
    }}>
      <Handle type="target" position={Position.Left} style={{ background: "#f59e0b" }} />
      <div style={{ fontWeight: 700, marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 14 }}>📌</span> {data.label}
      </div>
      {data.eventDescription && (
        <div style={{ fontSize: 10, opacity: 0.7, fontStyle: "italic" }}>
          {String(data.eventDescription).slice(0, 60)}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: "#f59e0b" }} />
    </div>
  );
};
