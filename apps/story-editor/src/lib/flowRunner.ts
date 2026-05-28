import type { StoryModule } from "@story-game/shared";
import type { FlowNodeData } from "./flowTypes.js";

// ─── Types ───

export interface ConsoleEntry {
  type: "narrative" | "dialogue" | "system" | "judgment" | "result" | "divider" | "title" | "choice_prompt";
  text: string;
  character?: string;
  action?: string;
  details?: { label: string; passed: boolean }[];
  passed?: boolean;
}

export interface ChoiceOption {
  index: number;
  label: string;
  handleId: string;
}

export type RunStatus = "idle" | "running" | "waiting_choice" | "finished";

export interface StepResult {
  entries: ConsoleEntry[];
  nextNodeId: string | null;
  choices?: ChoiceOption[];
  isEnd: boolean;
}

// ─── Helpers ───

interface FlowNode {
  id: string;
  type?: string;
  data: FlowNodeData;
  parentId?: string;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  data?: { routeKey?: string; condition?: string };
}

function findOutgoing(nodeId: string, edges: FlowEdge[]): FlowEdge[] {
  return edges.filter((e) => e.source === nodeId);
}

function findNode(nodeId: string, nodes: FlowNode[]): FlowNode | undefined {
  return nodes.find((n) => n.id === nodeId);
}

function findModule(moduleRef: string | undefined, modules: StoryModule[]): StoryModule | undefined {
  if (!moduleRef) return undefined;
  return modules.find((m) => m.id === moduleRef);
}

// ─── Guidance Parser ───

export function parseGuidance(text: string, _characters?: { id: string; name: string }[]): ConsoleEntry[] {
  if (!text) return [];
  const entries: ConsoleEntry[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { entries.push({ type: "narrative", text: "" }); continue; }

    if (trimmed.startsWith("→")) {
      entries.push({ type: "system", text: trimmed.replace(/^→\s*/, "推进条件：") });
      continue;
    }

    if (trimmed.startsWith("⚠️") || trimmed.startsWith("⚠")) {
      entries.push({ type: "system", text: trimmed.replace(/^⚠️?\s*/, "判定规则：") });
      continue;
    }

    if (/^氛围[：:]/.test(trimmed)) {
      entries.push({ type: "narrative", text: trimmed.replace(/^氛围[：:]\s*/, "") });
      continue;
    }

    // Character dialogue with action: 角色名：**动作**（描述）
    const actionMatch = trimmed.match(/^(.+?)[：:]\s*\*\*(.+?)\*\*\s*(.*)$/);
    if (actionMatch) {
      entries.push({
        type: "dialogue",
        character: actionMatch[1].trim(),
        action: actionMatch[2].trim(),
        text: actionMatch[3].trim() || "",
      });
      continue;
    }

    // Character dialogue with quotes: 角色名：「对话」
    const quoteMatch = trimmed.match(/^(.+?)[：:]\s*「(.+?)」\s*(.*)$/);
    if (quoteMatch) {
      entries.push({
        type: "dialogue",
        character: quoteMatch[1].trim(),
        text: quoteMatch[2].trim() + (quoteMatch[3] ? " " + quoteMatch[3].trim() : ""),
      });
      continue;
    }

    // Character action without quotes: 角色名：其余文本
    const charMatch = trimmed.match(/^(.+?)[：:]\s*(.+)$/);
    if (charMatch) {
      entries.push({
        type: "dialogue",
        character: charMatch[1].trim(),
        text: charMatch[2].trim(),
      });
      continue;
    }

    entries.push({ type: "narrative", text: trimmed });
  }

  return entries;
}

// ─── Step Runner ───

