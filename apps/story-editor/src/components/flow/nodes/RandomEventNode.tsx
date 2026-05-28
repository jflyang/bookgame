import { Handle, Position } from "@xyflow/react";
import type { FC } from "react";
import type { FlowNodeData } from "../../../lib/flowTypes.js";

export const RandomEventNode: FC<{ data: FlowNodeData; selected?: boolean }> = ({ data, selected }) => {
  const pool = (data.randomPool || []) as Array<{ id: string; title: string }>;
  return (
    <div style={{
      background: "#fce7f3", border: `2px dashed ${selected ? "#000" : "#ec4899"}`,
      borderRadius: 8, padding: "8px 12px", minWidth: 160, maxWidth: 220,
      fontSize: 11, color: "#831843", boxShadow: selected ? "0 0 0 2px #000" : undefined,
      position: "relative",
    }}>
      {/* Input from top (judgment "否" drops down) */}
      <Handle type="target" position={Position.Top} style={{ background: "#ec4899" }} />

      <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 14 }}>🎲</span> {data.label}
      </div>
      {pool.length > 0 && (
        <div style={{ fontSize: 10, opacity: 0.75 }}>
          随机池 ({pool.length})：
          {pool.slice(0, 4).map((p) => (
            <div key={p.id} style={{ marginLeft: 4 }}>· {p.title}</div>
          ))}
          {pool.length > 4 && <div style={{ marginLeft: 4, opacity: 0.5 }}>... +{pool.length - 4} 更多</div>}
        </div>
      )}

      {/* Output left → loops back to serve module on the left */}
      <Handle type="source" position={Position.Left}
        style={{ background: "#f97316" }} />
      <div style={{ position: "absolute", left: -48, top: "44%", fontSize: 9, color: "#f97316", fontWeight: 600 }}>
        回本轮
      </div>
    </div>
  );
};
