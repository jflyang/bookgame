import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Character, StoryPackage, Scenario } from "@story-game/shared";

const mockSaveStoryPackage = vi.fn();

let mockEditingPackageId: string | null = null;
let mockStoryPackages: StoryPackage[] = [];

vi.mock("../../../../store/gameStore.js", () => ({
  useGameStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      editingPackageId: mockEditingPackageId,
      storyPackages: mockStoryPackages,
      saveStoryPackage: (...args: unknown[]) => mockSaveStoryPackage(...args),
    };
    return selector ? selector(state) : state;
  },
}));

import { StorySettingPanel } from "../StorySettingPanel.js";

const characters: Character[] = [
  { id: "qiaofeng", name: "乔峰", role: "主导者", avatar: "", personaPrompt: "", rules: [], skillIds: [], knowledgeBaseIds: [] },
  { id: "xuzhu", name: "虚竹", role: "辅助", avatar: "", personaPrompt: "", rules: [], skillIds: [], knowledgeBaseIds: [] },
];

const defaultScenario: Scenario = {
  id: "scenario_1",
  title: "测试故事",
  premise: "昔年帮主乔峰遭人陷害，江湖风云再起。",
  currentStage: "opening",
  stages: ["opening", "encounter", "crisis"],
  stageDetails: [
    { id: "opening", title: "开场", description: "开场描述", enterWhen: "自动进入", guidance: "描写场景" },
    { id: "encounter", title: "遭遇", description: "遭遇丁春秋", enterWhen: "玩家移动", guidance: "触发战斗" },
    { id: "crisis", title: "危机", description: "毒雾扩散", enterWhen: "战斗结束", guidance: "制造紧张" },
  ],
  currentGoal: "找到丁春秋",
  rules: ["不能使用现代武器", "角色必须遵守门派规则"],
  initialStates: [
    { characterId: "qiaofeng", hp: 1000, mp: 800 },
    { characterId: "xuzhu", hp: 600, mp: 2000 },
  ],
  defaultSpeakerId: "qiaofeng",
};

function createDefaultPackage(overrides?: Partial<StoryPackage>): StoryPackage {
  return {
    id: "pkg_001",
    title: "测试故事",
    description: "测试描述",
    hidden: false,
    thumbnail: "",
    storySettingPrompt: "## 世界观\n\n这是一个江湖故事。",
    scenario: { ...defaultScenario },
    characters,
    skills: [],
    knowledgeDocuments: [],
    promptRules: [],
    debugConfig: { showPromptLayers: false, showRawOutput: false, showValidation: false },
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: "2026-05-27T00:00:00.000Z",
    ...overrides,
  };
}

