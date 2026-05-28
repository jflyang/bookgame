import { Handle, Position } from "@xyflow/react";
import type { FC } from "react";
import type { FlowNodeData } from "../../../lib/flowTypes.js";

const COLORS: Record<string, { bg: string; border: string; text: string }> = {
  training:   { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  serving:    { bg: "#fce7f3", border: "#ec4899", text: "#9d174d" },
  punishment: { bg: "#fee2e2", border: "#ef4444", text: "#991b1b" },
  daily:      { bg: "#f3f4f6", border: "#6b7280", text: "#374151" },
  finale:     { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
};

export const ModuleNode: FC<{ data: FlowNodeData; selected?: boolean }> = ({ data, selected }) => {
  const c = COLORS[data.colorKey || "training"] || COLORS.training;
  return (
    <div style={{
      background: c.bg, border: `2px solid ${selected ? "#000" : c.border}`,
      borderRadius: 8, padding: "10px 14px", minWidth: 160, maxWidth: 220,
      fontSize: 12, color: c.text, boxShadow: selected ? "0 0 0 2px #000" : undefined,
    }}>
      <Handle type="target" position={Position.Left} style={{ background: c.border }} />
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{data.label}</div>
      {data.moduleData?.description && (
        <div style={{ fontSize: 10, opacity: 0.7, lineHeight: 1.3, maxHeight: 40, overflow: "hidden" }}>
          {data.moduleData.description.slice(0, 60)}...
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: c.border }} />
    </div>
  );
};
