import { describe, it, expect } from "vitest";
import { llmStoryOutputSchema } from "@story-game/shared";

/**
 * Tests for LLM output parsing stability.
 * Covers all edge cases we've encountered with DeepSeek models.
 */

// Simulate the parsing pipeline from deepSeekLlmProvider + turnProcessor
function parseRawContent(rawContent: string): { ok: boolean; output?: unknown; error?: string } {
  try {
    const parsed = JSON.parse(rawContent);
    const output = llmStoryOutputSchema.parse(parsed);
    return { ok: true, output };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function extractJsonFromText(text: string): Record<string, unknown> | null {
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      if (parsed.speakerId && parsed.narration) return parsed;
    } catch { /* continue */ }
  }

  const indices: number[] = [];
  let searchFrom = 0;
  while (true) {
    const idx = text.indexOf('"speakerId"', searchFrom);
    if (idx === -1) break;
    let braceStart = text.lastIndexOf("{", idx);
    if (braceStart !== -1) indices.push(braceStart);
    searchFrom = idx + 1;
  }

  for (const start of indices) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(start, i + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (parsed.speakerId && parsed.narration) return parsed;
          } catch { /* try next */ }
          break;
        }
      }
    }
  }
  return null;
}

function extractFieldsViaRegex(rawBuffer: string, fallbackSpeakerId: string) {
  const narrationMatch = rawBuffer.match(/"narration"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const dialogueMatch = rawBuffer.match(/"dialogue"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (narrationMatch && dialogueMatch) {
    const speakerMatch = rawBuffer.match(/"speakerId"\s*:\s*"([^"]+)"/);
    return {
      speakerId: speakerMatch?.[1] || fallbackSpeakerId,
      narration: narrationMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'),
      dialogue: dialogueMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'),
      action: { type: "observe", targetIds: [] },
      stateDeltaSuggestion: {}
    };
  }
  return null;
}

describe("LLM Output Parsing", () => {
  describe("valid JSON responses", () => {
    it("parses a standard complete response", () => {
      const raw = JSON.stringify({
        speakerId: "qiaofeng",
        narration: "乔峰负手而立，目光如电。",
        dialogue: "丁春秋，今日你插翅难飞。",
        action: { type: "observe", targetIds: [] },
        stateDeltaSuggestion: {},
      });
      const result = parseRawContent(raw);
      expect(result.ok).toBe(true);
    });

    it("parses response with skill action and stat delta", () => {
      const raw = JSON.stringify({
        speakerId: "xuzhu",
        narration: "虚竹运起天山六阳掌，掌力温厚雄浑。",
        dialogue: "丁先生，得罪了。",
        action: { type: "skill", skillId: "tianshan_liuyang", targetIds: ["dingchunqiu"] },
        stateDeltaSuggestion: { dingchunqiu_hp: -35, xuzhu_mp: -20 },
        stageSuggestion: "first_clash"
      });
      const result = parseRawContent(raw);
      expect(result.ok).toBe(true);
    });

    it("parses response with action as string (fallback)", () => {
      const raw = JSON.stringify({
        speakerId: "duanyu",
        narration: "段誉退在远处观察。",
        dialogue: "虚竹兄弟小心！",
        action: "observe",
        stateDeltaSuggestion: {},
      });
      // This will fail Zod validation since action should be object
      const result = parseRawContent(raw);
      expect(result.ok).toBe(false);
    });

    it("parses response with empty stateDeltaSuggestion", () => {
      const raw = JSON.stringify({
        speakerId: "dingchunqiu",
        narration: "丁春秋冷笑一声。",
        dialogue: "小和尚，你也配管老仙的事？",
        action: { type: "observe", targetIds: [] },
        stateDeltaSuggestion: {},
      });
      const result = parseRawContent(raw);
      expect(result.ok).toBe(true);
    });
  });

  describe("extractJsonFromText (reasoning_content fallback)", () => {
    it("extracts JSON from code block in reasoning", () => {
      const text = `我需要分析当前局势...\n\n\`\`\`json\n{"speakerId":"qiaofeng","narration":"乔峰出手。","dialogue":"接招！","action":{"type":"observe","targetIds":[]},"stateDeltaSuggestion":{}}\n\`\`\``;
      const result = extractJsonFromText(text);
      expect(result).not.toBeNull();
      expect(result!.speakerId).toBe("qiaofeng");
      expect(result!.narration).toBe("乔峰出手。");
    });

    it("extracts JSON embedded in reasoning text", () => {
      const text = `分析完毕，输出如下：{"speakerId":"xuzhu","narration":"虚竹合十。","dialogue":"阿弥陀佛。","action":{"type":"observe","targetIds":[]},"stateDeltaSuggestion":{}}`;
      const result = extractJsonFromText(text);
      expect(result).not.toBeNull();
      expect(result!.speakerId).toBe("xuzhu");
    });

    it("extracts JSON with nested objects", () => {
      const text = `思考中...{"speakerId":"dingchunqiu","narration":"毒雾弥漫。","dialogue":"哈哈哈！","action":{"type":"skill","skillId":"xingxiu_duwu","targetIds":["xuzhu"]},"stateDeltaSuggestion":{"xuzhu_hp":-20}}结束`;
      const result = extractJsonFromText(text);
      expect(result).not.toBeNull();
      expect(result!.speakerId).toBe("dingchunqiu");
      expect((result!.stateDeltaSuggestion as Record<string, number>).xuzhu_hp).toBe(-20);
    });

    it("returns null for text without valid JSON", () => {
      const text = "这是一段纯文本推理，没有JSON输出。";
      const result = extractJsonFromText(text);
      expect(result).toBeNull();
    });

    it("handles multiple JSON-like fragments, picks the valid one", () => {
      const text = `先分析 {"speakerId":"wrong"} 不对，重新来：{"speakerId":"qiaofeng","narration":"正确。","dialogue":"对。","action":{"type":"observe","targetIds":[]},"stateDeltaSuggestion":{}}`;
      const result = extractJsonFromText(text);
      expect(result).not.toBeNull();
      expect(result!.narration).toBe("正确。");
    });
  });

  describe("extractFieldsViaRegex (truncated JSON fallback)", () => {
    it("extracts narration and dialogue from truncated JSON", () => {
      const truncated = `{"speakerId":"qiaofeng","narration":"乔峰负手而立。","dialogue":"丁春秋，你暗中聚毒。","action":{"type":"observe`;
      const result = extractFieldsViaRegex(truncated, "fallback");
      expect(result).not.toBeNull();
      expect(result!.speakerId).toBe("qiaofeng");
      expect(result!.narration).toBe("乔峰负手而立。");
      expect(result!.dialogue).toBe("丁春秋，你暗中聚毒。");
    });

    it("handles escaped quotes in narration", () => {
      const truncated = `{"speakerId":"xuzhu","narration":"虚竹说：\\"阿弥陀佛。\\"","dialogue":"施主请留步。","action":{"type`;
      const result = extractFieldsViaRegex(truncated, "fallback");
      expect(result).not.toBeNull();
      expect(result!.narration).toContain("阿弥陀佛");
    });

    it("uses fallback speakerId when not found", () => {
      const truncated = `{"narration":"场景描述。","dialogue":"对话内容。","action":`;
      const result = extractFieldsViaRegex(truncated, "duanyu");
      expect(result).not.toBeNull();
      expect(result!.speakerId).toBe("duanyu");
    });

    it("returns null when narration/dialogue not found", () => {
      const truncated = `{"speakerId":"qiaofeng","some_other_field":"value"`;
      const result = extractFieldsViaRegex(truncated, "fallback");
      expect(result).toBeNull();
    });
  });

  describe("edge cases from production", () => {
    it("handles response with Chinese quotes in dialogue", () => {
      const raw = JSON.stringify({
        speakerId: "dingchunqiu",
        narration: "丁春秋冷笑。",
        dialogue: "小和尚，你也配管「老仙」的事？",
        action: { type: "observe", targetIds: [] },
        stateDeltaSuggestion: {},
      });
      const result = parseRawContent(raw);
      expect(result.ok).toBe(true);
    });

    it("handles response with newlines in narration", () => {
      const raw = JSON.stringify({
        speakerId: "qiaofeng",
        narration: "暮色如墨。\n枯松岭山道上一片肃杀。\n乔峰负手而立。",
        dialogue: "丁春秋，今日须得给个交代。",
        action: { type: "observe", targetIds: [] },
        stateDeltaSuggestion: {},
      });
      const result = parseRawContent(raw);
      expect(result.ok).toBe(true);
    });

    it("handles empty string content (reasoning model)", () => {
      const raw = "";
      const result = parseRawContent(raw);
      expect(result.ok).toBe(false);
    });

    it("handles response with bold markers in narration", () => {
      const raw = JSON.stringify({
        speakerId: "xuzhu",
        narration: "虚竹运起**天山折梅手**，掌力如暖阳破寒雾。",
        dialogue: "丁先生，得罪了。",
        action: { type: "skill", skillId: "tianshan_zhemeishou", targetIds: ["dingchunqiu"] },
        stateDeltaSuggestion: { dingchunqiu_hp: -30 },
      });
      const result = parseRawContent(raw);
      expect(result.ok).toBe(true);
    });
  });
});
