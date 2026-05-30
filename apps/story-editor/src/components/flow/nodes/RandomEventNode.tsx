import { Handle, Position } from "@xyflow/react";
import type { FC } from "react";
import type { FlowNodeData } from "../../../lib/flowTypes.js";

/**
 * 随机事件节点 — 从事件池中随机选择一个执行，执行完毕后继续往下走。
 * 
 * 数据结构：
 * - data.label: 节点标题
 * - data.randomPool: Array<{ id: string; title: string }> — 可能发生的事件列表
 * 
 * 连接方式：
 * - 左侧入口（target）← 上一个节点
 * - 右侧出口（source）→ 下一个节点（无论随机到哪个事件，执行完都走这条线）
 */
export const RandomEventNode: FC<{ data: FlowNodeData; selected?: boolean }> = ({ data, selected }) => {
  const pool = (data.randomPool || []) as Array<{ id: string; title: string }>;
  return (
    <div style={{
      background: "#fef3c7", border: `2px dashed ${selected ? "#000" : "#d97706"}`,
      borderRadius: 10, padding: "10px 14px", minWidth: 170, maxWidth: 240,
      fontSize: 11, color: "#78350f", boxShadow: selected ? "0 0 0 2px #000" : undefined,
    }}>
      <Handle type="target" position={Position.Left} style={{ background: "#d97706" }} />

      <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 14 }}>🎲</span> {data.label || "随机事件"}
      </div>

      {pool.length > 0 ? (
        <div style={{ fontSize: 10, opacity: 0.8, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>事件池 ({pool.length})：</div>
          {pool.slice(0, 5).map((p, i) => (
            <div key={p.id || i} style={{ paddingLeft: 4 }}>· {p.title}</div>
          ))}
          {pool.length > 5 && <div style={{ paddingLeft: 4, opacity: 0.5 }}>... +{pool.length - 5} 更多</div>}
        </div>
      ) : (
        <div style={{ fontSize: 10, opacity: 0.5, fontStyle: "italic" }}>双击添加事件</div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: "#d97706" }} />
    </div>
  );
};
