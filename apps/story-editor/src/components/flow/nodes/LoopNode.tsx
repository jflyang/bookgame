import { Handle, Position, NodeResizer } from "@xyflow/react";
import type { FC, PropsWithChildren } from "react";
import type { FlowNodeData } from "../../../lib/flowTypes.js";

export const LoopNode: FC<PropsWithChildren<{ data: FlowNodeData; selected?: boolean }>> = ({ data, children, selected }) => {
  const loop = data.loopData;
  return (
    <div style={{
      background: "rgba(14,165,233,0.06)", border: `2px dashed ${selected ? "#0ea5e9" : "rgba(14,165,233,0.4)"}`,
      borderRadius: 16, padding: "28px 16px 16px", minWidth: 600, minHeight: 300,
      width: "100%", height: "100%",
      position: "relative",
    }}>
      <NodeResizer
        minWidth={400}
        minHeight={200}
        isVisible={selected}
        lineStyle={{ borderColor: "#0ea5e9" }}
        handleStyle={{ background: "#0ea5e9", border: "none", width: 10, height: 10 }}
      />
      <Handle type="target" position={Position.Left} style={{ background: "#0ea5e9" }} />
      <div style={{
        fontSize: 13, fontWeight: 700, color: "#0ea5e9",
        marginBottom: 8, paddingLeft: 4, display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ fontSize: 16 }}>🔄</span> {data.label || "侍寝循环"}
        {loop && (
          <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.6 }}>
            起始{loop.initialCycle || 1} · 最大{loop.maxCycles || "∞"}轮
          </span>
        )}
        {selected && <span style={{ fontSize: 10, color: "var(--text-faint)" }}>拖角缩放</span>}
      </div>
      {children}
      <Handle type="source" position={Position.Right} id="loop_exit"
        style={{ background: "#22c55e" }} />
    </div>
  );
};
