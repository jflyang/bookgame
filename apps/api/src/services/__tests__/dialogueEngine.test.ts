import { describe, it, expect, beforeEach, vi } from "vitest";
import { DialogueEngine } from "../dialogueEngine.js";
import type {
  Character,
  Skill,
  GameState,
  Scenario,
  Message,
  StoryPackage,
  CreateSessionRequest,
  SendMessageRequest,
} from "@story-game/shared";

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: "qiaofeng",
    name: "乔峰",
    role: "主导者",
    avatar: "乔",
    personaPrompt: "You are Qiao Feng",
    rules: [],
    skillIds: [],
    knowledgeBaseIds: [],
    ...overrides,
  };
}

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "s1",
    name: "Punch",
    ownerId: "qiaofeng",
    cost: { mp: 10 },
    damage: { min: 15, max: 25 },
    effect: "Hurts",
    description: "A punch",
    ...overrides,
  };
}

function makeGameState(overrides: Record<string, unknown> = {}): GameState {
  return {
    sessionId: "sess_001",
    round: 1,
    status: "active",
    lastSpeakerId: null,
    characters: [
      {
        characterId: "qiaofeng" as const,
        hp: 100,
        mp: 80,
        conditions: [],
        isDefeated: false,
      },
    ],
    scenario: {
      id: "sc_001",
      title: "Test",
      currentStage: "opening",
      currentGoal: "Goal",
      premise: "Premise",
      rules: [],
      stages: ["opening", "end"],
      initialStates: [],
    },
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    scenarioId: "sc_001",
    ...overrides,
  } as GameState;
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg_001",
    sessionId: "sess_001",
    role: "assistant",
    speakerId: "qiaofeng",
    content: "Hello",
    usedSkills: [],
    stateDelta: {},
    createdAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeStoryPackage(overrides: Partial<StoryPackage> = {}): StoryPackage {
  return {
    id: "pkg_001",
    title: "Test Package",
    description: "A test",
    storySettingPrompt: "Test setting",
    scenario: {
      id: "sc_001",
      title: "Test",
      currentStage: "opening",
      currentGoal: "Goal",
      premise: "Premise",
      rules: [],
      stages: ["opening", "end"],
      initialStates: [],
    },
    characters: [makeCharacter()],
    skills: [makeSkill()],
    knowledgeDocuments: [],
    promptRules: [],
    debugConfig: {
      showPromptLayers: false,
      showRawOutput: false,
      showValidation: false,
    },
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("DialogueEngine", () => {
  let engine: DialogueEngine;
  let mockCharacters: Record<string, ReturnType<typeof vi.fn>>;
  let mockScenarios: Record<string, ReturnType<typeof vi.fn>>;
  let mockMemory: Record<string, ReturnType<typeof vi.fn>>;
  let mockStates: Record<string, ReturnType<typeof vi.fn>>;
  let mockStoryPackages: Record<string, ReturnType<typeof vi.fn>>;
  let mockKnowledgeBase: Record<string, ReturnType<typeof vi.fn>>;
  let mockAuditLog: Record<string, ReturnType<typeof vi.fn>>;
  let mockActivator: Record<string, ReturnType<typeof vi.fn>>;
  let mockTurnProcessor: Record<string, ReturnType<typeof vi.fn>>;
  let mockSessionCollector: Record<string, ReturnType<typeof vi.fn>>;

  const character = makeCharacter();
  const skill = makeSkill();
  const gameState = makeGameState();
  const message = makeMessage();
  const storyPackage = makeStoryPackage();

  beforeEach(() => {
    mockCharacters = {
      get: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
    };
    mockScenarios = { replaceAll: vi.fn() };
    mockMemory = {
      append: vi.fn(),
      recent: vi.fn(),
      list: vi.fn(),
      restore: vi.fn(),
    };
    mockStates = {
      get: vi.fn(),
      createSession: vi.fn(),
      restore: vi.fn(),
      updateScenario: vi.fn(),
    };
    mockStoryPackages = {
      get: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    };
    mockKnowledgeBase = { list: vi.fn() };
    mockAuditLog = { append: vi.fn() };
    mockActivator = { activate: vi.fn() };
    mockTurnProcessor = {
      sendMessage: vi.fn(),
      sendMessageStream: vi.fn(),
    };
    mockSessionCollector = {
      create: vi.fn(),
      markActive: vi.fn(),
      restore: vi.fn(),
    };

    mockCharacters.list.mockReturnValue([character]);
    mockKnowledgeBase.list.mockReturnValue([]);
    mockStates.createSession.mockReturnValue(gameState);
    mockStates.get.mockReturnValue(gameState);
    mockMemory.list.mockReturnValue([message]);
    mockActivator.activate.mockReturnValue(storyPackage);
    mockStoryPackages.list.mockReturnValue([storyPackage]);
    mockStoryPackages.get.mockReturnValue(storyPackage);

    engine = new DialogueEngine(
      mockCharacters as never,
      mockScenarios as never,
      mockMemory as never,
      mockStates as never,
      mockStoryPackages as never,
      mockKnowledgeBase as never,
      mockAuditLog as never,
      mockActivator as never,
      mockTurnProcessor as never,
      undefined,
      mockSessionCollector as never
    );
  });

  // ---------------------------------------------------------------------------
  // createSession
  // ---------------------------------------------------------------------------

  it("createSession without storyPackageId", () => {
    const input: CreateSessionRequest = {
      scenarioId: "sc_001",
      characterIds: ["qiaofeng"],
    };
    const result = engine.createSession(input);

    expect(mockStates.createSession).toHaveBeenCalledWith(input);
    expect(mockActivator.activate).not.toHaveBeenCalled();
    expect(result.sessionId).toBe("sess_001");
    expect(result.characters).toEqual([character]);
    expect(result.skills).toEqual([]);
  });

  it("createSession with storyPackageId activates and overrides input", () => {
    const input: CreateSessionRequest = { storyPackageId: "pkg_001" };
    const result = engine.createSession(input);

    expect(mockActivator.activate).toHaveBeenCalledWith("pkg_001");
    expect(mockStates.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        scenarioId: "sc_001",
        characterIds: ["qiaofeng"],
      })
    );
    expect(result.sessionId).toBe("sess_001");
  });

  it("createSession persists via sessionCollector when available", () => {
    engine = new DialogueEngine(
      mockCharacters as never,
      mockScenarios as never,
      mockMemory as never,
      mockStates as never,
      mockStoryPackages as never,
      mockKnowledgeBase as never,
      mockAuditLog as never,
      mockActivator as never,
      mockTurnProcessor as never,
      undefined,
      mockSessionCollector as never
    );

    engine.createSession({ storyPackageId: "pkg_001" });

    expect(mockSessionCollector.create).toHaveBeenCalledWith(
      "sess_001",
      storyPackage,
      gameState
    );
  });

  it("createSession writes audit log", () => {
    engine.createSession({ scenarioId: "sc_001", characterIds: ["qiaofeng"] });

    expect(mockAuditLog.append).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "session_created",
        sessionId: "sess_001",
      })
    );
  });

  // ---------------------------------------------------------------------------
  // getSessionState
  // ---------------------------------------------------------------------------

  it("getSessionState returns game state, characters, skills, knowledge", () => {
    const result = engine.getSessionState("sess_001");

    expect(mockStates.get).toHaveBeenCalledWith("sess_001");
    expect(result.gameState).toBe(gameState);
    expect(result.characters).toEqual([character]);
    expect(result.skills).toEqual([]);
    expect(result.knowledgeDocuments).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // getMessages
  // ---------------------------------------------------------------------------

  it("getMessages returns messages from memory", () => {
    const result = engine.getMessages("sess_001");

    expect(mockStates.get).toHaveBeenCalledWith("sess_001");
    expect(mockMemory.list).toHaveBeenCalledWith("sess_001");
    expect(result).toEqual([message]);
  });

  // ---------------------------------------------------------------------------
  // restoreSession
  // ---------------------------------------------------------------------------

  it("restoreSession restores state, memory, and maps package", () => {
    const restoredGameState = makeGameState({ sessionId: "sess_restored" });
    const messages = [makeMessage({ sessionId: "sess_restored" })];

    const result = engine.restoreSession(
      "pkg_001",
      restoredGameState,
      messages
    );

    expect(mockActivator.activate).toHaveBeenCalledWith("pkg_001");
    expect(mockStates.restore).toHaveBeenCalledWith(restoredGameState);
    expect(mockMemory.restore).toHaveBeenCalledWith("sess_restored", messages);
    expect(result.sessionId).toBe("sess_restored");
    expect(result.messages).toBe(messages);
  });

  it("restoreSession persists via sessionCollector when available", () => {
    const restoredGameState = makeGameState({ sessionId: "sess_restored" });
    const messages = [makeMessage({ sessionId: "sess_restored" })];

    engine = new DialogueEngine(
      mockCharacters as never,
      mockScenarios as never,
      mockMemory as never,
      mockStates as never,
      mockStoryPackages as never,
      mockKnowledgeBase as never,
      mockAuditLog as never,
      mockActivator as never,
      mockTurnProcessor as never,
      undefined,
      mockSessionCollector as never
    );

    engine.restoreSession("pkg_001", restoredGameState, messages);

    expect(mockSessionCollector.restore).toHaveBeenCalledWith(
      "sess_restored",
      "pkg_001",
      storyPackage.title,
      restoredGameState,
      messages.length
    );
  });

  // ---------------------------------------------------------------------------
  // getCharacters
  // ---------------------------------------------------------------------------

  it("getCharacters returns characters, skills, knowledge", () => {
    const result = engine.getCharacters();

    expect(result.characters).toEqual([character]);
    expect(result.skills).toEqual([]);
    expect(result.knowledgeDocuments).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // updateCharacter
  // ---------------------------------------------------------------------------

  it("updateCharacter delegates to CharacterService", () => {
    const updated = { ...character, name: "乔帮主" };
    mockCharacters.update.mockReturnValue(updated);

    const result = engine.updateCharacter("qiaofeng", updated);

    expect(mockCharacters.update).toHaveBeenCalledWith("qiaofeng", updated);
    expect(result.character).toBe(updated);
    expect(result.characters).toEqual([character]);
  });

  // ---------------------------------------------------------------------------
  // updateScenario
  // ---------------------------------------------------------------------------

  it("updateScenario delegates to GameStateService", () => {
    const scenario: Scenario = {
      id: "sc_001",
      title: "Updated",
      currentStage: "end",
      currentGoal: "New goal",
      premise: "New premise",
      rules: [],
      stages: ["opening", "end"],
      initialStates: [],
    };
    mockStates.updateScenario.mockReturnValue(gameState);

    const result = engine.updateScenario("sess_001", scenario);

    expect(mockStates.updateScenario).toHaveBeenCalledWith(
      "sess_001",
      scenario
    );
    expect(result.gameState).toBe(gameState);
  });

  // ---------------------------------------------------------------------------
  // Story package CRUD
  // ---------------------------------------------------------------------------

  it("listStoryPackages delegates to StoryPackageService", () => {
    const result = engine.listStoryPackages();

    expect(mockStoryPackages.list).toHaveBeenCalled();
    expect(result.storyPackages).toEqual([storyPackage]);
  });

  it("createStoryPackage delegates to StoryPackageService", () => {
    const newPkg = makeStoryPackage({ id: "pkg_new", title: "New" });
    mockStoryPackages.create.mockReturnValue(newPkg);

    const result = engine.createStoryPackage("New", "pkg_001");

    expect(mockStoryPackages.create).toHaveBeenCalledWith("New", "pkg_001");
    expect(result.storyPackage).toBe(newPkg);
  });

  it("updateStoryPackage delegates to StoryPackageService", () => {
    const updated = makeStoryPackage({ title: "Updated" });
    mockStoryPackages.upsert.mockReturnValue(updated);

    const result = engine.updateStoryPackage(updated);

    expect(mockStoryPackages.upsert).toHaveBeenCalledWith(updated);
    expect(result.storyPackage).toBe(updated);
  });

  it("deleteStoryPackage delegates to StoryPackageService", () => {
    mockStoryPackages.delete.mockReturnValue(true);

    const result = engine.deleteStoryPackage("pkg_001");

    expect(mockStoryPackages.delete).toHaveBeenCalledWith("pkg_001");
    expect(result.removed).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // sendMessage / sendMessageStream
  // ---------------------------------------------------------------------------

  it("sendMessage wraps turnProcessor and marks session active", async () => {
    const turnResult = {
      message: makeMessage(),
      gameState,
      debug: { selectedSpeakerId: "qiaofeng", usedSkill: null, promptLayers: [], validation: "passed" },
    };
    mockTurnProcessor.sendMessage.mockResolvedValue(turnResult);
    mockMemory.list.mockReturnValue([message, makeMessage({ id: "msg_002" })]);

    const result = await engine.sendMessage("sess_001", { text: "hi" });

    expect(mockTurnProcessor.sendMessage).toHaveBeenCalledWith("sess_001", {
      text: "hi",
    });
    expect(result).toBe(turnResult);
    expect(mockSessionCollector.markActive).toHaveBeenCalledWith(
      "sess_001",
      gameState,
      2
    );
  });

  it("sendMessageStream wraps turnProcessor stream", async () => {
    async function* mockStream() {
      yield { type: "meta" as const, speakerId: "qiaofeng", speakerName: "乔峰" };
      yield { type: "token" as const, token: "Hello", speakerId: "qiaofeng" };
    }
    mockTurnProcessor.sendMessageStream.mockReturnValue(mockStream());
    mockStates.get.mockReturnValue(gameState);

    const events: unknown[] = [];
    for await (const event of engine.sendMessageStream("sess_001", {
      text: "hi",
    })) {
      events.push(event);
    }

    expect(mockTurnProcessor.sendMessageStream).toHaveBeenCalledWith(
      "sess_001",
      { text: "hi" }
    );
    expect(events).toHaveLength(2);
    expect(mockSessionCollector.markActive).toHaveBeenCalledWith(
      "sess_001",
      gameState,
      1
    );
  });
});