describe("StorySettingPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditingPackageId = "pkg_001";
    mockStoryPackages = [createDefaultPackage()];
    mockSaveStoryPackage.mockResolvedValue(undefined);
  });

  it("renders scenario title, premise, and currentGoal fields", async () => {
    render(<StorySettingPanel />);

    await waitFor(() => {
      expect(screen.getByText("剧情设定")).toBeTruthy();
      expect(screen.getByText("系统读取配置")).toBeTruthy();
    });

    // Story title input
    expect(screen.getByDisplayValue("测试故事")).toBeTruthy();

    // Expand the legacy fields details
    fireEvent.click(screen.getByText("兼容旧结构字段"));

    await waitFor(() => {
      expect(screen.getByDisplayValue("昔年帮主乔峰遭人陷害，江湖风云再起。")).toBeTruthy();
      expect(screen.getByDisplayValue("找到丁春秋")).toBeTruthy();
    });

    // Verify rules label appears
    expect(screen.getByText("故事规则（一行一条）")).toBeTruthy();
  });

  it("renders stage list with current stages", () => {
    render(<StorySettingPanel />);

    // Stage section heading
    expect(screen.getByText("阶段卡片")).toBeTruthy();

    // All three stage titles should be visible
    expect(screen.getByText("开场")).toBeTruthy();
    expect(screen.getByText("遭遇")).toBeTruthy();
    expect(screen.getByText("危机")).toBeTruthy();

    // Stage IDs should be shown
    expect(screen.getByText("ID: opening")).toBeTruthy();
    expect(screen.getByText("ID: encounter")).toBeTruthy();
    expect(screen.getByText("ID: crisis")).toBeTruthy();
  });

  it("adds a new stage card", async () => {
    render(<StorySettingPanel />);

    const addButton = screen.getByText("添加阶段卡片");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText("新阶段")).toBeTruthy();
    });

    // The new stage should have "新阶段" as its title
    expect(screen.getByDisplayValue("新阶段")).toBeTruthy();
    // ID should be "new_stage" (auto-generated)
    expect(screen.getByDisplayValue("new_stage")).toBeTruthy();
  });

  it("removes a stage card", async () => {
    render(<StorySettingPanel />);

    await waitFor(() => {
      expect(screen.getByText("开场")).toBeTruthy();
    });

    // Click the delete button on the first stage
    const deleteButtons = document.querySelectorAll('[aria-label^="删除阶段"]');
    expect(deleteButtons.length).toBe(3);

    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText("开场")).toBeNull();
      const remainingDeleteButtons = document.querySelectorAll('[aria-label^="删除阶段"]');
      expect(remainingDeleteButtons.length).toBe(2);
    });
  });

  it("moves a stage up", async () => {
    render(<StorySettingPanel />);

    const upButtons = screen.getAllByText("上移");
    expect(upButtons.length).toBe(3);

    // Click "上移" on the second stage (index 1)
    fireEvent.click(upButtons[1]);

    await waitFor(() => {
      expect(screen.getByText("开场")).toBeTruthy();
      expect(screen.getByText("遭遇")).toBeTruthy();
    });

    // After moving up, the second stage id "encounter" should now be first
    const stageFlowIndices = document.querySelectorAll(".stage-flow-index");
    expect(stageFlowIndices[0].textContent).toBe("1");
    // encounter moved up to position 1, opening moved down to position 2
  });

  it("moves a stage down", async () => {
    render(<StorySettingPanel />);

    const downButtons = screen.getAllByText("下移");
    expect(downButtons.length).toBe(3);

    // Click "下移" on the first stage (index 0)
    fireEvent.click(downButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("开场")).toBeTruthy();
      expect(screen.getByText("遭遇")).toBeTruthy();
    });
  });

  it("edits stage detail fields (title, description, enterWhen, guidance)", async () => {
    render(<StorySettingPanel />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("开场")).toBeTruthy();
    });

    // Edit the stage title
    const stageTitleInput = screen.getByDisplayValue("开场");
    fireEvent.change(stageTitleInput, { target: { value: "序幕" } });
    expect(screen.getByDisplayValue("序幕")).toBeTruthy();

    // Edit stage description
    const descTextarea = screen.getByDisplayValue("开场描述");
    fireEvent.change(descTextarea, { target: { value: "序幕拉开，英雄登场" } });
    expect(screen.getByDisplayValue("序幕拉开，英雄登场")).toBeTruthy();

    // Edit enterWhen
    const enterWhenTextarea = screen.getByDisplayValue("自动进入");
    fireEvent.change(enterWhenTextarea, { target: { value: "条件满足时" } });
    expect(screen.getByDisplayValue("条件满足时")).toBeTruthy();

    // Edit guidance
    const guidanceTextarea = screen.getByDisplayValue("描写场景");
    fireEvent.change(guidanceTextarea, { target: { value: "渲染气氛" } });
    expect(screen.getByDisplayValue("渲染气氛")).toBeTruthy();
  });

  it("changes the current stage selector", async () => {
    render(<StorySettingPanel />);

    await waitFor(() => {
      const select = document.querySelector(".current-stage-select select") as HTMLSelectElement;
      expect(select).toBeTruthy();
      expect(select.value).toBe("opening");
    });

    const select = document.querySelector(".current-stage-select select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "crisis" } });

    expect(select.value).toBe("crisis");
  });

  it("calls saveStoryPackage with updated data when saving", async () => {
    render(<StorySettingPanel />);

    await waitFor(() => {
      expect(screen.getAllByText("保存剧情设定").length).toBeGreaterThanOrEqual(1);
    });

    // Click the first save button (there are two: hero and system-config)
    fireEvent.click(screen.getAllByText("保存剧情设定")[0]);

    await waitFor(() => {
      expect(mockSaveStoryPackage).toHaveBeenCalledOnce();
    });

    const saved = mockSaveStoryPackage.mock.calls[0][0] as StoryPackage;
    expect(saved.id).toBe("pkg_001");
    expect(saved.title).toBe("测试故事");
    expect(saved.scenario.title).toBe("测试故事");
    expect(saved.scenario.stages).toEqual(["opening", "encounter", "crisis"]);
    expect(saved.scenario.currentGoal).toBe("找到丁春秋");
    expect(saved.storySettingPrompt).toBe("## 世界观\n\n这是一个江湖故事。");
  });

  it("renders and edits the story setting prompt textarea", async () => {
    render(<StorySettingPanel />);

    await waitFor(() => {
      const promptTextarea = document.querySelector("textarea.story-setting-editor") as HTMLTextAreaElement;
      expect(promptTextarea).toBeTruthy();
      expect(promptTextarea.value).toBe("## 世界观\n\n这是一个江湖故事。");
    });

    const promptTextarea = document.querySelector("textarea.story-setting-editor") as HTMLTextAreaElement;
    fireEvent.change(promptTextarea, { target: { value: "## 新世界观\n\n江湖已变。" } });

    expect(promptTextarea.value).toBe("## 新世界观\n\n江湖已变。");
  });

  it("shows duplicated state hints warning when storySettingPrompt contains state keywords", () => {
    const pkg = createDefaultPackage({
      storySettingPrompt: "## 设定\n\n初始状态：每个角色有气血和内力。\n每次对话最后要输出状态格式。",
    });
    mockStoryPackages = [pkg];

    render(<StorySettingPanel />);

    expect(screen.getByText(/检测到 Markdown 里包含状态数值说明/)).toBeTruthy();
    expect(screen.getByText("清理重复状态段")).toBeTruthy();
  });

  it("removes storySettingPrompt state hints when cleanup button is clicked", async () => {
    const pkg = createDefaultPackage({
      storySettingPrompt: "## 设定\n\n初始状态：每个角色有气血和内力。\n每次对话最后要输出状态格式。\n其余设定。",
    });
    mockStoryPackages = [pkg];

    render(<StorySettingPanel />);

    await waitFor(() => {
      expect(screen.getByText("清理重复状态段")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("清理重复状态段"));

    const promptTextarea = document.querySelector("textarea.story-setting-editor") as HTMLTextAreaElement;
    expect(promptTextarea.value).not.toContain("初始状态");
    expect(promptTextarea.value).not.toContain("状态格式");
    expect(promptTextarea.value).toContain("其余设定");
  });
});
