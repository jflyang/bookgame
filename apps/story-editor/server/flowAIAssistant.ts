import type { StoryModule, FlowDefinition, Scenario, ScenarioStageDetail } from "@story-game/shared";

// ─── Types ───

export interface FlowAIContext {
  storyTitle: string;
  storyDescription: string;
  storySetting: string;
  characters: { id: string; name: string; role: string; personaPrompt?: string }[];
  flow: FlowDefinition;
  modules: StoryModule[];
  nodes: FlowAINode[];
  edges: FlowAIEdge[];
  existingScenario?: Scenario;
}

export interface FlowAINode {
  id: string;
  type: string;
  data: Record<string, unknown>;
  parentId?: string;
  position: { x: number; y: number };
}

export interface FlowAIEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface FlowAnalysisReport {
  issues: {
    severity: "error" | "warn" | "info";
    category: "logic_break" | "missing_motivation" | "pacing" | "character_gap" | "orphan_module";
    title: string;
    description: string;
    affectedModules: string[];
    suggestion: string;
  }[];
  summary: string;
}

export interface GenerateScenarioOptions {
  mode: "full" | "incremental";  // full = rewrite all, incremental = fill gaps
}

// ─── AI API caller ───

interface AiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function getAiConfig(): AiConfig {
  const apiKey = process.env.DEEPSEEK_API_KEY || "";
  return {
    apiKey,
    baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
  };
}

