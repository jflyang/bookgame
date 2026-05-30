/**
 * AI Story Generator — 用 DeepSeek 从描述生成完整故事包
 * 
 * 两步生成：
 * 1. generateOutline: 描述 → 大纲（角色 + 阶段列表 + 分支结构）
 * 2. generateStageDetail: 大纲 + stageId → 该阶段的 guidance + directive
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { robustJsonParse, validateAndFixOutline } from "./outlineValidator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Types ───

export interface GenerateInput {
  description: string;
  style?: string;
  stageCount?: number;
  branchCount?: number;
  characters?: { name: string; role: string }[];
}

export interface OutlineCharacter {
  id: string;
  name: string;
  role: string;
  description: string;
}

export interface OutlineStage {
  id: string;
  title: string;
  description: string;
  stageType: "training" | "serving" | "punishment" | "choice" | "event" | "daily";
  enterWhen: string;
  sortKey: number;
  isChoicePoint?: boolean;
  branches?: { choiceText: string; description: string }[];
}

export interface OutlineFlow {
  mainLine: string[];
  choicePoint?: string;
  branches?: Record<string, string[]>;
  converge?: string;
  finale: string[];
}

export interface OutlineData {
  title: string;
  premise: string;
  setting: string;
  characters: OutlineCharacter[];
  stages: OutlineStage[];
  flow: OutlineFlow;
}

export interface StageDetail {
  guidance: string;
  directive: string;
}

// ─── Generator Class ───

export class AiStoryGenerator {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor() {
    // Try to load saved config first
    const saved = this.loadSavedConfig();
    if (saved) {
      this.apiKey = saved.apiKey || "";
      this.baseUrl = saved.baseUrl || "https://api.deepseek.com";
      this.model = saved.model || "deepseek-chat";
      return;
    }

    // Fallback: read from .env or environment
    let envKey = process.env.DEEPSEEK_API_KEY;
    try {
      const envPath = resolve(__dirname, "../../api/.env");
      const envContent = readFileSync(envPath, "utf-8");
      for (const line of envContent.split("\n")) {
        const match = line.match(/^DEEPSEEK_API_KEY=(.+)$/);
        if (match) { envKey = match[1].trim(); break; }
      }
    } catch { /* no .env, use process.env */ }

    this.apiKey = envKey || "";
    this.baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
    this.model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  }

  private getConfigPath(): string {
    return resolve(__dirname, "../data/ai-config.json");
  }

  private loadSavedConfig(): { apiKey: string; baseUrl: string; model: string } | null {
    try {
      const content = readFileSync(this.getConfigPath(), "utf-8");
      return JSON.parse(content);
    } catch { return null; }
  }

  saveConfig(apiKey: string, baseUrl: string, model: string) {
    // Strip any non-ASCII characters from key and URL
    this.apiKey = apiKey.replace(/[^\x20-\x7E]/g, "").trim();
    this.baseUrl = baseUrl.replace(/[^\x20-\x7E]/g, "").trim() || "https://api.deepseek.com";
    this.model = model.replace(/[^\x20-\x7E]/g, "").trim() || "deepseek-chat";
    const configPath = this.getConfigPath();
    try { mkdirSync(dirname(configPath), { recursive: true }); } catch {}
    writeFileSync(configPath, JSON.stringify({ apiKey: this.apiKey, baseUrl: this.baseUrl, model: this.model }, null, 2), "utf-8");
  }

  getConfig() {
    return { apiKey: this.apiKey ? "****" + this.apiKey.slice(-4) : "", baseUrl: this.baseUrl, model: this.model, hasKey: !!this.apiKey };
  }

  /** Update config partially — undefined fields keep current value */
  updateConfig(apiKey?: string, baseUrl?: string, model?: string) {
    const newKey = apiKey ? apiKey.replace(/[^\x20-\x7E]/g, "").trim() : this.apiKey;
    const newUrl = baseUrl ? baseUrl.replace(/[^\x20-\x7E]/g, "").trim() : this.baseUrl;
    const newModel = model ? model.replace(/[^\x20-\x7E]/g, "").trim() : this.model;
    this.saveConfig(newKey, newUrl, newModel);
  }

  async callAI(systemPrompt: string, userPrompt: string, maxTokens = 8000): Promise<string> {
    if (!this.apiKey) throw new Error("DeepSeek API Key 未配置，请在首页 AI 配置中设置");

    const url = `${this.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const body = JSON.stringify({
      model: this.model,
      temperature: 0.75,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey.trim()}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI 请求失败: ${response.status} ${text.slice(0, 200)}`);
    }

    const data = await response.json() as any;
    const content = data?.choices?.[0]?.message?.content || "";
    if (!content) throw new Error("AI 返回空内容");
    return content;
  }

  private extractJSON(content: string): any {
    // Strip <think>...</think> blocks (DeepSeek R1 reasoning)
    const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    return robustJsonParse(cleaned);
  }

  // ─── Step 1: Generate Outline ───

  async generateOutline(input: GenerateInput): Promise<OutlineData> {
    const systemPrompt = OUTLINE_SYSTEM_PROMPT;
    const userPrompt = buildOutlineUserPrompt(input);

    const content = await this.callAI(systemPrompt, userPrompt, 8000);
    console.log("[AI Generator] Raw outline response length:", content.length);
    console.log("[AI Generator] First 200 chars:", content.slice(0, 200));

    let parsed: any;
    try {
      parsed = this.extractJSON(content);
    } catch (err) {
      console.error("[AI Generator] JSON parse failed. Full response:\n", content.slice(0, 2000));
      throw new Error("无法解析 AI 输出的 JSON，请重试。AI 原始输出前200字：" + content.slice(0, 200));
    }

    // Validate and fix
    const { fixed, warnings } = validateAndFixOutline(parsed);
    if (warnings.length > 0) {
      console.log("[AI Generator] Outline warnings:", warnings);
    }

    if (!fixed.title || !fixed.stages || fixed.stages.length === 0) {
      throw new Error("AI 输出格式不完整，缺少 title 或 stages");
    }

    return fixed;
  }

  // ─── Step 2: Generate Stage Detail ───

  async generateStageDetail(outline: OutlineData, stageId: string, previousGuidance?: string): Promise<StageDetail> {
    const stage = outline.stages.find(s => s.id === stageId);
    if (!stage) throw new Error(`Stage ${stageId} not found in outline`);

    const systemPrompt = STAGE_DETAIL_SYSTEM_PROMPT;
    const userPrompt = buildStageDetailUserPrompt(outline, stage, previousGuidance);

    const content = await this.callAI(systemPrompt, userPrompt, 4000);
    const parsed = this.extractJSON(content);

    return {
      guidance: parsed.guidance || "",
      directive: parsed.directive || "",
    };
  }
}

