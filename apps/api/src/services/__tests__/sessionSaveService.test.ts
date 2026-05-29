import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SessionSaveService, MAX_SAVE_SLOTS, AUTO_SAVE_SLOT } from "../sessionSaveService.js";
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

  describe("listSlots", () => {
    it("returns 4 slots (auto + 3 manual) when no saves exist", () => {
      const slots = svc.listSlots("pkg_001");
      expect(slots).toHaveLength(MAX_SAVE_SLOTS + 1); // auto-save + manual slots
      expect(slots[0].slot).toBe(AUTO_SAVE_SLOT);
      expect(slots.every((s) => s.save === null)).toBe(true);
    });

    it("returns populated slots after saving", () => {
      svc.saveToSlot("pkg_001", 1, "存档 1", structuredClone(mockGameState), structuredClone(mockMessages));
      const slots = svc.listSlots("pkg_001");
      // slot 0 is auto-save (empty), slot 1 is the saved slot
      expect(slots[0].slot).toBe(AUTO_SAVE_SLOT);
      expect(slots[0].save).toBeNull(); // auto-save is empty
      expect(slots[1].save).not.toBeNull();
      expect(slots[1].save?.label).toBe("存档 1");
      expect(slots[1].save?.round).toBe(3);
      expect(slots[2].save).toBeNull();
      expect(slots[3].save).toBeNull();
    });
  });

  describe("list (legacy)", () => {
    it("list returns empty array when no saves exist", () => {
      const saves = svc.list("pkg_001");
      expect(saves).toEqual([]);
    });

    it("list returns meta fields without full data", () => {
      svc.saveToSlot("pkg_001", 1, "存档", structuredClone(mockGameState), structuredClone(mockMessages));
      const saves = svc.list("pkg_001");
      expect(saves[0]).toHaveProperty("sessionId");
      expect(saves[0]).toHaveProperty("label");
      expect(saves[0]).toHaveProperty("round");
      expect(saves[0]).toHaveProperty("status");
      expect(saves[0]).toHaveProperty("messageCount");
      expect(saves[0]).not.toHaveProperty("gameState");
      expect(saves[0]).not.toHaveProperty("messages");
    });

    it("list returns saves from all slots", () => {
      const gs1 = structuredClone(mockGameState);
      gs1.sessionId = "sess_a";
      const gs2 = structuredClone(mockGameState);
      gs2.sessionId = "sess_b";
      svc.saveToSlot("pkg_001", 1, "Slot1", gs1, []);
      svc.saveToSlot("pkg_001", 3, "Slot3", gs2, []);
      const saves = svc.list("pkg_001");
      expect(saves).toHaveLength(2);
    });
  });

  describe("saveToSlot", () => {
    it("writes to slot-N.session.json file under saves root", () => {
      const save = svc.saveToSlot("pkg_001", 2, "存档 1", structuredClone(mockGameState), structuredClone(mockMessages));
      expect(save.sessionId).toBe("sess_001");
      expect(save.label).toBe("存档 1");
      expect(save.gameState.round).toBe(3);
      expect(existsSync(join(tmpDir, "pkg_001", "slot-2.session.json"))).toBe(true);
    });

    it("allows auto-save slot (0) and throws for invalid slot numbers", () => {
      // slot 0 (auto-save) is now valid
      const save = svc.saveToSlot("pkg_001", AUTO_SAVE_SLOT, "Auto", structuredClone(mockGameState), []);
      expect(save.sessionId).toBe("sess_001");
      expect(existsSync(join(tmpDir, "pkg_001", "slot-auto.session.json"))).toBe(true);
      // slot 4 is still invalid
      expect(() => svc.saveToSlot("pkg_001", 4, "Bad", structuredClone(mockGameState), [])).toThrow("Slot must be");
    });

    it("preserves createdAt on overwrite", async () => {
      const gs = structuredClone(mockGameState);
      const save1 = svc.saveToSlot("pkg_001", 1, "First", gs, []);
      const createdAt = save1.createdAt;
      await new Promise((r) => setTimeout(r, 5));
      gs.round = 5;
      const save2 = svc.saveToSlot("pkg_001", 1, "Updated", gs, []);
      expect(save2.createdAt).toBe(createdAt);
      expect(save2.updatedAt).not.toBe(createdAt);
      expect(save2.gameState.round).toBe(5);
    });
  });

  describe("save (legacy auto-pick)", () => {
    it("auto-picks first empty manual slot", () => {
      const save = svc.save("pkg_001", "Auto", structuredClone(mockGameState), structuredClone(mockMessages));
      expect(existsSync(join(tmpDir, "pkg_001", "slot-1.session.json"))).toBe(true);
      expect(save.label).toBe("Auto");
    });

    it("overwrites slot 3 when all manual slots are full", () => {
      const gs1 = structuredClone(mockGameState); gs1.sessionId = "a";
      const gs2 = structuredClone(mockGameState); gs2.sessionId = "b";
      const gs3 = structuredClone(mockGameState); gs3.sessionId = "c";
      svc.saveToSlot("pkg_001", 1, "S1", gs1, []);
      svc.saveToSlot("pkg_001", 2, "S2", gs2, []);
      svc.saveToSlot("pkg_001", 3, "S3", gs3, []);
      // All manual slots full, legacy save overwrites slot 3
      const gs4 = structuredClone(mockGameState); gs4.sessionId = "d";
      svc.save("pkg_001", "Overflow", gs4, []);
      const slots = svc.listSlots("pkg_001");
      // slot 0 = auto (empty), slot 1 = S1, slot 2 = S2, slot 3 = Overflow
      expect(slots[1].save?.sessionId).toBe("a");
      expect(slots[2].save?.sessionId).toBe("b");
      expect(slots[3].save?.label).toBe("Overflow");
    });
  });

  describe("getBySlot", () => {
    it("reads a previously saved file by slot", () => {
      svc.saveToSlot("pkg_001", 1, "存档 1", structuredClone(mockGameState), structuredClone(mockMessages));
      const save = svc.getBySlot("pkg_001", 1);
      expect(save.label).toBe("存档 1");
      expect(save.gameState.round).toBe(3);
    });

    it("throws for empty slot", () => {
      expect(() => svc.getBySlot("pkg_001", 2)).toThrow("存档槽 2 为空");
    });
  });

  describe("get (legacy by sessionId)", () => {
    it("finds save by sessionId across all slots", () => {
      svc.saveToSlot("pkg_001", 2, "存档 1", structuredClone(mockGameState), structuredClone(mockMessages));
      const save = svc.get("pkg_001", "sess_001");
      expect(save.label).toBe("存档 1");
    });

    it("throws for non-existent save", () => {
      expect(() => svc.get("pkg_001", "nonexistent")).toThrow("未找到会话 nonexistent 的存档");
    });
  });

  describe("deleteBySlot", () => {
    it("removes a save by slot", () => {
      svc.saveToSlot("pkg_001", 1, "To Delete", structuredClone(mockGameState), structuredClone(mockMessages));
      expect(svc.list("pkg_001")).toHaveLength(1);
      svc.deleteBySlot("pkg_001", 1);
      expect(svc.list("pkg_001")).toHaveLength(0);
    });
  });

  describe("delete (legacy by sessionId)", () => {
    it("removes a save by sessionId", () => {
      svc.saveToSlot("pkg_001", 1, "To Delete", structuredClone(mockGameState), structuredClone(mockMessages));
      expect(svc.list("pkg_001")).toHaveLength(1);
      svc.delete("pkg_001", "sess_001");
      expect(svc.list("pkg_001")).toHaveLength(0);
    });

    it("is idempotent for non-existent saves", () => {
      expect(() => svc.delete("pkg_001", "ghost")).not.toThrow();
    });
  });

  describe("rigorous", () => {
    it("isolates saves between different story packages", () => {
      const gsA = structuredClone(mockGameState); gsA.sessionId = "sess_a";
      const gsB = structuredClone(mockGameState); gsB.sessionId = "sess_b";
      svc.saveToSlot("pkg_A", 1, "A-Save", gsA, []);
      svc.saveToSlot("pkg_B", 1, "B-Save", gsB, []);

      const slotsA = svc.listSlots("pkg_A");
      const slotsB = svc.listSlots("pkg_B");
      // slot 0 = auto (empty), slot 1 = manual save
      expect(slotsA[1].save?.label).toBe("A-Save");
      expect(slotsA[1].save?.sessionId).toBe("sess_a");
      expect(slotsB[1].save?.label).toBe("B-Save");
      expect(slotsB[1].save?.sessionId).toBe("sess_b");
    });

    it("auto-creates saves directory on first save", () => {
      const pkgDir = join(tmpDir, "pkg_new");
      expect(existsSync(pkgDir)).toBe(false);
      svc.saveToSlot("pkg_new", 1, "First", structuredClone(mockGameState), []);
      expect(existsSync(pkgDir)).toBe(true);
    });

    it("preserves structured clone integrity — mutating original does not affect saved data", () => {
      const gs = structuredClone(mockGameState);
      gs.round = 1;
      svc.saveToSlot("pkg_001", 1, "Clone Test", gs, structuredClone(mockMessages));

      // Mutate original
      gs.round = 999;
      gs.characters[0].hp = 0;

      const loaded = svc.getBySlot("pkg_001", 1);
      expect(loaded.gameState.round).toBe(1);
      expect(loaded.gameState.characters[0].hp).toBe(680);
    });

    it("listSlots treats corrupt JSON as empty slot", () => {
      const dir = join(tmpDir, "pkg_001");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "slot-1.session.json"), "not valid json {{{");

      const slots = svc.listSlots("pkg_001");
      // slot 0 (auto) + slots 1-3, slot 1 is corrupt → treated as null
      expect(slots[1].slot).toBe(1);
      expect(slots[1].save).toBeNull();
    });

    it("getBySlot throws on corrupt JSON", () => {
      const dir = join(tmpDir, "pkg_001");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "slot-2.session.json"), "garbage {{{[");

      expect(() => svc.getBySlot("pkg_001", 2)).toThrow("文件损坏");
    });

    it("getBySlot throws on incomplete data", () => {
      const dir = join(tmpDir, "pkg_001");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "slot-3.session.json"), JSON.stringify({ sessionId: "s1" }));

      expect(() => svc.getBySlot("pkg_001", 3)).toThrow("数据不完整");
    });

    it("deleteBySlot is idempotent for non-existent slot", () => {
      expect(() => svc.deleteBySlot("pkg_001", 2)).not.toThrow();
    });

    it("full slot lifecycle: fill all 3, delete middle, refill, verify", () => {
      const gs1 = structuredClone(mockGameState); gs1.sessionId = "s1";
      const gs2 = structuredClone(mockGameState); gs2.sessionId = "s2";
      const gs3 = structuredClone(mockGameState); gs3.sessionId = "s3";
      const gs4 = structuredClone(mockGameState); gs4.sessionId = "s4";

      // Fill all 3 manual slots
      svc.saveToSlot("pkg_001", 1, "First", gs1, []);
      svc.saveToSlot("pkg_001", 2, "Second", gs2, []);
      svc.saveToSlot("pkg_001", 3, "Third", gs3, []);
      expect(svc.list("pkg_001")).toHaveLength(3);

      // Delete middle (slot 2)
      svc.deleteBySlot("pkg_001", 2);
      const afterDelete = svc.listSlots("pkg_001");
      // slot 0 = auto (empty), slot 1 = filled, slot 2 = empty, slot 3 = filled
      expect(afterDelete[1].save).not.toBeNull();
      expect(afterDelete[2].save).toBeNull();
      expect(afterDelete[3].save).not.toBeNull();

      // Refill middle
      svc.saveToSlot("pkg_001", 2, "Refilled", gs4, []);
      const afterRefill = svc.listSlots("pkg_001");
      expect(afterRefill[2].save?.label).toBe("Refilled");
      expect(afterRefill[2].save?.sessionId).toBe("s4");
      expect(svc.list("pkg_001")).toHaveLength(3);
    });

    it("save and load with empty messages array", () => {
      svc.saveToSlot("pkg_001", 1, "No Messages", structuredClone(mockGameState), []);
      const loaded = svc.getBySlot("pkg_001", 1);
      expect(loaded.messages).toEqual([]);
      expect(loaded.gameState.round).toBe(3);
    });

    it("listSlots returns correct slot numbers 0-3", () => {
      svc.saveToSlot("pkg_001", 3, "Third Only", structuredClone(mockGameState), []);
      const slots = svc.listSlots("pkg_001");
      expect(slots[0].slot).toBe(AUTO_SAVE_SLOT); // 0
      expect(slots[1].slot).toBe(1);
      expect(slots[2].slot).toBe(2);
      expect(slots[3].slot).toBe(3);
      expect(slots[0].save).toBeNull();   // auto-save empty
      expect(slots[1].save).toBeNull();   // slot 1 empty
      expect(slots[2].save).toBeNull();   // slot 2 empty
      expect(slots[3].save).not.toBeNull(); // slot 3 filled
    });
  });
});
