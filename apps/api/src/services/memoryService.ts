import type { Message } from "@story-game/shared";

export class MemoryService {
  private readonly messages = new Map<string, Message[]>();

  list(sessionId: string) {
    return this.messages.get(sessionId) ?? [];
  }

  recent(sessionId: string, limit = 12) {
    return this.list(sessionId).slice(-limit);
  }

  append(message: Message) {
    const current = this.messages.get(message.sessionId) ?? [];
    current.push(message);
    this.messages.set(message.sessionId, current);
  }

  compressHistory(sessionId: string, maxMessages = 30): Message[] {
    const all = this.list(sessionId);
    if (all.length <= maxMessages) return all;

    const keepLast = 10;
    const keepFirst = 2;
    const middle = all.slice(keepFirst, -keepLast);

    const assistantMessages = middle.filter((m) => m.role === "assistant");
    const summaryLines = assistantMessages.map((m) => {
      const speaker = m.speakerId ?? "unknown";
      const skills = m.usedSkills.length > 0 ? ` [${m.usedSkills.join(",")}]` : "";
      return `${speaker}${skills}`;
    });

    const summaryContent = `[剧情摘要] 此段包含 ${middle.length} 条消息，${assistantMessages.length} 次角色行动：${summaryLines.join(" → ")}`;

    const summary: Message = {
      id: `summary_${sessionId}`,
      sessionId,
      role: "system",
      speakerId: null,
      content: summaryContent,
      usedSkills: [],
      stateDelta: {},
      createdAt: new Date().toISOString()
    };

    return [...all.slice(0, keepFirst), summary, ...all.slice(-keepLast)];
  }
}
