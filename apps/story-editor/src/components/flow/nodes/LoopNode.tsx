import { Handle, Position } from "@xyflow/react";
import type { FC } from "react";
import type { FlowNodeData } from "../../../lib/flowTypes.js";

/**
 * 循环节点 — 重复执行循环体，直到满足退出条件。
 *
 * 连接方式：
 * - 左侧入口（target）← 上一个节点进入循环
 * - 右上出口（source, id="loop_body"）→ 连到循环体（故事情节节点），循环体执行完再连回本节点
 * - 右下出口（source, id="loop_exit"）→ 退出循环后的下一个节点
 *
 * 退出条件（任一满足即退出）：
 * - 达到最大循环次数（loopMaxCycles）
 * - AI 判断退出条件成立（loopExitCondition 文本描述）
 * - 玩家在循环体中选择退出（由循环体内的抉择节点控制）
 *
 * 数据字段：
 * - data.label: 循环名称（如"日常修炼"）
 * - data.loopMaxCycles: 最大循环次数，null 表示无限
 * - data.loopExitCondition: 退出条件描述文本
 * - data.loopBodyLabel: 循环体简述
 */
export const LoopNode: FC<{ data: FlowNodeData; selected?: boolean }> = ({ data, selected }) => {
  const maxCycles = data.loopMaxCycles;
  const exitCondition = data.loopExitCondition as string | undefined;
  const bodyLabel = data.loopBodyLabel as string | undefined;

  return (
    <div style={{
      background: "#ecfdf5", border: `2px solid ${selected ? "#000" : "#10b981"}`,
      borderRadius: 12, padding: "12px 16px", minWidth: 190, maxWidth: 260,
      fontSize: 11, color: "#064e3b", boxShadow: selected ? "0 0 0 2px #000" : undefined,
    }}>
      {/* 入口 */}
      <Handle type="target" position={Position.Left} style={{ background: "#10b981" }} />

      {/* 标题 */}
      <div style={{ fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 15 }}>🔁</span> {data.label || "循环"}
      </div>

      {/* 循环信息 */}
      <div style={{ fontSize: 10, lineHeight: 1.6, opacity: 0.85 }}>
        {maxCycles != null && (
          <div>⏱ 最多 <b>{maxCycles}</b> 轮</div>
        )}
        {!maxCycles && (
          <div>⏱ 无限循环</div>
        )}
        {exitCondition && (
          <div style={{ marginTop: 2 }}>🚪 退出：{exitCondition}</div>
        )}
        {bodyLabel && (
          <div style={{ marginTop: 2 }}>📋 循环体：{bodyLabel}</div>
        )}
        {!exitCondition && !bodyLabel && (
          <div style={{ opacity: 0.5, fontStyle: "italic" }}>双击编辑循环配置</div>
        )}
      </div>

      {/* 退出出口（右上） */}
      <Handle
        type="source"
        position={Position.Right}
        id="loop_exit"
        style={{ background: "#ef4444", top: "30%" }}
      />
      <div style={{
        position: "absolute", right: -50, top: "26%",
        fontSize: 9, color: "#ef4444", fontWeight: 600, whiteSpace: "nowrap",
      }}>
        退出 →
      </div>

      {/* 循环体出口（右下） */}
      <Handle
        type="source"
        position={Position.Right}
        id="loop_body"
        style={{ background: "#10b981", top: "70%" }}
      />
      <div style={{
        position: "absolute", right: -50, top: "66%",
        fontSize: 9, color: "#10b981", fontWeight: 600, whiteSpace: "nowrap",
      }}>
        循环体 →
      </div>
    </div>
  );
};
