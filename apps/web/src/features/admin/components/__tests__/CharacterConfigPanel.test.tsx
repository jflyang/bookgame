import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Character, KnowledgeDocument, StoryPackage } from "@story-game/shared";

const mocks = vi.hoisted(() => ({
  saveCharacter: vi.fn(),
  saveKnowledgeDocuments: vi.fn(),
  saveStoryPackage: vi.fn(),
  getState: vi.fn(),
  characters: [] as Character[],
  knowledgeDocuments: [] as KnowledgeDocument[],
  storyPackages: [] as StoryPackage[],
  editingPackageId: null as string | null,
}));

vi.mock("../../../../store/gameStore.js", () => ({
  useGameStore: Object.assign(
    (selector?: (s: unknown) => unknown) => {
      const state = {
        characters: mocks.characters,
        knowledgeDocuments: mocks.knowledgeDocuments,
        storyPackages: mocks.storyPackages,
        editingPackageId: mocks.editingPackageId,
        saveCharacter: (...args: unknown[]) => mocks.saveCharacter(...args),
        saveKnowledgeDocuments: (...args: unknown[]) => mocks.saveKnowledgeDocuments(...args),
        saveStoryPackage: (...args: unknown[]) => mocks.saveStoryPackage(...args),
      };
      return selector ? selector(state) : state;
    },
    { getState: mocks.getState },
  ),
}));

import { CharacterConfigPanel } from "../CharacterConfigPanel.js";

const QIAOFENG: Character = {
  id: "qiaofeng",
  name: "乔峰",
  role: "主导者",
  avatar: "乔",
  personaPrompt: "乔峰是一位豪迈的英雄。",
  rules: [],
  skillIds: [],
  knowledgeBaseIds: [],
};

const XUZHU: Character = {
  id: "xuzhu",
  name: "虚竹",
  role: "辅助",
  avatar: "虚",
  personaPrompt: "虚竹是一位善良的和尚。",
  rules: [],
  skillIds: [],
  knowledgeBaseIds: [],
};

const defaultCharacters: Character[] = [QIAOFENG, XUZHU];

const defaultStoryPackage: StoryPackage = {
  id: "pkg_001",
  title: "测试故事",
  description: "",
  hidden: false,
  thumbnail: "",
  storySettingPrompt: "",
  scenario: {
    id: "sc1",
    title: "测试",
    premise: "",
    currentStage: "opening",
    stages: ["opening"],
    stageDetails: [],
    currentGoal: "",
    rules: [],
    initialStates: [
      { characterId: "qiaofeng", hp: 1000, mp: 800 },
      { characterId: "xuzhu", hp: 600, mp: 2000 },
    ],
  },
  characters: defaultCharacters,
  skills: [],
  knowledgeDocuments: [],
  promptRules: [],
  debugConfig: { showPromptLayers: false, showRawOutput: false, showValidation: false },
  createdAt: "2026-05-27T00:00:00.000Z",
  updatedAt: "2026-05-27T00:00:00.000Z",
};