async function callAI(systemPrompt: string, userPrompt: string, maxTokens = 4000): Promise<string> {
  const config = getAiConfig();
  if (!config.apiKey) throw new Error("DEEPSEEK_API_KEY 未配置");

  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.7,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI 请求失败: ${response.status} ${text}`);
  }

  const data = await response.json() as any;
  const content = data?.choices?.[0]?.message?.content || "";
  if (!content) throw new Error("AI 返回空内容");
  return content;
}

function extractJSON(text: string): unknown {
  const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Try to find JSON object between { and }
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch { /* fall through */ }
    }
    return null;
  }
}

// ─── Context builder ───

export function buildFlowContext(ctx: FlowAIContext): string {
  const lines: string[] = [];

  // ═══ Story Overview ═══
  lines.push("=== 故事全貌 ===");
  lines.push(`标题：${ctx.storyTitle}`);
  if (ctx.storyDescription) lines.push(`描述：${ctx.storyDescription}`);
  if (ctx.storySetting) lines.push(`世界观/设定：${ctx.storySetting.slice(0, 2000)}`);
  lines.push("");

  // ═══ Characters ═══
  if (ctx.characters.length > 0) {
    lines.push("=== 角色列表 ===");
    for (const c of ctx.characters) {
      const persona = c.personaPrompt ? ` — ${c.personaPrompt.slice(0, 200)}` : "";
      lines.push(`  - ${c.name} (${c.role})${persona}`);
    }
    lines.push("");
  }

  // ═══ Phase Structure ═══
  const nodeMap = new Map(ctx.nodes.map((n) => [n.id, n]));
  const moduleById = new Map(ctx.modules.map((m) => [m.id, m]));
  const groupNodes = ctx.nodes.filter((n) => n.type === "phaseGroup");
  const loopNodes = ctx.nodes.filter((n) => n.type === "loop");

  lines.push("=== 阶段结构 ===");

  // Phase groups
  const phaseChildren = new Map<string, FlowAINode[]>();
  for (const g of groupNodes) {
    const children = ctx.nodes
      .filter((n) => n.parentId === g.id && (n.type === "module" || n.type === "choice"))
      .sort((a, b) => a.position.x - b.position.x);
    phaseChildren.set(g.id, children);
  }

  for (const g of groupNodes) {
    const label = (g.data.label as string) || g.id;
    lines.push(`📁 ${label}`);
    const children = phaseChildren.get(g.id) || [];
    for (const child of children) {
      const modRef = child.data.moduleRef as string | undefined;
      const mod = modRef ? moduleById.get(modRef) : undefined;
      const childLabel = (child.data.label as string) || child.id;
      const childType = child.type || "module";
      const colorKey = (child.data.colorKey as string) || mod?.type || "training";
      lines.push(`  [${modRef || child.id}] ${childLabel} (${childType}/${colorKey})`);

      // Show module details
      if (mod) {
        if ((mod as any).enterWhen) lines.push(`    进入条件：${(mod as any).enterWhen}`);
        if ((mod as any).description) lines.push(`    描述：${(mod as any).description}`);
        if ((mod as any).guidance) lines.push(`    AI引导：${(mod as any).guidance.slice(0, 200)}`);
        if ((mod as any).directive) lines.push(`    必须事件：${(mod as any).directive}`);
      }

      // Outgoing edges
      const outgoing = ctx.edges.filter((e) => e.source === child.id);
      for (const e of outgoing) {
        const target = nodeMap.get(e.target);
        const targetLabel = target ? ((target.data.label as string) || target.id) : e.target;
        const edgeLabel = e.label ? ` [${e.label}]` : "";
        const handle = e.sourceHandle ? ` (${e.sourceHandle})` : "";
        lines.push(`    → 连接${handle}${edgeLabel}：[${e.target}] ${targetLabel}`);
      }
    }
    lines.push("");
  }

  // Loop groups
  for (const loop of loopNodes) {
    const label = (loop.data.label as string) || loop.id;
    lines.push(`🔄 ${label}`);
    const children = ctx.nodes
      .filter((n) => n.parentId === loop.id)
      .sort((a, b) => a.position.x - b.position.x);
    for (const child of children) {
      const childLabel = (child.data.label as string) || child.id;
      lines.push(`  [${child.id}] ${childLabel} (${child.type})`);
      // Show branches for judgment nodes
      if (child.type === "judgment") {
        const branches = (child.data.branches as any[]) || [];
        for (const b of branches) {
          lines.push(`    分支：${b.choiceText || "?"} → ${b.targetStage || "?"}`);
        }
      }
    }
    lines.push("");
  }

  // Free modules (no parent)
  const assignedIds = new Set<string>();
  for (const [, children] of phaseChildren) for (const c of children) assignedIds.add(c.id);
  for (const loop of loopNodes) {
    for (const c of ctx.nodes.filter((n) => n.parentId === loop.id)) assignedIds.add(c.id);
  }
  const freeNodes = ctx.nodes.filter(
    (n) => (n.type === "module" || n.type === "choice") && !assignedIds.has(n.id)
  );
  if (freeNodes.length > 0) {
    lines.push("📋 未分组模块（游离在外）");
    for (const n of freeNodes) {
      lines.push(`  [${n.id}] ${(n.data.label as string) || n.id} (${n.type})`);
    }
    lines.push("");
  }

  // ═══ Connection Graph ═══
  lines.push("=== 连线图 ===");
  const startNode = ctx.nodes.find((n) => n.type === "start");
  const endNode = ctx.nodes.find((n) => n.type === "end");

  // Build adjacency for path tracing
  const adjacency = new Map<string, string[]>();
  for (const e of ctx.edges) {
    const targets = adjacency.get(e.source) || [];
    targets.push(e.target);
    adjacency.set(e.source, targets);
  }

  // Trace paths from START
  if (startNode) {
    const start = startNode; // capture for nested function
    const visited = new Set<string>();
    function tracePath(nodeId: string, indent: string): void {
      if (visited.has(nodeId) && nodeId !== start.id) return;
      visited.add(nodeId);
      const node = nodeMap.get(nodeId);
      const label = node ? ((node.data.label as string) || nodeId) : nodeId;
      const type = node ? `(${node.type})` : "";

      if (nodeId === start.id) {
        lines.push(`START ${type}`);
      } else {
        lines.push(`${indent}→ ${label} ${type}`);
      }

      const nextIds = adjacency.get(nodeId) || [];
      if (nextIds.length > 1) {
        // Branch point
        nextIds.forEach((nextId, i) => {
          const edge = ctx.edges.find((e) => e.source === nodeId && e.target === nextId);
          const branchLabel = edge?.label || edge?.sourceHandle || `分支${i + 1}`;
          const nextNode = nodeMap.get(nextId);
          const nextLabel = nextNode ? ((nextNode.data.label as string) || nextId) : nextId;
          lines.push(`${indent}  ├─ [${branchLabel}] → ${nextLabel}`);
          if (nextId) tracePath(nextId, `${indent}  │  `);
        });
      } else if (nextIds.length === 1) {
        tracePath(nextIds[0], indent);
      } else {
        if (node?.type === "end") {
          lines.push(`${indent}(END)`);
        } else {
          lines.push(`${indent}(无后续连接 ⚠️)`);
        }
      }
    }

    tracePath(startNode.id, "  ");
    lines.push("");
  }

  // ═══ Existing Scenario Status ═══
  if (ctx.existingScenario) {
    lines.push("=== 当前 Scenario 状态 ===");
    const s = ctx.existingScenario;
    lines.push(`Scenario ID: ${s.id}`);
    lines.push(`标题：${s.title}`);
    lines.push(`总阶段数：${s.stages.length}`);
    const detailsMap = new Map((s.stageDetails || []).map((d) => [d.id, d]));
    const withGuidance = (s.stageDetails || []).filter((d) => d.guidance?.trim()).length;
    const withDirective = (s.stageDetails || []).filter((d) => d.directive?.trim()).length;
    const missingEnterWhen = (s.stageDetails || []).filter((d) => !d.enterWhen?.trim());
    const missingGuidance = (s.stageDetails || []).filter((d) => !d.guidance?.trim());

    lines.push(`有 guidance：${withGuidance}/${s.stages.length}`);
    lines.push(`有 directive：${withDirective}/${s.stages.length}`);
    if (missingEnterWhen.length > 0) {
      lines.push(`缺少 enterWhen：${missingEnterWhen.map((d) => d.id).join(", ")}`);
    }
    if (missingGuidance.length > 0) {
      lines.push(`缺少 guidance：${missingGuidance.map((d) => d.id).join(", ")}`);
    }
    lines.push("");

    // Existing stage details summary
    lines.push("已有阶段详情：");
    for (const d of (s.stageDetails || [])) {
      const title = d.title ? `"${d.title}"` : "";
      const hasGuidance = d.guidance ? "✅" : "❌";
      const hasDirective = d.directive ? "✅" : "❌";
      const hasEnterWhen = d.enterWhen ? "✅" : "❌";
      lines.push(`  ${d.id} ${title} guidance:${hasGuidance} directive:${hasDirective} enterWhen:${hasEnterWhen}`);
    }
    lines.push("");
  }

  // ═══ Module Details (full) ═══
  if (ctx.modules.length > 0) {
    lines.push("=== 模块详情 ===");
    for (const mod of ctx.modules) {
      lines.push(`--- ${mod.title || mod.id} (${mod.id}) ---`);
      lines.push(`  类型：${mod.type || "unknown"}`);
      if ((mod as any).sourceStage) lines.push(`  来源阶段：${(mod as any).sourceStage}`);
      if ((mod as any).description) lines.push(`  描述：${(mod as any).description}`);
      if ((mod as any).enterWhen) lines.push(`  进入条件：${(mod as any).enterWhen}`);
      if ((mod as any).guidance) lines.push(`  AI引导：${(mod as any).guidance}`);
      if ((mod as any).directive) lines.push(`  必须事件：${(mod as any).directive}`);
      if ((mod as any).exitCondition) lines.push(`  退出条件：${(mod as any).exitCondition}`);
      if ((mod as any).requiredCharacters?.length) {
        lines.push(`  涉及角色：${(mod as any).requiredCharacters.join(", ")}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ─── ① Flow Analysis ───

const ANALYZE_SYSTEM = `你是互动叙事游戏的结构分析师。用户在编辑一个故事流程编辑器。
分析以下流程结构，找出逻辑和叙事问题。输出 JSON 格式的分析报告。

输出格式：
{
  "issues": [
    {
      "severity": "error|warn|info",
      "category": "logic_break|missing_motivation|pacing|character_gap|orphan_module",
      "title": "简短标题",
      "description": "详细分析",
      "affectedModules": ["module_id_1", "module_id_2"],
      "suggestion": "具体的修复建议"
    }
  ],
  "summary": "整体评估（2-3句话）"
}

检查要点：
1. 逻辑断裂：enterWhen 条件与前置模块内容不匹配
2. 动机缺失：模块间跳转缺乏叙事动机或过渡
3. 节奏问题：连续多个同类型模块、缺少起伏、重要转折缺少铺垫
4. 角色缺口：需要出现推动剧情的角色未出现
5. 游离模块：不在任何阶段框内的模块，需要归组或删除
6. 死路：已连接的模块通向死胡同，没有出口

分析要具体、实用，不要空洞。每个问题都要指出具体模块 ID。`;

export async function analyzeFlow(ctx: FlowAIContext): Promise<FlowAnalysisReport> {
  const contextText = buildFlowContext(ctx);
  const userPrompt = `请分析以下故事流程的结构问题：\n\n${contextText}`;

  const result = await callAI(ANALYZE_SYSTEM, userPrompt, 4000);
  const parsed = extractJSON(result) as FlowAnalysisReport | null;

  if (parsed && parsed.issues) {
    return parsed;
  }

  // Fallback: return raw text as summary
  return {
    issues: [],
    summary: result,
  };
}

// ─── ② Scenario Generation ───

const GENERATE_SYSTEM = `你是互动叙事游戏的剧情设计师。你的任务是根据流程结构，为每个阶段生成详细的 scenario stageDetail。

每个 stageDetail 必须包含：
- id: 模块 ID（原样保留）
- title: 有吸引力的中文标题（4-8字，如"囚鸟入笼""蜜穴初尝"）
- description: 1-2句概述此阶段的核心事件
- enterWhen: 从上一阶段进入此阶段的叙事条件（自然语言，如"小薇被困在调教室无处可逃"）
- guidance: 给 LLM 游戏引擎的创作引导。包含：氛围基调、角色行为方向、感官细节焦点、节奏控制、推进条件（用 → 标记）
- directive: 此阶段必须发生的具体事件。角色必须说的话/做的动作。用角色名开头。

输出完整的 scenario JSON 对象：
{
  "id": "原 scenario ID（如有）或新建",
  "title": "故事标题",
  "premise": "故事前提（2-3句概述）",
  "currentStage": "流程图的第一个模块 ID",
  "stages": ["所有模块 ID 的有序列表"],
  "stageDetails": [ 每个模块的详细配置 ]
}

重要原则：
- 必须覆盖流程图中所有模块
- 连线决定顺序，分支模块的两个子路径都要有完整 stageDetail
- guidance 要具体可用，不是空泛的"营造氛围"
- directive 要有可执行性，角色具体说什么、做什么
- 如果已有 scenario，保留其中好的 guidance/directive，只修复有问题的
- 注意阶段间的连贯性：enterWhen 要能从前一阶段自然引出`;

export async function generateScenario(
  ctx: FlowAIContext,
  options: GenerateScenarioOptions = { mode: "full" }
): Promise<{ scenario: Partial<Scenario>; rawText: string }> {
  const contextText = buildFlowContext(ctx);
  const modeHint = options.mode === "incremental"
    ? "请增量更新：保留已有的 guidance 和 directive（如果合适），只为缺失或质量差的部分生成新内容。"
    : "请完全重写：忽略已有数据，为所有模块生成全新的 stageDetail。";

  const userPrompt = `${modeHint}\n\n流程结构：\n\n${contextText}`;

  const result = await callAI(GENERATE_SYSTEM, userPrompt, 8000);
  const parsed = extractJSON(result) as Partial<Scenario> | null;

  return {
    scenario: parsed || {},
    rawText: result,
  };
}

// ─── ③ Stage Refinement ───

const REFINE_SYSTEM = `你是互动叙事游戏的剧情精修师。你的任务是根据上下文和用户指令，精修一个故事阶段。

输出该阶段的 stageDetail JSON（仅此一个阶段）：
{
  "id": "阶段ID",
  "title": "标题",
  "description": "描述",
  "enterWhen": "进入条件",
  "guidance": "AI引导",
  "directive": "必须事件"
}

精修要点：
- 保持与前后阶段的叙事连贯性
- guidance 要具体：氛围 + 角色行为 + 感官焦点 + →推进条件
- directive 要有可执行的具体动作/台词
- 精确响应用户的具体要求（如"更煽情""更紧张""加入角色X"）`;

export async function refineStage(
  ctx: FlowAIContext,
  targetModuleId: string,
  userInstruction: string
): Promise<{ stageDetail: Partial<ScenarioStageDetail>; rawText: string }> {
  // Build focused context: target module + 2 before + 2 after
  const moduleById = new Map(ctx.modules.map((m) => [m.id, m]));
  const targetMod = moduleById.get(targetModuleId);

  // Build ordered module list from flow
  const orderedModules: string[] = [];
  for (const [, phase] of Object.entries(ctx.flow.linearPhases)) {
    for (const modId of phase.sequence) {
      if (!orderedModules.includes(modId)) orderedModules.push(modId);
    }
  }
  // Add finale
  if (ctx.flow.finaleSequence?.sequence) {
    for (const modId of ctx.flow.finaleSequence.sequence) {
      if (!orderedModules.includes(modId)) orderedModules.push(modId);
    }
  }

  const targetIdx = orderedModules.indexOf(targetModuleId);
  const contextModuleIds: string[] = [];
  for (let i = Math.max(0, targetIdx - 2); i <= Math.min(orderedModules.length - 1, targetIdx + 2); i++) {
    contextModuleIds.push(orderedModules[i]);
  }

  // Build minimal context
  const lines: string[] = [];
  lines.push("=== 角色 ===");
  for (const c of ctx.characters) {
    lines.push(`${c.name} (${c.role})`);
  }
  lines.push("");
  lines.push("=== 目标模块 ===");
  if (targetMod) {
    lines.push(`ID: ${targetMod.id}`);
    lines.push(`标题: ${targetMod.title || ""}`);
    if ((targetMod as any).description) lines.push(`当前描述: ${(targetMod as any).description}`);
    if ((targetMod as any).guidance) lines.push(`当前 guidance: ${(targetMod as any).guidance}`);
    if ((targetMod as any).directive) lines.push(`当前 directive: ${(targetMod as any).directive}`);
  }
  lines.push("");
  lines.push("=== 上下文（前后阶段）===");
  for (const modId of contextModuleIds) {
    const mod = moduleById.get(modId);
    const marker = modId === targetModuleId ? " ← 目标" : "";
    lines.push(`[${modId}] ${mod?.title || modId}${marker}`);
    if (mod && (mod as any).description) {
      lines.push(`  描述: ${(mod as any).description}`);
    }
  }

  const userPrompt = `用户指令：${userInstruction}\n\n${lines.join("\n")}`;

  const result = await callAI(REFINE_SYSTEM, userPrompt, 2000);
  const parsed = extractJSON(result) as Partial<ScenarioStageDetail> | null;

  return {
    stageDetail: parsed || { id: targetModuleId },
    rawText: result,
  };
}

// ─── Singleton ───

export const flowAIAssistant = {
  analyzeFlow,
  generateScenario,
  refineStage,
  buildFlowContext,
};
