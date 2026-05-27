import { describe, expect, it } from "vitest";
import type { KnowledgeDocument, Message, StoryPerformanceDefinition } from "@story-game/shared";
import { extractBoldSegments, shouldPlayForMessage } from "./StoryPerformanceRuntime.js";

const baseMessage: Message = {
  id: "msg_1",
  sessionId: "sess_1",
  role: "assistant",
  speakerId: "qiaofeng",
  content: "乔峰双掌推出，**亢龙有悔**的掌力如怒涛压下。",
  usedSkills: [],
  stateDelta: {},
  createdAt: "2026-05-27T00:00:00.000Z",
};

const knowledgeDocs: KnowledgeDocument[] = [
  {
    id: "kb_qiaofeng",
    title: "乔峰技能卡",
    ownerId: "qiaofeng",
    content: [
      "## 降龙十八掌·亢龙有悔",
      "",
      "- 类型：招式",
      "- 表演：亢龙有悔",
      "- 触发词：亢龙有悔、降龙十八掌",
    ].join("\n"),
    sourceType: "markdown",
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: "2026-05-27T00:00:00.000Z",
  },
];

describe("knowledge-driven performances", () => {
  it("extracts markdown bold segments from assistant content", () => {
    expect(extractBoldSegments("先用 **亢龙有悔**，再收掌。")).toEqual(["亢龙有悔"]);
  });

  it("plays knowledgeUse performance when bold text matches trigger keywords", () => {
    const performance: StoryPerformanceDefinition = {
      name: "亢龙有悔",
      renderer: "layeredCss",
      durationMs: 3800,
      trigger: {
        type: "knowledgeUse",
        characterId: "qiaofeng",
        keywords: ["亢龙有悔"],
        matchBoldOnly: true,
      },
      playOnce: "never",
      layers: {},
      audio: {},
    };

    expect(shouldPlayForMessage(performance, baseMessage, [], knowledgeDocs)).toBe(true);
  });

  it("can infer knowledgeUse keywords from the matching knowledge card", () => {
    const performance: StoryPerformanceDefinition = {
      name: "亢龙有悔",
      renderer: "layeredCss",
      durationMs: 3800,
      trigger: {
        type: "knowledgeUse",
        characterId: "qiaofeng",
        matchBoldOnly: true,
      },
      playOnce: "never",
      layers: {},
      audio: {},
    };

    expect(shouldPlayForMessage(performance, baseMessage, [], knowledgeDocs)).toBe(true);
  });

  it("ignores unbolded knowledge mentions when matchBoldOnly is enabled", () => {
    const performance: StoryPerformanceDefinition = {
      name: "亢龙有悔",
      renderer: "layeredCss",
      durationMs: 3800,
      trigger: {
        type: "knowledgeUse",
        characterId: "qiaofeng",
        keywords: ["亢龙有悔"],
        matchBoldOnly: true,
      },
      playOnce: "never",
      layers: {},
      audio: {},
    };
    const message = { ...baseMessage, content: "乔峰使出亢龙有悔。" };

    expect(shouldPlayForMessage(performance, message, [], knowledgeDocs)).toBe(false);
  });
});
