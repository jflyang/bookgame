import { describe, it, expect, beforeEach, vi } from "vitest";
import { SessionCollector } from "../sessionCollector.js";
import { SessionRepository, type SessionSummary } from "../sessionRepository.js";

function makeSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: "sess_001",
    storyPackageId: "xuzhu_vs_dingchunqiu",
    storyPackageTitle: "虚竹除害星宿老怪",
    round: 3,
    status: "active",
    currentStage: "origin",
    characterStates: [{ name: "乔峰", hp: 700, maxHp: 700, mp: 800, maxMp: 800 }],
    messageCount: 8,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeGameState(overrides: Record<string, unknown> = {}): any {
  return {
    sessionId: "sess_001",
    round: 5,
    status: "active",
    lastSpeakerId: "qiaofeng",
    characters: [
      { characterId: "qiaofeng", hp: 680, mp: 780, conditions: [], isDefeated: false },
      { characterId: "xuzhu", hp: 320, mp: 1800, conditions: [], isDefeated: false },
    ],
    scenario: {
      id: "scenario_1",
      title: "虚竹除害星宿老怪",
      currentStage: "origin",
      initialStates: [
        { characterId: "qiaofeng", hp: 700, mp: 800 },
        { characterId: "xuzhu", hp: 360, mp: 2000 },
      ],
      stages: ["origin"],
      currentGoal: "test",
      premise: "test",
      rules: [],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scenarioId: "scenario_1",
    ...overrides,
  };
}

function makeStoryPackage(): any {
  return {
    id: "xuzhu_vs_dingchunqiu",
    title: "虚竹除害星宿老怪",
    description: "test",
    hidden: false,
    storySettingPrompt: "test",
    scenario: { id: "s1", title: "test", premise: "", currentStage: "origin", currentGoal: "", rules: [], stages: ["origin"], initialStates: [] },
    characters: [],
    skills: [],
    knowledgeDocuments: [],
    promptRules: [],
    debugConfig: { showPromptLayers: false, showRawOutput: false, showValidation: false },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("SessionCollector", () => {
  let collector: SessionCollector;
  let mockRepo: SessionRepository;

  beforeEach(() => {
    mockRepo = {
      upsert: vi.fn(),
      listAll: vi.fn().mockReturnValue([]),
      findByPackage: vi.fn(),
      findByStatus: vi.fn(),
      getById: vi.fn(),
      deleteAll: vi.fn(),
      count: vi.fn().mockReturnValue(0),
      deleteById: vi.fn(),
    } as unknown as SessionRepository;
    collector = new SessionCollector(mockRepo);
  });

  it("create writes session with idle status", () => {
    collector.create("sess_new", makeStoryPackage(), makeGameState({ round: 0 }));
    expect(mockRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sess_new",
        storyPackageId: "xuzhu_vs_dingchunqiu",
        storyPackageTitle: "虚竹除害星宿老怪",
        status: "idle",
        round: 0,
        messageCount: 0,
      })
    );
  });

  it("create snapshots character HP/MP from initialStates", () => {
    collector.create("sess_new", makeStoryPackage(), makeGameState());
    const call = (mockRepo.upsert as any).mock.calls[0][0];
    expect(call.characterStates).toEqual([
      { name: "qiaofeng", hp: 680, maxHp: 700, mp: 780, maxMp: 800 },
      { name: "xuzhu", hp: 320, maxHp: 360, mp: 1800, maxMp: 2000 },
    ]);
  });

  it("markActive updates session after a turn", () => {
    vi.spyOn(mockRepo, "getById").mockReturnValue(makeSummary());
    collector.markActive("sess_001", makeGameState({ round: 6, status: "active" }), 15);
    expect(mockRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sess_001",
        status: "active",
        round: 6,
        messageCount: 15,
      })
    );
  });

  it("markActive sets completed when gameState is completed", () => {
    vi.spyOn(mockRepo, "getById").mockReturnValue(makeSummary());
    collector.markActive("sess_001", makeGameState({ status: "completed" }), 20);
    expect(mockRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" })
    );
  });

  it("markActive skips if session not found in DB", () => {
    vi.spyOn(mockRepo, "getById").mockReturnValue(null);
    collector.markActive("ghost", makeGameState(), 0);
    expect(mockRepo.upsert).not.toHaveBeenCalled();
  });

  it("restore writes session from saved data", () => {
    collector.restore("sess_restored", "pkg_1", "故事A", makeGameState({ round: 4 }), 10);
    expect(mockRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sess_restored",
        storyPackageId: "pkg_1",
        storyPackageTitle: "故事A",
        round: 4,
        messageCount: 10,
      })
    );
  });

  it("listAll delegates to repository", () => {
    const summaries = [makeSummary()];
    vi.spyOn(mockRepo, "listAll").mockReturnValue(summaries);
    expect(collector.listAll()).toBe(summaries);
  });

  it("deleteAll delegates to repository", () => {
    collector.deleteAll();
    expect(mockRepo.deleteAll).toHaveBeenCalled();
  });
});