// ─── Prompt Templates ───

const OUTLINE_SYSTEM_PROMPT = `你是一个互动故事架构师。用户会给你一段故事描述，你需要输出一个结构化的故事大纲 JSON。

输出格式要求（严格遵守）：
{
  "title": "故事标题",
  "premise": "一句话概括故事前提（50字以内）",
  "setting": "世界观背景（200字以内）",
  "characters": [
    { "id": "英文id", "name": "角色名", "role": "主角/辅助/观察者/反派", "description": "一句话描述" }
  ],
  "stages": [
    {
      "id": "stage_001",
      "title": "① 阶段标题",
      "description": "这个阶段发生什么（50-100字）",
      "stageType": "training",
      "enterWhen": "进入条件",
      "sortKey": 0
    }
  ],
  "flow": {
    "mainLine": ["stage_001", "stage_002", ...],
    "choicePoint": "stage_007",
    "branches": {
      "A": ["stage_008a", ...],
      "B": ["stage_008b", ...],
      "C": ["stage_008c", ...]
    },
    "converge": "stage_013",
    "finale": ["stage_013", "stage_014", ...]
  }
}

stageType 枚举及使用规则：
- training: 铺垫/教学（仅用于开头 3-5 个阶段）
- serving: 主角优势/正面行动
- punishment: 反派反扑/危机/逆境
- choice: 抉择点（有且仅有一个，除非用户要求多个）
- event: 高潮/关键事件（2-3个，用于大招释放、终极对决等）
- daily: 可循环阶段（如日常修炼，放在结尾前）

设计原则：
- serving 和 punishment 交替出现，形成叙事张力
- 每个分支路线长度相同（4-5个阶段）
- 所有分支最终汇聚到同一个 converge 阶段
- 阶段标题用中文序号（①②③...）
- 分支阶段标题加路线标记（如 ⑧A、⑧B、⑧C）
- id 格式：stage_001, stage_002, ... 分支用 stage_008a, stage_008b 等
- character id 用拼音小写（如 xuzhu, qiaofeng）

用 \`\`\`json 代码块包裹输出。不要输出任何其他内容。`;

