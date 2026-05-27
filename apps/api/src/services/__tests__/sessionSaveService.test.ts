import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SessionSaveService } from "../sessionSaveService.js";
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { GameState, Message } from "@story-game/shared";

const mockGameState: GameState = {
  sessionId: "sess_001",
  scenarioId: "sc1",
  round: 3,
  lastSpeakerId: "qiaofeng",
  status: "active",
  characters: [
    { characterId: "qiaofeng", hp: 680, mp: 780, conditions: [], isDefeated: false },
    { characterId: "xuzhu", hp: 320, mp: 1800, conditions: [], isDefeated: false },
  ],
  scenario: {
    id: "sc1",
    title: "Test",
    premise: "P",
    currentStage: "start",
    stages: ["start", "middle", "end"],
    stageDetails: [],
    currentGoal: "Win",
    rules: [],
    initialStates: [],
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const mockMessages: Message[] = [
  { id: "m1", sessionId: "sess_001", role: "assistant", speakerId: "qiaofeng", content: "Hello", usedSkills: [], stateDelta: {}, createdAt: "2026-01-01T00:00:00.000Z" },
];

describe("SessionSaveService", () => {
  let svc: SessionSaveService;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "session-save-test-"));
    svc = new SessionSaveService(tmpDir);
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3 });
  });

  it("list returns empty array when no saves exist", () => {
    const saves = svc.list("pkg_001");
    expect(saves).toEqual([]);
  });

  it("save writes a save file and returns the save object", () => {
    const save = svc.save("pkg_001", "存档 1", structuredClone(mockGameState), structuredClone(mockMessages));
    expect(save.sessionId).toBe("sess_001");
    expect(save.label).toBe("存档 1");
    expect(save.gameState.round).toBe(3);
    expect(save.messages).toHaveLength(1);
    expect(save.createdAt).toBeDefined();
    expect(save.updatedAt).toBeDefined();
    expect(existsSync(join(tmpDir, "pkg_001", "saves", "sess_001.session.json"))).toBe(true);
  });

  it("get reads a previously saved file", () => {
    svc.save("pkg_001", "存档 1", structuredClone(mockGameState), structuredClone(mockMessages));
    const save = svc.get("pkg_001", "sess_001");
    expect(save.label).toBe("存档 1");
    expect(save.gameState.round).toBe(3);
  });

  it("get throws for non-existent save", () => {
    expect(() => svc.get("pkg_001", "nonexistent")).toThrow("Save not found: nonexistent");
  });

  it("list returns saves sorted by updatedAt descending", async () => {
    const gs1 = structuredClone(mockGameState);
    gs1.sessionId = "sess_001";
    const gs2 = structuredClone(mockGameState);
    gs2.sessionId = "sess_002";
    const gs3 = structuredClone(mockGameState);
    gs3.sessionId = "sess_003";

    svc.save("pkg_001", "Oldest", gs1, []);
    await new Promise((r) => setTimeout(r, 10));
    svc.save("pkg_001", "Middle", gs2, []);
    await new Promise((r) => setTimeout(r, 10));
    svc.save("pkg_001", "Newest", gs3, []);

    const saves = svc.list("pkg_001");
    expect(saves).toHaveLength(3);
    // Most recent first
    expect(saves[0].sessionId).toBe("sess_003");
    expect(saves[1].sessionId).toBe("sess_002");
    expect(saves[2].sessionId).toBe("sess_001");
  });

  it("list returns meta fields without full data", () => {
    svc.save("pkg_001", "存档", structuredClone(mockGameState), structuredClone(mockMessages));
    const saves = svc.list("pkg_001");
    expect(saves[0]).toHaveProperty("sessionId");
    expect(saves[0]).toHaveProperty("label");
    expect(saves[0]).toHaveProperty("round");
    expect(saves[0]).toHaveProperty("status");
    expect(saves[0]).toHaveProperty("messageCount");
    expect(saves[0]).not.toHaveProperty("gameState");
    expect(saves[0]).not.toHaveProperty("messages");
  });

  it("delete removes a save file", () => {
    svc.save("pkg_001", "To Delete", structuredClone(mockGameState), structuredClone(mockMessages));
    expect(svc.list("pkg_001")).toHaveLength(1);
    svc.delete("pkg_001", "sess_001");
    expect(svc.list("pkg_001")).toHaveLength(0);
  });

  it("delete is idempotent for non-existent saves", () => {
    expect(() => svc.delete("pkg_001", "ghost")).not.toThrow();
  });

  it("save preserves createdAt from existing save on re-save", async () => {
    const gs = structuredClone(mockGameState);
    const save1 = svc.save("pkg_001", "First", gs, []);
    const createdAt = save1.createdAt;
    await new Promise((r) => setTimeout(r, 5));
    // Re-save with updated data
    gs.round = 5;
    const save2 = svc.save("pkg_001", "Updated", gs, []);
    expect(save2.createdAt).toBe(createdAt);
    expect(save2.updatedAt).not.toBe(createdAt);
    expect(save2.gameState.round).toBe(5);
  });
});
