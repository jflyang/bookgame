import { Handle, Position, NodeResizer } from "@xyflow/react";
import type { FC, PropsWithChildren } from "react";
import type { FlowNodeData } from "../../../lib/flowTypes.js";

export const PhaseGroupNode: FC<PropsWithChildren<{ data: FlowNodeData; selected?: boolean }>> = ({ data, children, selected }) => {
  return (
    <div style={{
      background: "rgba(148,163,184,0.08)", border: "2px dashed rgba(148,163,184,0.4)",
      borderRadius: 16, padding: "28px 16px 16px", minWidth: 400, minHeight: 160,
      width: "100%", height: "100%",
      position: "relative",
    }}>
      <NodeResizer
        minWidth={300}
        minHeight={120}
        isVisible={selected}
        lineStyle={{ borderColor: "#94a3b8" }}
        handleStyle={{ background: "#94a3b8", border: "none", width: 10, height: 10 }}
      />
      <Handle type="target" position={Position.Left} style={{ background: "#94a3b8" }} />
      <div style={{
        fontSize: 13, fontWeight: 700, color: "#64748b",
        marginBottom: 8, paddingLeft: 4,
      }}>
        📁 {data.label}
        {selected && <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: 8 }}>拖角缩放</span>}
      </div>
      {children}
      <Handle type="source" position={Position.Right} style={{ background: "#94a3b8" }} />
    </div>
  );
};
