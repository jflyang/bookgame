import { describe, it, expect, beforeEach, vi } from "vitest";
import { AgentService } from "../agentService.js";
import type { CharacterService } from "../characterService.js";
import type { KnowledgeBaseService } from "../knowledgeBaseService.js";

describe("AgentService", () => {
  let svc: AgentService;
  let mockCharacters: CharacterService;
  let mockKnowledgeBase: KnowledgeBaseService;

  beforeEach(() => {
    mockCharacters = {
      get: vi.fn(),
    } as unknown as CharacterService;
    mockKnowledgeBase = {
      retrieve: vi.fn(),
    } as unknown as KnowledgeBaseService;
    svc = new AgentService(mockCharacters, mockKnowledgeBase);
  });

  it("buildAgentContext returns character and knowledge hits for a query", () => {
    const character = { id: "qiaofeng", name: "乔峰" };
    const hits = [{ documentId: "d1", title: "Doc", content: "Content", score: 2 }];
    (mockCharacters.get as any).mockReturnValue(character);
    (mockKnowledgeBase.retrieve as any).mockReturnValue(hits);

    const result = svc.buildAgentContext("qiaofeng", "brave");
    expect(result.character).toBe(character);
    expect(result.knowledgeHits).toBe(hits);
    expect(mockCharacters.get).toHaveBeenCalledWith("qiaofeng");
    expect(mockKnowledgeBase.retrieve).toHaveBeenCalledWith("qiaofeng", character.knowledgeBaseIds, "brave");
  });

  it("buildAgentContext works with empty knowledgeBaseIds result", () => {
    const character = { id: "xuzhu", name: "虚竹", knowledgeBaseIds: [] };
    (mockCharacters.get as any).mockReturnValue(character);
    (mockKnowledgeBase.retrieve as any).mockReturnValue([]);

    const result = svc.buildAgentContext("xuzhu", "mercy");
    expect(result.character).toBe(character);
    expect(result.knowledgeHits).toEqual([]);
    expect(mockKnowledgeBase.retrieve).toHaveBeenCalledWith("xuzhu", [], "mercy");
  });

  it("buildAgentContext passes character's knowledgeBaseIds to retrieve", () => {
    const character = { id: "dingchunqiu", name: "丁春秋", knowledgeBaseIds: ["k1", "k2"] };
    (mockCharacters.get as any).mockReturnValue(character);
    (mockKnowledgeBase.retrieve as any).mockReturnValue([]);

    svc.buildAgentContext("dingchunqiu", "poison");
    expect(mockKnowledgeBase.retrieve).toHaveBeenCalledWith("dingchunqiu", ["k1", "k2"], "poison");
  });
});
