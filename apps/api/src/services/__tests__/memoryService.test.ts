import { describe, it, expect, beforeEach } from "vitest";
import { MemoryService } from "../memoryService.js";
import type { Message } from "@story-game/shared";

function makeMsg(sessionId: string, speakerId: string, role: Message["role"] = "assistant"): Message {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    sessionId,
    role,
    speakerId: speakerId as any,
    content: `${speakerId} says something`,
    usedSkills: [],
    stateDelta: {},
    createdAt: new Date().toISOString()
  };
}

describe("MemoryService", () => {
  let svc: MemoryService;
  beforeEach(() => { svc = new MemoryService(); });

  it("append and list", () => {
    const m = makeMsg("s1", "qiaofeng");
    svc.append(m);
    expect(svc.list("s1")).toHaveLength(1);
  });

  it("recent returns last N", () => {
    for (let i = 0; i < 15; i++) svc.append(makeMsg("s1", "qiaofeng"));
    expect(svc.recent("s1", 5)).toHaveLength(5);
  });

  it("recent default limit", () => {
    for (let i = 0; i < 15; i++) svc.append(makeMsg("s1", "qiaofeng"));
    expect(svc.recent("s1")).toHaveLength(12);
  });

  it("compressHistory under threshold returns all", () => {
    for (let i = 0; i < 10; i++) svc.append(makeMsg("s1", "qiaofeng"));
    expect(svc.compressHistory("s1", 30)).toHaveLength(10);
  });

  it("compressHistory over threshold creates summary", () => {
    for (let i = 0; i < 40; i++) svc.append(makeMsg("s1", i % 2 === 0 ? "qiaofeng" : "xuzhu"));
    const result = svc.compressHistory("s1", 30);
    expect(result.length).toBeLessThan(40);
    expect(result.some((m) => m.role === "system")).toBe(true);
  });
});
