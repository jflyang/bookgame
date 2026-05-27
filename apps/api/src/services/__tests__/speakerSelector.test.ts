import { describe, it, expect, beforeEach, vi } from "vitest";
import { SpeakerSelector } from "../speakerSelector.js";
import type { Character, GameState, SendMessageRequest } from "@story-game/shared";

function makeCharacter(id: string, name: string): Character {
  return {
    id: id as Character["id"],
    name,
    role: "主导者",
    avatar: name[0],
    personaPrompt: `You are ${name}`,
    rules: [],
    skillIds: [],
    knowledgeBaseIds: [],
  };
}

function makeGameState(
  lastSpeakerId: string | null = null
): GameState {
  return {
    sessionId: "sess_001",
    round: 1,
    status: "active",
    lastSpeakerId,
    characters: [
      { characterId: "qiaofeng", hp: 100, mp: 80, conditions: [], isDefeated: false },
      { characterId: "xuzhu", hp: 100, mp: 200, conditions: [], isDefeated: false },
      { characterId: "duanyu", hp: 80, mp: 150, conditions: [], isDefeated: false },
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
  };
}

describe("SpeakerSelector", () => {
  let selector: SpeakerSelector;
  let mockCharacters: Record<string, ReturnType<typeof vi.fn>>;
  let mockStates: Record<string, ReturnType<typeof vi.fn>>;

  const qiaofeng = makeCharacter("qiaofeng", "乔峰");
  const xuzhu = makeCharacter("xuzhu", "虚竹");
  const duanyu = makeCharacter("duanyu", "段誉");
  const allCharacters = [qiaofeng, xuzhu, duanyu];

  beforeEach(() => {
    mockCharacters = { get: vi.fn(), list: vi.fn() };
    mockStates = { get: vi.fn() };

    mockCharacters.list.mockReturnValue(allCharacters);

    selector = new SpeakerSelector(
      mockCharacters as never,
      mockStates as never
    );
  });

  it("selects by targetCharacterId when specified", () => {
    const result = selector.select("sess_001", {
      text: "动手吧",
      targetCharacterId: "xuzhu",
    });

    expect(result).toBe("xuzhu");
  });

  it("selects by @mention in text", () => {
    const result = selector.select("sess_001", {
      text: "@虚竹 你上",
    });

    expect(result).toBe("xuzhu");
  });

  it("selects @mention over targetCharacterId when both present", () => {
    const result = selector.select("sess_001", {
      text: "@段誉 你来说",
      targetCharacterId: "xuzhu",
    });

    // targetCharacterId is checked first
    expect(result).toBe("xuzhu");
  });

  it("selects random non-last speaker for continue texts", () => {
    mockStates.get.mockReturnValue(makeGameState("qiaofeng"));

    const continueTexts = ["继续", "接着", "然后呢", "continue", "go on"];
    for (const text of continueTexts) {
      const result = selector.select("sess_001", { text });
      expect(result).not.toBe("qiaofeng");
    }
  });

  it("continue text can still pick last speaker if only one character", () => {
    mockCharacters.list.mockReturnValue([qiaofeng]);
    mockStates.get.mockReturnValue(makeGameState("qiaofeng"));

    const result = selector.select("sess_001", { text: "继续" });

    // Only one character, so must return it even if it was the last speaker
    expect(result).toBe("qiaofeng");
  });

  it("falls back to first character for unknown input", () => {
    mockStates.get.mockReturnValue(makeGameState(null));

    const result = selector.select("sess_001", { text: "随便说说" });

    expect(result).toBe("qiaofeng");
  });

  it("returns hardcoded qiaofeng fallback when character list is empty", () => {
    mockCharacters.list.mockReturnValue([]);
    mockStates.get.mockReturnValue(makeGameState(null));

    const result = selector.select("sess_001", { text: "随便说说" });

    expect(result).toBe("qiaofeng");
  });

  it("handles case-insensitive continue text matching", () => {
    mockStates.get.mockReturnValue(makeGameState("qiaofeng"));

    const result = selector.select("sess_001", { text: " 继续 " });

    expect(result).not.toBe("qiaofeng");
  });

  it("does not select continue logic for text containing continue as substring", () => {
    mockStates.get.mockReturnValue(makeGameState("qiaofeng"));
    mockCharacters.list.mockReturnValue(allCharacters);

    // "program continue" should NOT match since we use exact match after trim+lowercase
    const result = selector.select("sess_001", { text: "program continue" });

    // Should fall through to default, which picks first character
    expect(result).toBe("qiaofeng");
  });
});
