import { describe, it, expect, beforeEach } from "vitest";
import { SkillService } from "../skillService.js";
import type { Skill } from "@story-game/shared";

const punch: Skill = {
  id: "punch",
  name: "Punch",
  ownerId: "qiaofeng",
  cost: { mp: 10 },
  damage: { min: 15, max: 25 },
  effect: "Hurts",
  description: "A basic punch",
};

const kick: Skill = {
  id: "kick",
  name: "Kick",
  ownerId: "qiaofeng",
  cost: { mp: 15 },
  damage: { min: 20, max: 35 },
  effect: "Stuns",
  description: "A powerful kick",
};

const heal: Skill = {
  id: "heal",
  name: "Heal",
  ownerId: "xuzhu",
  cost: { mp: 20 },
  effect: "Restores HP",
  description: "A healing skill",
};

describe("SkillService", () => {
  let svc: SkillService;

  beforeEach(() => {
    svc = new SkillService(structuredClone([punch, kick, heal]));
  });

  it("list returns all skills", () => {
    expect(svc.list()).toHaveLength(3);
  });

  it("get returns skill by id", () => {
    const skill = svc.get("punch");
    expect(skill?.name).toBe("Punch");
    expect(skill?.ownerId).toBe("qiaofeng");
  });

  it("get returns undefined for unknown id", () => {
    expect(svc.get("nonexistent")).toBeUndefined();
  });

  it("listByOwner filters skills by ownerId", () => {
    const skills = svc.listByOwner("qiaofeng");
    expect(skills).toHaveLength(2);
    expect(skills.every((s) => s.ownerId === "qiaofeng")).toBe(true);
  });

  it("listByOwner returns empty array when no skills match", () => {
    const skills = svc.listByOwner("dingchunqiu" as any);
    expect(skills).toEqual([]);
  });

  it("replaceAll replaces the skills array", () => {
    svc.replaceAll([structuredClone(heal)]);
    expect(svc.list()).toHaveLength(1);
    expect(svc.list()[0].id).toBe("heal");
  });

  it("replaceAll with empty array clears skills", () => {
    svc.replaceAll([]);
    expect(svc.list()).toHaveLength(0);
  });

  it("replaceAll modifies the same array reference", () => {
    const listBefore = svc.list();
    svc.replaceAll([structuredClone(punch)]);
    expect(svc.list()).toBe(listBefore);
    expect(svc.list()).toHaveLength(1);
  });
});