export function runStep(
  nodeId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
  modules: StoryModule[],
): StepResult {
  const node = findNode(nodeId, nodes);
  if (!node) {
    return { entries: [{ type: "system", text: `节点 ${nodeId} 未找到` }], nextNodeId: null, isEnd: true };
  }

  const outgoing = findOutgoing(nodeId, edges);
  const data = node.data;
  const entries: ConsoleEntry[] = [];

  switch (node.type) {
    case "start": {
      entries.push({ type: "system", text: "流程开始" });
      if (data.label) entries.push({ type: "title", text: String(data.label) });
      break;
    }

    case "end": {
      entries.push({ type: "result", text: "流程结束", passed: true });
      return { entries, nextNodeId: null, isEnd: true };
    }

    case "module": {
      const modRef = data.moduleRef;
      const mod = findModule(modRef, modules);
      const title = mod?.title || String(data.label || "未命名模块");
      entries.push({ type: "divider", text: "" });
      entries.push({ type: "title", text: title });

      if (mod?.description) {
        entries.push({ type: "narrative", text: mod.description });
      }

      if (mod?.guidance) {
        const guidanceEntries = parseGuidance(mod.guidance);
        entries.push(...guidanceEntries);
      }
      entries.push({ type: "divider", text: "" });
      break;
    }

    case "choice": {
      entries.push({ type: "divider", text: "" });
      entries.push({ type: "system", text: "抉择时刻" });
      const branches = (data.branches || []) as Array<{ choiceText?: string }>;
      if (branches.length > 0) {
        entries.push({
          type: "choice_prompt",
          text: "请选择：",
        });
        const choices: ChoiceOption[] = branches.map((b, i) => ({
          index: i,
          label: b.choiceText || `选项 ${i + 1}`,
          handleId: `branch_${i}`,
        }));
        return { entries, nextNodeId: nodeId, choices, isEnd: false };
      }
      break;
    }

    case "judgment": {
      entries.push({ type: "divider", text: "" });
      entries.push({ type: "system", text: "判定" });

      const judgeData = (data.judgmentData || {}) as Record<string, unknown>;
      const scoringMethods = (judgeData.scoringMethods || []) as Array<{ name?: string; min?: number; max?: number }>;
      const details: { label: string; passed: boolean }[] = [];
      let allPassed = true;

      if (scoringMethods.length > 0) {
        for (const method of scoringMethods) {
          const min = typeof method.min === "number" ? method.min : 0;
          const max = typeof method.max === "number" ? method.max : 100;
          const score = Math.floor(Math.random() * (max - min + 1)) + min;
          const threshold = min + (max - min) * 0.6;
          const passed = score >= threshold;
          if (!passed) allPassed = false;
          details.push({ label: `${method.name || "评分"} (${score}/${max})`, passed });
        }
      } else {
        const roll = Math.random();
        const passed = roll >= 0.4;
        details.push({ label: `随机判定 (${Math.floor(roll * 100)}%)`, passed });
        allPassed = passed;
      }

      entries.push({ type: "judgment", text: "判定结果：", details, passed: allPassed });

      const resultText = allPassed ? "通过 → 进入下一节点" : "未通过 → 进入备用路线";
      entries.push({ type: "result", text: resultText, passed: allPassed });
      entries.push({ type: "divider", text: "" });

      // Randomly pick branch: 60% chance branch_0 if passed, branch_1 if not
      const targetHandle = allPassed ? "branch_0" : "branch_1";
      const targetEdge = outgoing.find((e) => e.sourceHandle === targetHandle) || outgoing[0];
      return {
        entries,
        nextNodeId: targetEdge?.target || null,
        isEnd: !targetEdge,
      };
    }

    case "randomJudgment": {
      entries.push({ type: "divider", text: "" });
      entries.push({ type: "system", text: "随机判定" });

      const roll = Math.random();
      const passed = roll >= 0.5;
      entries.push({
        type: "judgment",
        text: `随机判定 (${Math.floor(roll * 100)}%)：`,
        details: [{ label: `概率 50%`, passed }],
        passed,
      });

      const resultText = passed ? "命中 → 继续" : "未命中 → 备用路线";
      entries.push({ type: "result", text: resultText, passed });
      entries.push({ type: "divider", text: "" });

      const targetHandle = passed ? "branch_0" : "branch_1";
      const targetEdge = outgoing.find((e) => e.sourceHandle === targetHandle) || outgoing[0];
      return {
        entries,
        nextNodeId: targetEdge?.target || null,
        isEnd: !targetEdge,
      };
    }

    case "eventTrigger": {
      entries.push({ type: "divider", text: "" });
      entries.push({ type: "system", text: `⚡ 事件：${data.label}` });
      const desc = data.eventDescription as string | undefined;
      if (desc) entries.push({ type: "narrative", text: desc });
      entries.push({ type: "divider", text: "" });
      break;
    }

    case "randomEvent": {
      entries.push({ type: "divider", text: "" });
      entries.push({ type: "system", text: `🎲 随机事件：${data.label}` });
      const pool = (data.randomPool || []) as Array<{ id: string; title: string }>;
      if (pool.length > 0) {
        const picked = pool[Math.floor(Math.random() * pool.length)];
        entries.push({ type: "result", text: `抽中：${picked.title}`, passed: true });
      } else {
        entries.push({ type: "narrative", text: "（空随机池）" });
      }
      entries.push({ type: "divider", text: "" });
      break;
    }

    case "loop": {
      entries.push({ type: "divider", text: "" });
      entries.push({ type: "system", text: `🔄 ${data.label || "循环"}` });
      const childCount = nodes.filter((n) => n.parentId === nodeId).length;
      if (childCount > 0) {
        entries.push({ type: "narrative", text: `包含 ${childCount} 个子节点` });
      }
      entries.push({ type: "divider", text: "" });
      break;
    }

    case "dailyTrigger": {
      entries.push({ type: "system", text: `📅 日常触发：${data.label}` });
      break;
    }

    default: {
      // phaseGroup or unknown: just skip through
      entries.push({ type: "system", text: `${data.label || node.type || "未知节点"}` });
      break;
    }
  }

  // Find next node from outgoing edges (non-branching path)
  // For choice nodes, we already returned; for judgment, we already picked a branch
  const nextEdge = outgoing[0];
  const nextNodeId = node.type === "end" ? null : (nextEdge?.target || null);

  return { entries, nextNodeId, isEnd: !nextNodeId };
}
