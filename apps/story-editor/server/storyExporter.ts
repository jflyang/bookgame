/**
 * Story Exporter — 将故事包导出为小说 Markdown
 * 
 * 1. resolveLinearPath: 根据用户选择解析线性章节列表
 * 2. generateChapter: 用 AI 生成单章小说内容
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { aiStoryGenerator } from "./aiStoryGenerator.js";

// ─── Types ───

export interface ExportConfig {
  packagePath: string;
  branchChoices: Record<string, number>;  // nodeId → chosen branch index
  skipStages: string[];
  loopOnce: boolean;
  targetWords: number;
  style: string;
}

export interface ChapterInfo {
  stageId: string;
  title: string;
  type: string;
  skipped: boolean;
  nodeId: string;
  guidance: string;
  directive: string;
  description: string;
}

export interface ResolvedPath {
  chapters: ChapterInfo[];
  totalChapters: number;
  estimatedWords: number;
  storyTitle: string;
  premise: string;
  characters: { name: string; role: string }[];
}

export interface GenerateChapterInput {
  packagePath: string;
  stageId: string;
  chapterIndex: number;
  totalChapters: number;
  targetWords: number;
  style: string;
  previousSummary: string;
  storyContext: { title: string; premise: string; characters: { name: string; role: string }[] };
  guidance: string;
  directive: string;
  chapterTitle: string;
}

export interface GenerateChapterResult {
  content: string;
  wordCount: number;
  summary: string;
}

// ─── Path Resolution ───

export function resolveLinearPath(config: ExportConfig): ResolvedPath {
  const { packagePath, branchChoices, skipStages, loopOnce } = config;

  // Load flow.json
  const flowData = JSON.parse(readFileSync(join(packagePath, "flow.json"), "utf-8"));
  const nodes: any[] = flowData.nodes || [];
  const edges: any[] = flowData.edges || [];

  // Load scenario for guidance/directive
  const scenario = JSON.parse(readFileSync(join(packagePath, "scenario.json"), "utf-8"));
  const stageDetailsMap = new Map<string, any>();
  for (const sd of (scenario.stageDetails || [])) {
    stageDetailsMap.set(sd.id, sd);
  }

  // Load package info
  const pkg = JSON.parse(readFileSync(join(packagePath, "package.json"), "utf-8"));
  const characters = (() => {
    try {
      return JSON.parse(readFileSync(join(packagePath, "characters.json"), "utf-8"))
        .map((c: any) => ({ name: c.name, role: c.role }));
    } catch { return []; }
  })();

  // Build adjacency
  const outEdges = new Map<string, any[]>();
  for (const edge of edges) {
    if (!outEdges.has(edge.source)) outEdges.set(edge.source, []);
    outEdges.get(edge.source)!.push(edge);
  }

  // Traverse
  const chapters: ChapterInfo[] = [];
  const visited = new Set<string>();
  const startNode = nodes.find((n: any) => n.type === "start");
  if (!startNode) return { chapters: [], totalChapters: 0, estimatedWords: 0, storyTitle: pkg.title || "", premise: scenario.premise || "", characters };

  let current: string | undefined = startNode.id;

  while (current) {
    if (visited.has(current)) break;
    visited.add(current);

    const node = nodes.find((n: any) => n.id === current);
    if (!node) break;
    if (node.type === "end") break;

    if (node.type === "module") {
      const moduleData = node.data?.moduleData || {};
      const sourceStage = moduleData.sourceStage || node.data?.moduleRef?.replace("mod_", "") || "";
      const stageDetail = stageDetailsMap.get(sourceStage) || stageDetailsMap.get(node.data?.moduleRef?.replace("mod_", "")) || {};

      chapters.push({
        stageId: sourceStage || current,
        title: node.data?.label || moduleData.title || "未命名",
        type: node.data?.colorKey || moduleData.type || "training",
        skipped: skipStages.includes(sourceStage),
        nodeId: current,
        guidance: stageDetail.guidance || moduleData.guidance || "",
        directive: stageDetail.directive || moduleData.directive || "",
        description: stageDetail.description || moduleData.description || "",
      });
    }

    // Navigate
    if (node.type === "choice") {
      const chosenIdx = branchChoices[current] ?? 0;
      const outs = outEdges.get(current) || [];
      const branchEdge = outs.find((e: any) => e.sourceHandle === `branch_${chosenIdx}`);
      current = branchEdge?.target || outs[0]?.target;
      continue;
    }

    if (node.type === "loop") {
      const outs = outEdges.get(current) || [];
      const bodyEdge = outs.find((e: any) => e.sourceHandle === "loop_body");
      const exitEdge = outs.find((e: any) => e.sourceHandle === "loop_exit");

      if (loopOnce && bodyEdge) {
        // Walk loop body once
        let loopCurrent: string | undefined = bodyEdge.target;
        const loopVisited = new Set<string>();
        while (loopCurrent && !loopVisited.has(loopCurrent)) {
          loopVisited.add(loopCurrent);
          const loopNode = nodes.find((n: any) => n.id === loopCurrent);
          if (!loopNode) break;
          // If we've looped back to the loop node, stop
          if (loopCurrent === current) break;

          if (loopNode.type === "module") {
            const md = loopNode.data?.moduleData || {};
            const ss = md.sourceStage || loopNode.data?.moduleRef?.replace("mod_", "") || "";
            const sd = stageDetailsMap.get(ss) || {};
            chapters.push({
              stageId: ss || loopCurrent,
              title: loopNode.data?.label || md.title || "循环事件",
              type: loopNode.data?.colorKey || md.type || "daily",
              skipped: skipStages.includes(ss),
              nodeId: loopCurrent,
              guidance: sd.guidance || md.guidance || "",
              directive: sd.directive || md.directive || "",
              description: sd.description || md.description || "",
            });
          }

          // Next in loop body
          const loopOuts = outEdges.get(loopCurrent) || [];
          const nextEdge = loopOuts.find((e: any) => e.target !== current); // Don't go back to loop node
          if (!nextEdge) break;
          loopCurrent = nextEdge.target;
        }
      }

      // Exit loop
      current = exitEdge?.target;
      continue;
    }

    // Default: follow first outgoing edge
    const outs = outEdges.get(current) || [];
    current = outs[0]?.target;
  }

  const activeChapters = chapters.filter(c => !c.skipped);
  return {
    chapters,
    totalChapters: activeChapters.length,
    estimatedWords: activeChapters.length * config.targetWords,
    storyTitle: pkg.title || scenario.title || "",
    premise: scenario.premise || "",
    characters,
  };
}

// ─── Chapter Generation ───

export async function generateChapter(input: GenerateChapterInput): Promise<GenerateChapterResult> {
  const systemPrompt = NOVEL_SYSTEM_PROMPT;
  const userPrompt = buildNovelUserPrompt(input);

  const generator = aiStoryGenerator as any;
  const content = await generator.callAI(systemPrompt, userPrompt, 6000);

  // Split content and summary (separated by ---)
  const parts = content.split(/\n---\n|\n-{3,}\n/);
  const novelContent = parts[0]?.trim() || content.trim();
  const summary = parts[1]?.trim() || novelContent.slice(0, 200);

  const wordCount = novelContent.length;

  return { content: novelContent, wordCount, summary };
}

// Need to expose callAI publicly
// Patch: add a public method wrapper
(aiStoryGenerator as any).callAIPublic = async function(sys: string, user: string, maxTokens: number) {
  return (this as any).callAI(sys, user, maxTokens);
};

// ─── Prompts ───

const NOVEL_SYSTEM_PROMPT = `你是一位专业的小说作家。根据故事大纲和当前章节的剧情指引，写出一章完整的小说内容。

要求：
1. 字数控制在目标字数左右（允许 ±15% 浮动）
2. 必须包含 guidance 中描述的关键情节和对话
3. 保持与上一章的连贯性
4. 对话用「」包裹
5. 动作和心理描写用细腻的文学语言
6. 每章结尾自然过渡到下一章
7. 不要输出章节标题（由系统添加）

输出格式：
- 先输出小说正文
- 然后用 --- 分隔
- 最后写一个 150 字以内的章节摘要（供下一章参考连贯性）`;

function buildNovelUserPrompt(input: GenerateChapterInput): string {
  const { storyContext, chapterIndex, totalChapters, targetWords, style, previousSummary, guidance, directive, chapterTitle } = input;

  let prompt = `故事：${storyContext.title}\n前提：${storyContext.premise}\n`;
  prompt += `角色：${storyContext.characters.map(c => `${c.name}(${c.role})`).join("、")}\n\n`;
  prompt += `当前：第 ${chapterIndex + 1} 章 / 共 ${totalChapters} 章\n`;
  prompt += `章节：${chapterTitle}\n`;
  prompt += `目标字数：${targetWords} 字\n`;
  if (style) prompt += `写作风格：${style}\n`;
  prompt += `\n`;

  if (previousSummary) {
    prompt += `上一章摘要：\n${previousSummary}\n\n`;
  }

  if (guidance) {
    prompt += `剧情指引：\n${guidance}\n\n`;
  }

  if (directive) {
    prompt += `强制要求：${directive}\n\n`;
  }

  prompt += `请写出这一章的小说内容。`;
  return prompt;
}

// ─── Assemble MD ───

export function assembleMarkdown(
  storyTitle: string,
  premise: string,
  chapters: { title: string; content: string }[]
): string {
  let md = `# ${storyTitle}\n\n`;
  md += `> ${premise}\n\n`;
  md += `---\n\n`;

  chapters.forEach((ch, i) => {
    md += `## 第${i + 1}章 ${ch.title}\n\n`;
    md += `${ch.content}\n\n`;
    if (i < chapters.length - 1) md += `---\n\n`;
  });

  md += `\n---\n\n*全文完*\n`;
  return md;
}
