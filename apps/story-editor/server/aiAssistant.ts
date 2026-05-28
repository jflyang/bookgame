import { readFileSync } from "node:fs";

interface AiSuggestionRequest {
  context: string;
  instruction: string;
  currentData?: unknown;
  dataType: string;
}

interface AiSuggestionResponse {
  suggestion: string;
  parsed?: unknown;
}

/**
 * AI assistant for story editing.
 * Reuses the DeepSeek provider pattern from the main API.
 * Falls back to a local read of the API key / env var if no config service is available.
 */
export class AiAssistant {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor() {
    // Read key from same .env as the main API
    const envPath = "../../api/.env";
    let envKey = process.env.DEEPSEEK_API_KEY;
    try {
      const envContent = readFileSync(new URL(envPath, import.meta.url), "utf-8");
      for (const line of envContent.split("\n")) {
        const match = line.match(/^DEEPSEEK_API_KEY=(.+)$/);
        if (match) { envKey = match[1].trim(); break; }
      }
    } catch { /* no .env, use process.env */ }

    this.apiKey = envKey || "";
    this.baseUrl = "https://api.deepseek.com";
    this.model = "deepseek-chat";
  }

  setConfig(apiKey: string, baseUrl?: string, model?: string) {
    if (apiKey) this.apiKey = apiKey;
    if (baseUrl) this.baseUrl = baseUrl;
    if (model) this.model = model;
  }

  async suggest(req: AiSuggestionRequest): Promise<AiSuggestionResponse> {
    if (!this.apiKey) throw new Error("DeepSeek API Key 未配置，请在主 API 的 .env 中设置 DEEPSEEK_API_KEY");

    const systemPrompt = buildSystemPrompt(req.dataType);
    const userPrompt = buildUserPrompt(req.context, req.instruction, req.currentData, req.dataType);

    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.7,
        max_tokens: 4000,
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

    // Try to extract JSON from markdown code blocks
    let parsed: unknown;
    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Not JSON, return as-is
    }

    return { suggestion: content, parsed };
  }
}

function buildSystemPrompt(dataType: string): string {
  const base = `你是故事包编辑助手。用户正在编辑互动故事游戏的数据。你的任务是根据用户指令修改数据。严格按格式输出。`;
  const dataTypeGuides: Record<string, string> = {
    scenario: "输出整个 scenario 对象的 JSON。stageDetails 中每个阶段的 guidance 字段要写清楚氛围、技能分配和推进条件。",
    character: "输出角色对象的 JSON。包含 id, name, role, avatar, personaPrompt, rules, knowledgeBaseIds, attackableTargetIds。",
    skill: "输出技能对象的 JSON。必填：id, name, ownerId, cost.mp, effect, description。可选：damage（min/max）, sampleLine。",
    knowledge: "输出知识库文档的 JSON。必填：id, title, ownerId, content(Markdown格式), sourceType, createdAt, updatedAt。",
    promptRule: "输出 Prompt 规则的 JSON。必填：id, title, category（枚举：knowledge_forcing|group_chat_boundary|scenario_injection|state_output|history_state|combat|custom）, content, enabled。",
    performance: "输出 manifest.json 的 performances 条目。包含 name, renderer, trigger, audio/layers 等。trigger.type 枚举：knowledgeUse|skillUse|firstAppearance|stageEnter|messageEvent。",
    stageDetail: "输出 stageDetail 对象的 JSON。包含 id, title, description, enterWhen, guidance。guidance 字段要写：氛围 + 各角色技能分配 + →推进条件。",
    storySetting: "输出故事设定的纯文本（不是 JSON）。这是给 LLM 的世界观背景。",
  };
  return `${base}\n\n${dataTypeGuides[dataType] || ""}`;
}

function buildUserPrompt(context: string, instruction: string, currentData: unknown, dataType: string): string {
  let prompt = "";
  if (context) prompt += `背景信息：\n${context}\n\n`;
  if (currentData) prompt += `当前数据：\n${JSON.stringify(currentData, null, 2)}\n\n`;
  prompt += `用户指令：${instruction}`;
  if (dataType !== "storySetting") {
    prompt += `\n\n请只输出${dataType === "scenario" ? "scenario" : dataType === "character" ? "角色" : dataType}的JSON，用\`\`\`json 代码块包裹。`;
  }
  return prompt;
}

export const aiAssistant = new AiAssistant();
