import { Handle, Position } from "@xyflow/react";
import type { FC } from "react";

export const StartNode: FC<{ data: { label: string }; selected?: boolean }> = ({ selected }) => {
  return (
    <div style={{
      background: "#22c55e", border: `2px solid ${selected ? "#000" : "#16a34a"}`,
      borderRadius: 24, padding: "8px 24px", color: "#fff",
      fontSize: 14, fontWeight: 700, textAlign: "center",
      boxShadow: selected ? "0 0 0 2px #000" : undefined,
    }}>
      ▶ START
      <Handle type="source" position={Position.Bottom} style={{ background: "#16a34a" }} />
    </div>
  );
};
