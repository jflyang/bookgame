import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";

function getEdgeColor(props: EdgeProps): string {
  if (props.sourceHandleId === "branch_0") return "#22c55e"; // 是/通过 → 绿
  if (props.sourceHandleId === "branch_1") return "#ef4444"; // 否/拒绝 → 红
  if (props.data?.routeKey === "satisfied") return "#22c55e";
  const style = props.style as Record<string, unknown> | undefined;
  if (style?.stroke) return style.stroke as string;
  return "#6b7280"; // 默认灰
}

function getEdgeDash(props: EdgeProps): string | undefined {
  if (props.sourceHandleId === "branch_1") return "6 3"; // 否/拒绝 → 虚线
  if (props.style && typeof props.style === "object" && (props.style as any).strokeDasharray) {
    return (props.style as any).strokeDasharray;
  }
  return undefined;
}

export function ColoredEdge(props: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath(props);
  const color = getEdgeColor(props);
  const dash = getEdgeDash(props);
  const label = (props.label as string) || props.data?.label as string || "";

  return (
    <>
      <BaseEdge
        id={props.id}
        path={edgePath}
        style={{ stroke: color, strokeWidth: 2.5, strokeDasharray: dash }}
        markerEnd={props.markerEnd}
        interactionWidth={20}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: "var(--surface)",
              border: `1px solid ${color}`,
              borderRadius: "var(--r-sm)",
              padding: "1px 8px",
              fontSize: 10,
              fontWeight: 600,
              color,
              pointerEvents: "all",
              whiteSpace: "nowrap",
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const edgeTypes = {
  colored: ColoredEdge,
};