const STAGE_DETAIL_SYSTEM_PROMPT = `你是一个互动故事编剧。根据故事大纲和当前阶段信息，为这个阶段生成详细的 guidance 和 directive。

guidance 格式要求：
- 第一段：氛围描写（环境、感官细节、情绪基调，3-5句）
- 中间：角色对话示例（格式：角色名：**动作**（描述）「台词」），写 3-5 轮对话
- 最后一行：→ 推进条件：xxx（明确的、可判断的条件）

directive 格式要求：
- 1-2 句话的强制指令
- 告诉 AI 这个阶段必须发生什么、哪些角色必须出现、不能跳过什么

要求：
- guidance 500-800字
- 对话要有画面感，体现角色性格差异
- 推进条件要具体、可判断（不要写"剧情自然发展"这种模糊条件）
- directive 要简洁有力

输出格式（用 \`\`\`json 代码块包裹）：
{ "guidance": "...", "directive": "..." }

不要输出任何其他内容。`;

function buildOutlineUserPrompt(input: GenerateInput): string {
  let prompt = `请为以下故事生成结构化大纲：\n\n故事描述：${input.description}`;

  if (input.style) prompt += `\n风格要求：${input.style}`;
  if (input.stageCount) prompt += `\n阶段数量：约 ${input.stageCount} 个`;
  if (input.branchCount) prompt += `\n分支数量：${input.branchCount} 条路线`;

  if (input.characters && input.characters.length > 0) {
    prompt += `\n\n预设角色：`;
    for (const c of input.characters) {
      prompt += `\n- ${c.name}（${c.role}）`;
    }
  }

  return prompt;
}

function buildStageDetailUserPrompt(outline: OutlineData, stage: OutlineStage, previousGuidance?: string): string {
  const charList = outline.characters.map(c => `${c.name}(${c.role}): ${c.description}`).join("\n");

  let prompt = `故事：${outline.title}\n前提：${outline.premise}\n世界观：${outline.setting}\n\n角色：\n${charList}\n\n`;

  if (previousGuidance) {
    prompt += `上一阶段的 guidance（提供连贯性）：\n${previousGuidance.slice(0, 500)}\n\n`;
  }

  prompt += `当前阶段：\n- ID: ${stage.id}\n- 标题: ${stage.title}\n- 描述: ${stage.description}\n- 类型: ${stage.stageType}\n- 进入条件: ${stage.enterWhen}`;

  if (stage.isChoicePoint && stage.branches) {
    prompt += `\n\n这是一个抉择点，分支选项：`;
    for (const b of stage.branches) {
      prompt += `\n- ${b.choiceText}: ${b.description}`;
    }
  }

  prompt += `\n\n请生成这个阶段的 guidance 和 directive。`;
  return prompt;
}

export const aiStoryGenerator = new AiStoryGenerator();
