import { Handle, Position } from "@xyflow/react";
import type { FC } from "react";

export const EndNode: FC<{ data: { label: string }; selected?: boolean }> = ({ selected }) => {
  return (
    <div style={{
      background: "#ef4444", border: `2px solid ${selected ? "#000" : "#dc2626"}`,
      borderRadius: 24, padding: "8px 24px", color: "#fff",
      fontSize: 14, fontWeight: 700, textAlign: "center",
      boxShadow: selected ? "0 0 0 2px #000" : undefined,
    }}>
      <Handle type="target" position={Position.Top} style={{ background: "#dc2626" }} />
      🏁 END
    </div>
  );
};
