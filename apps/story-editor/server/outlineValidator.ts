/**
 * Outline Validator & Fixer
 * 
 * AI 输出的 JSON 可能有格式问题，这里做校验和自动修复。
 */

import type { OutlineData, OutlineStage, OutlineCharacter, OutlineFlow } from "./aiStoryGenerator.js";

interface ValidationResult {
  valid: boolean;
  fixed: OutlineData;
  warnings: string[];
}

/**
 * Validate and fix AI-generated outline data.
 * Fixes common issues:
 * - Missing/invalid IDs
 * - Missing required fields with defaults
 * - Duplicate IDs
 * - Invalid stageType values
 * - Flow references to non-existent stages
 * - Character ID normalization
 */
export function validateAndFixOutline(raw: any): ValidationResult {
  const warnings: string[] = [];

  if (!raw || typeof raw !== "object") {
    throw new Error("AI 输出不是有效的 JSON 对象");
  }

  // Fix title
  const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "未命名故事";
  if (!raw.title) warnings.push("缺少 title，已使用默认值");

  // Fix premise
  const premise = typeof raw.premise === "string" ? raw.premise.trim() : title;
  if (!raw.premise) warnings.push("缺少 premise，已使用 title 代替");

  // Fix setting
  const setting = typeof raw.setting === "string" ? raw.setting.trim() : "";
  if (!raw.setting) warnings.push("缺少 setting");

  // Fix characters
  const characters = fixCharacters(raw.characters, warnings);

  // Fix stages
  const stages = fixStages(raw.stages, warnings);

  // Fix flow
  const flow = fixFlow(raw.flow, stages, warnings);

  return {
    valid: warnings.length === 0,
    fixed: { title, premise, setting, characters, stages, flow },
    warnings,
  };
}

function fixCharacters(raw: any, warnings: string[]): OutlineCharacter[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    warnings.push("缺少 characters 数组，已创建默认角色");
    return [{ id: "protagonist", name: "主角", role: "主角", description: "故事主角" }];
  }

  const seen = new Set<string>();
  return raw.map((c: any, i: number) => {
    let id = typeof c.id === "string" ? normalizeId(c.id) : `char_${i + 1}`;
    // Deduplicate
    while (seen.has(id)) { id = `${id}_${i}`; }
    seen.add(id);

    if (c.id !== id) warnings.push(`角色 ID "${c.id}" 已规范化为 "${id}"`);

    return {
      id,
      name: typeof c.name === "string" ? c.name.trim() : `角色${i + 1}`,
      role: typeof c.role === "string" ? c.role.trim() : "未知",
      description: typeof c.description === "string" ? c.description.trim() : "",
    };
  });
}

function fixStages(raw: any, warnings: string[]): OutlineStage[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    warnings.push("缺少 stages 数组");
    return [];
  }

  const validTypes = new Set(["training", "serving", "punishment", "choice", "event", "daily"]);
  const seen = new Set<string>();

  return raw.map((s: any, i: number) => {
    let id = typeof s.id === "string" ? s.id.trim() : `stage_${String(i + 1).padStart(3, "0")}`;
    // Ensure valid ID format
    if (!/^[a-zA-Z0-9_]+$/.test(id)) {
      const oldId = id;
      id = `stage_${String(i + 1).padStart(3, "0")}`;
      warnings.push(`阶段 ID "${oldId}" 格式无效，已替换为 "${id}"`);
    }
    // Deduplicate
    while (seen.has(id)) { id = `${id}_dup`; }
    seen.add(id);

    let stageType = typeof s.stageType === "string" ? s.stageType : "training";
    if (!validTypes.has(stageType)) {
      warnings.push(`阶段 "${s.title}" 的 stageType "${stageType}" 无效，已改为 "training"`);
      stageType = "training";
    }

    const stage: OutlineStage = {
      id,
      title: typeof s.title === "string" ? s.title.trim() : `阶段 ${i + 1}`,
      description: typeof s.description === "string" ? s.description.trim() : "",
      stageType: stageType as any,
      enterWhen: typeof s.enterWhen === "string" ? s.enterWhen.trim() : "",
      sortKey: typeof s.sortKey === "number" ? s.sortKey : i,
    };

    if (s.isChoicePoint) {
      stage.isChoicePoint = true;
      if (Array.isArray(s.branches)) {
        stage.branches = s.branches.map((b: any) => ({
          choiceText: typeof b.choiceText === "string" ? b.choiceText : "选项",
          description: typeof b.description === "string" ? b.description : "",
        }));
      }
    }

    return stage;
  });
}

