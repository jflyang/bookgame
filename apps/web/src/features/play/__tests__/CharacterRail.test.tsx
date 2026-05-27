import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockSelectCharacter = vi.fn();

vi.mock("../../../store/gameStore.js", () => ({
  useGameStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      selectedCharacterId: null,
      selectCharacter: mockSelectCharacter,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock("../UiConfigContext.js", () => ({
  useLabels: () => ({ hp: "气血", mp: "内力", characters: "登场角色", lastSpeaker: "上轮发言" }),
  useUiConfig: () => ({ avatar: { style: "gradient" } }),
}));

vi.mock("../contexts/StoryAssetsContext.js", () => ({
  useStoryAssets: () => ({ getPortraitUrl: () => null }),
}));

import { CharacterRail } from "../components/CharacterRail.js";

const testCharacters = [
  { id: "qiaofeng", name: "乔峰", role: "主导者", avatar: "乔", personaPrompt: "", rules: [], skillIds: [], knowledgeBaseIds: [] },
  { id: "xuzhu", name: "虚竹", role: "主角", avatar: "虚", personaPrompt: "", rules: [], skillIds: [], knowledgeBaseIds: [] },
];

const testStates = [
  { characterId: "qiaofeng", hp: 700, mp: 800, conditions: [], isDefeated: false },
  { characterId: "xuzhu", hp: 200, mp: 1800, conditions: [], isDefeated: false },
];

describe("CharacterRail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders character names", () => {
    render(<CharacterRail characters={testCharacters} states={testStates} lastSpeakerId={null} />);
    expect(screen.getByText("乔峰")).toBeTruthy();
    expect(screen.getByText("虚竹")).toBeTruthy();
  });

  it("shows HP/MP values", () => {
    render(<CharacterRail characters={testCharacters} states={testStates} lastSpeakerId={null} />);
    // HP and MP are rendered via character bars - check for numeric content
    const cards = document.querySelectorAll(".character-card");
    expect(cards.length).toBeGreaterThanOrEqual(2);
    // The component renders HP as numeric text within character cards
    expect(cards[0].textContent).toContain("700");
    expect(cards[1].textContent).toContain("200");
  });

  it("calls selectCharacter on click", () => {
    render(<CharacterRail characters={testCharacters} states={testStates} lastSpeakerId={null} />);
    const card = screen.getByText("乔峰").closest("button");
    if (card) fireEvent.click(card);
    expect(mockSelectCharacter).toHaveBeenCalledWith("qiaofeng");
  });

  it("renders correctly with empty states array", () => {
    render(<CharacterRail characters={testCharacters} states={[]} lastSpeakerId={null} />);
    expect(screen.getByText("乔峰")).toBeTruthy();
  });
});
