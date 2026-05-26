import { describe, it, expect, beforeEach } from "vitest";
import { CharacterService } from "../characterService.js";
import type { Character } from "@story-game/shared";

const qiaofeng: Character = {
  id: "qiaofeng",
  name: "乔峰",
  role: "主导者",
  avatar: "乔",
  personaPrompt: "You are Qiao Feng",
  rules: ["be brave"],
  skillIds: [],
  knowledgeBaseIds: []
};

const xuzhu: Character = {
  id: "xuzhu",
  name: "虚竹",
  role: "行动者",
  avatar: "虚",
  personaPrompt: "You are Xu Zhu",
  rules: [],
  skillIds: [],
  knowledgeBaseIds: []
};

describe("CharacterService", () => {
  let svc: CharacterService;
  beforeEach(() => { svc = new CharacterService(structuredClone([qiaofeng, xuzhu])); });

  it("lists all characters", () => {
    expect(svc.list()).toHaveLength(2);
  });

  it("gets by id", () => {
    expect(svc.get("qiaofeng").name).toBe("乔峰");
  });

  it("get throws on unknown id", () => {
    expect(() => svc.get("duanyu" as any)).toThrow();
  });

  it("updates a character", () => {
    svc.update("qiaofeng", { ...qiaofeng, name: "乔帮主" });
    expect(svc.get("qiaofeng").name).toBe("乔帮主");
  });

  it("update preserves id", () => {
    expect(() => svc.update("qiaofeng", { ...qiaofeng, id: "xuzhu" })).toThrow();
  });

  it("update throws on unknown id", () => {
    expect(() => svc.update("duanyu" as any, qiaofeng)).toThrow();
  });

  it("replaceAll", () => {
    svc.replaceAll([xuzhu]);
    expect(svc.list()).toHaveLength(1);
  });
});