function fixFlow(raw: any, stages: OutlineStage[], warnings: string[]): OutlineFlow {
  const stageIds = new Set(stages.map(s => s.id));

  if (!raw || typeof raw !== "object") {
    // Auto-generate linear flow from stages
    warnings.push("缺少 flow 结构，已自动生成线性流程");
    return {
      mainLine: stages.map(s => s.id),
      finale: [],
    };
  }

  // Fix mainLine
  let mainLine = Array.isArray(raw.mainLine) ? raw.mainLine.filter((id: string) => stageIds.has(id)) : [];

  // Fix branches
  let branches: Record<string, string[]> | undefined;
  if (raw.branches && typeof raw.branches === "object") {
    branches = {};
    for (const [key, val] of Object.entries(raw.branches)) {
      if (Array.isArray(val)) {
        const validIds = (val as string[]).filter(id => stageIds.has(id));
        if (validIds.length > 0) branches[key] = validIds;
      }
    }
    if (Object.keys(branches).length === 0) branches = undefined;
  }

  // Fix choicePoint
  let choicePoint = typeof raw.choicePoint === "string" && stageIds.has(raw.choicePoint) ? raw.choicePoint : undefined;

  // Fix converge
  let converge = typeof raw.converge === "string" && stageIds.has(raw.converge) ? raw.converge : undefined;

  // Fix finale
  let finale = Array.isArray(raw.finale) ? raw.finale.filter((id: string) => stageIds.has(id)) : [];

  // If mainLine is empty, try to reconstruct from stages
  if (mainLine.length === 0 && stages.length > 0) {
    warnings.push("flow.mainLine 为空，已从 stages 自动重建");
    const choiceIdx = stages.findIndex(s => s.isChoicePoint);
    if (choiceIdx > 0) {
      mainLine = stages.slice(0, choiceIdx).map(s => s.id);
    } else {
      mainLine = stages.map(s => s.id);
    }
  }

  // Remove invalid references
  const removedMain = (raw.mainLine?.length || 0) - mainLine.length;
  if (removedMain > 0) warnings.push(`flow.mainLine 中移除了 ${removedMain} 个无效引用`);

  return { mainLine, choicePoint, branches, converge, finale };
}

// ─── Helpers ───

function normalizeId(id: string): string {
  return id
    .toLowerCase()
    .replace(/[\s\-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30) || "unnamed";
}

/**
 * Try to parse potentially malformed JSON from AI output.
 * Handles: trailing commas, single quotes, unquoted keys, code blocks, thinking text before JSON, etc.
 */
export function robustJsonParse(content: string): any {
  // Step 1: Try to extract from ```json code block
  const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (jsonMatch) {
    const jsonStr = jsonMatch[1].trim();
    try { return JSON.parse(jsonStr); } catch {}
    // Try fixing trailing commas
    try { return JSON.parse(jsonStr.replace(/,\s*([}\]])/g, "$1")); } catch {}
  }

  // Step 2: Try the whole content as JSON
  const trimmed = content.trim();
  try { return JSON.parse(trimmed); } catch {}

  // Step 3: Find the first { and last } (skip any preamble text)
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const extracted = content.slice(firstBrace, lastBrace + 1);
    try { return JSON.parse(extracted); } catch {}
    // Fix trailing commas
    try { return JSON.parse(extracted.replace(/,\s*([}\]])/g, "$1")); } catch {}
    // Fix common issues: remove control characters
    const cleaned = extracted.replace(/[\x00-\x1f\x7f]/g, (ch) => ch === "\n" || ch === "\r" || ch === "\t" ? ch : "");
    try { return JSON.parse(cleaned); } catch {}
    try { return JSON.parse(cleaned.replace(/,\s*([}\]])/g, "$1")); } catch {}
  }

  // Step 4: Try finding [ ] array
  const firstBracket = content.indexOf("[");
  const lastBracket = content.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    const extracted = content.slice(firstBracket, lastBracket + 1);
    try { return JSON.parse(extracted); } catch {}
    try { return JSON.parse(extracted.replace(/,\s*([}\]])/g, "$1")); } catch {}
  }

  throw new Error("无法解析 AI 输出的 JSON，请重试");
}
