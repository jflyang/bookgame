import { nanoid } from "nanoid";
import type { Character, KnowledgeDocument, Scenario, Skill, StoryPackage } from "@story-game/shared";
import { defaultPromptRules } from "../data/defaultPromptRules.js";

export class StoryPackageService {
  private readonly storyPackages: StoryPackage[];

  constructor(characters: Character[], skills: Skill[], scenarios: Scenario[], knowledgeDocuments: KnowledgeDocument[]) {
    const now = new Date().toISOString();
    this.storyPackages = [
      {
        id: "xuzhu_vs_dingchunqiu",
        title: "虚竹除害星宿老怪",
        description: "固定四角色的武侠回合制互动故事 MVP。",
        storySettingPrompt: [
          "# 故事设定：虚竹除害星宿老怪",
          "",
          "虚竹得知丁春秋原是逍遥派叛逆，欺师灭祖，另立星宿派，又以毒功残害江湖中人。",
          "虚竹虽然性情仁厚，不愿轻易伤人，但想到丁春秋多年败坏逍遥派门风，又害死无数无辜，终于决定出手，为门派清理门户。",
          "乔峰与段誉同行。乔峰在一旁为虚竹压阵；段誉退在远处观察战局。",
          "三人在山道旁遇见丁春秋和星宿派弟子，冲突从毒雾开始逐步升级。",
          "",
          "## 本故事包特殊内容",
          "- 初始状态：虚竹 气血:360 内力:2000；乔峰 气血:700 内力:800；段誉 气血:180 内力:260；丁春秋 气血:400 内力:180。",
          "- 每次对话最后应展示统一状态行。",
          "- 状态格式：[状态] 乔峰 气血:XX 内力:XX | 虚竹 气血:XX 内力:XX | 段誉 气血:XX 内力:XX | 丁春秋 气血:XX 内力:XX",
          "- 不要一次性说完整个故事，每次只推进一小步。"
        ].join("\n"),
        scenario: structuredClone(scenarios[0]),
        characters: structuredClone(characters),
        skills: structuredClone(skills),
        knowledgeDocuments: structuredClone(knowledgeDocuments),
        promptRules: structuredClone(defaultPromptRules),
        debugConfig: {
          showPromptLayers: true,
          showRawOutput: false,
          showValidation: true
        },
        uiConfig: {
          layout: {
            showCharacterPanel: true,
            showQuickActions: true,
            showDiceButton: true,
            showAutoPlay: true
          },
          theme: {
            primaryColor: "#1f5b51",
            accentColor: "#2b987a",
            backgroundColor: "#f7f1e7",
            surfaceColor: "#fffaf2",
            textColor: "#2f3133",
            headingFont: "STKaiti",
            bodyFont: "Inter",
            navBackground: "#0a1728"
          },
          scene: {
            heading: "山道暮色 · 枯松岭",
            introNarration: "暮色低垂，枯松岭上寒风凛冽。毒雾从谷底翻涌而上，令人心神俱颤。",
            emptyTitle: "山道毒雾初起",
            emptyHint: '点击"继续"让角色轮流推动剧情，也可以点选头像或输入 @角色 指定发言。'
          },
          labels: {
            hp: "气血",
            mp: "内力",
            characters: "登场角色",
            lastSpeaker: "上轮发言",
            continue: "继续",
            autoPlay: "自动继续",
            send: "发送",
            manageCharacters: "角色管理",
            rules: "故事规则",
            scenarioRules: "剧情规则",
            promptRules: "提示词规则",
            currentStatus: "当前状态",
            round: "回合",
            currentStage: "当前阶段",
            statusActive: "进行中",
            statusCompleted: "已结束",
            interactiveStory: "互动故事",
            storyManagement: "故事管理",
            viewRules: "查看规则"
          },
          avatar: {
            style: "gradient" as const
          }
        },
        createdAt: now,
        updatedAt: now
      }
    ];
  }

  list() {
    return this.storyPackages;
  }

  get(id: string) {
    const storyPackage = this.storyPackages.find((item) => item.id === id);
    if (!storyPackage) throw new Error(`Story package not found: ${id}`);
    return storyPackage;
  }

  create(title: string, sourcePackageId?: string) {
    const source = this.get(sourcePackageId ?? this.storyPackages[0].id);
    const now = new Date().toISOString();
    const storyPackage: StoryPackage = {
      ...structuredClone(source),
      id: `story_${nanoid(10)}`,
      title,
      description: "新建故事包",
      storySettingPrompt: source.storySettingPrompt,
      scenario: {
        ...structuredClone(source.scenario),
        id: `scenario_${nanoid(8)}`,
        title
      },
      createdAt: now,
      updatedAt: now
    };
    this.storyPackages.unshift(storyPackage);
    return storyPackage;
  }

  upsert(storyPackage: StoryPackage) {
    const next = { ...storyPackage, updatedAt: new Date().toISOString() };
    const index = this.storyPackages.findIndex((item) => item.id === next.id);
    if (index >= 0) {
      this.storyPackages[index] = next;
    } else {
      this.storyPackages.unshift(next);
    }
    return next;
  }

  delete(id: string) {
    if (this.storyPackages.length <= 1) throw new Error("At least one story package is required");
    const index = this.storyPackages.findIndex((item) => item.id === id);
    if (index < 0) throw new Error(`Story package not found: ${id}`);
    const [removed] = this.storyPackages.splice(index, 1);
    return removed;
  }
}
