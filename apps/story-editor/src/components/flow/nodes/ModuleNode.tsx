import { Handle, Position } from "@xyflow/react";
import type { FC } from "react";
import type { FlowNodeData } from "../../../lib/flowTypes.js";
import { useEditorStore } from "../../../store/editorStore.js";

const COLORS: Record<string, { bg: string; border: string; text: string }> = {
  training:   { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  serving:    { bg: "#fce7f3", border: "#ec4899", text: "#9d174d" },
  punishment: { bg: "#fee2e2", border: "#ef4444", text: "#991b1b" },
  daily:      { bg: "#f3f4f6", border: "#6b7280", text: "#374151" },
  finale:     { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
};

export const ModuleNode: FC<{ data: FlowNodeData; selected?: boolean }> = ({ data, selected }) => {
  const c = COLORS[data.colorKey || "training"] || COLORS.training;
  const manifest = useEditorStore((s) => s.manifest);

  // Check for bound performances
  const sourceStage = data.moduleData?.sourceStage;
  const perfs = (manifest?.performances || {}) as Record<string, any>;
  const boundPerfs = sourceStage
    ? Object.values(perfs).filter((p: any) => p.trigger?.type === "stageEnter" && p.trigger?.stageId === sourceStage)
    : [];
  const hasAudio = boundPerfs.some((p: any) => p.renderer === "audio");
  const hasVisual = boundPerfs.some((p: any) => p.renderer === "image" || p.renderer === "layeredCss" || p.renderer === "video");

  return (
    <div style={{
      background: c.bg, border: `2px solid ${selected ? "#000" : c.border}`,
      borderRadius: 8, padding: "10px 14px", minWidth: 160, maxWidth: 220,
      fontSize: 12, color: c.text, boxShadow: selected ? "0 0 0 2px #000" : undefined,
      position: "relative",
    }}>
      <Handle type="target" position={Position.Left} style={{ background: c.border }} />
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{data.label}</div>
      {data.moduleData?.description && (
        <div style={{ fontSize: 10, opacity: 0.7, lineHeight: 1.3, maxHeight: 40, overflow: "hidden" }}>
          {data.moduleData.description.slice(0, 60)}...
        </div>
      )}
      {/* Performance indicators */}
      {(hasAudio || hasVisual) && (
        <div style={{
          position: "absolute", top: -8, right: -4,
          display: "flex", gap: 2,
        }}>
          {hasAudio && <span title="已绑定音频演出" style={{ fontSize: 12, background: "#fff", borderRadius: "50%", padding: "1px 3px", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>🔊</span>}
          {hasVisual && <span title="已绑定视觉演出" style={{ fontSize: 12, background: "#fff", borderRadius: "50%", padding: "1px 3px", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>🖼️</span>}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: c.border }} />
    </div>
  );
};