describe("CharacterConfigPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.characters = [...defaultCharacters];
    mocks.knowledgeDocuments = [];
    mocks.storyPackages = [defaultStoryPackage];
    mocks.editingPackageId = "pkg_001";
    mocks.saveCharacter.mockResolvedValue(undefined);
    mocks.saveKnowledgeDocuments.mockResolvedValue(undefined);
    mocks.saveStoryPackage.mockResolvedValue(undefined);
    mocks.getState.mockReturnValue({
      storyPackages: [defaultStoryPackage],
      characters: [...defaultCharacters],
      knowledgeDocuments: [],
      editingPackageId: "pkg_001",
      saveStoryPackage: mocks.saveStoryPackage,
    });
    window.confirm = vi.fn(() => true);
    window.alert = vi.fn();
  });

  it("renders character list from story package", () => {
    render(<CharacterConfigPanel />);

    expect(screen.getByText("角色列表")).toBeTruthy();
    expect(screen.getByText("虚竹")).toBeTruthy();
    expect(screen.getByText("新增角色")).toBeTruthy();
  });

  it("clicking a character opens the editor panel with their details", async () => {
    render(<CharacterConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText("当前编辑")).toBeTruthy();
    });

    // Editor shows the selected character's basic info
    expect(screen.getByDisplayValue("乔峰")).toBeTruthy();
    expect(screen.getByDisplayValue("主导者")).toBeTruthy();

    // Click the other character in the sidebar
    fireEvent.click(screen.getByLabelText("编辑角色 虚竹"));

    await waitFor(() => {
      expect(screen.getByDisplayValue("虚竹")).toBeTruthy();
      expect(screen.getByDisplayValue("辅助")).toBeTruthy();
    });
  });

  it("edits character name, role, and persona prompt", async () => {
    render(<CharacterConfigPanel />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("乔峰")).toBeTruthy();
    });

    const nameInput = screen.getByDisplayValue("乔峰");
    fireEvent.change(nameInput, { target: { value: "乔帮主" } });
    expect(screen.getByDisplayValue("乔帮主")).toBeTruthy();

    const roleInput = screen.getByDisplayValue("主导者");
    fireEvent.change(roleInput, { target: { value: "丐帮帮主" } });
    expect(screen.getByDisplayValue("丐帮帮主")).toBeTruthy();

    const personaTextarea = screen.getByDisplayValue("乔峰是一位豪迈的英雄。");
    fireEvent.change(personaTextarea, { target: { value: "乔帮主豪气干云。" } });
    expect(screen.getByDisplayValue("乔帮主豪气干云。")).toBeTruthy();
  });

  it("edits initial states (hp/mp) and saves the role", async () => {
    render(<CharacterConfigPanel />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("乔峰")).toBeTruthy();
    });

    const hpInputs = document.querySelectorAll<HTMLInputElement>('input[type="number"]');
    expect(hpInputs.length).toBeGreaterThanOrEqual(2);

    fireEvent.change(hpInputs[0], { target: { value: "1200" } });
    fireEvent.change(hpInputs[1], { target: { value: "900" } });

    fireEvent.click(screen.getByText("保存角色"));

    await waitFor(() => {
      expect(mocks.saveStoryPackage).toHaveBeenCalled();
      const saved = mocks.saveStoryPackage.mock.calls[0][0] as StoryPackage;
      const qfState = saved.scenario.initialStates.find((s) => s.characterId === "qiaofeng");
      expect(qfState).toBeDefined();
      expect(qfState!.hp).toBe(1200);
      expect(qfState!.mp).toBe(900);
    });
  });

  it("adds a new character via the new character form", async () => {
    render(<CharacterConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText("新增角色")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("新增角色"));

    await waitFor(() => {
      expect(screen.getByText("新建角色")).toBeTruthy();
      expect(screen.getByText("创建角色")).toBeTruthy();
      expect(screen.getByText("取消")).toBeTruthy();
    });

    const nameInput = screen.getByPlaceholderText("例如：扫地僧");
    fireEvent.change(nameInput, { target: { value: "段誉" } });
    const roleInput = screen.getByPlaceholderText("例如：隐藏高手");
    fireEvent.change(roleInput, { target: { value: "主角" } });

    fireEvent.click(screen.getByText("创建角色"));

    await waitFor(() => {
      expect(mocks.getState).toHaveBeenCalled();
      expect(mocks.saveStoryPackage).toHaveBeenCalled();
      const saved = mocks.saveStoryPackage.mock.calls[0][0] as StoryPackage;
      expect(saved.characters.length).toBe(3);
      expect(saved.characters.some((c) => c.name === "段誉")).toBe(true);
    });
  });

  it("renders knowledge document list for the selected character", async () => {
    mocks.knowledgeDocuments = [
      {
        id: "kb_qiaofeng_001",
        title: "降龙十八掌",
        ownerId: "qiaofeng",
        content: "降龙十八掌是丐帮镇帮绝学...",
        sourceType: "markdown",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "kb_qiaofeng_002",
        title: "打狗棒法",
        ownerId: "qiaofeng",
        content: "丐帮帮主历代相传的武功...",
        sourceType: "markdown",
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ];

    render(<CharacterConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText("降龙十八掌")).toBeTruthy();
      expect(screen.getByText("打狗棒法")).toBeTruthy();
    });

    expect(screen.queryByText(/还没有上传 Markdown 知识库/)).toBeNull();
  });

  it("deletes a character with confirmation", async () => {
    render(<CharacterConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText("当前编辑")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("删除角色"));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining("乔峰"),
      );
      expect(mocks.saveStoryPackage).toHaveBeenCalled();
      const saved = mocks.saveStoryPackage.mock.calls[0][0] as StoryPackage;
      expect(saved.characters.length).toBe(1);
      expect(saved.characters[0].id).not.toBe("qiaofeng");
    });
  });

  it("shows alert when trying to delete the last character", async () => {
    mocks.characters = [QIAOFENG];

    render(<CharacterConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText("当前编辑")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("删除角色"));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("至少保留一个角色");
    });

    expect(mocks.saveStoryPackage).not.toHaveBeenCalled();
  });

  it("renders image upload area (avatar camera triggers)", () => {
    render(<CharacterConfigPanel />);

    const cameraButtons = document.querySelectorAll('[title="上传头像"]');
    expect(cameraButtons.length).toBeGreaterThanOrEqual(1);

    // Avatar upload inputs accept images only (not the knowledge doc upload input)
    const avatarInputs = document.querySelectorAll<HTMLInputElement>('[title="上传头像"] input[type="file"]');
    expect(avatarInputs.length).toBeGreaterThanOrEqual(1);
    avatarInputs.forEach((input) => {
      expect(input.accept).toBe("image/*");
    });
  });

  it("renders empty state when there are no characters", () => {
    mocks.characters = [];

    const { container } = render(<CharacterConfigPanel />);

    expect(container.innerHTML).toBe("");
  });
});
