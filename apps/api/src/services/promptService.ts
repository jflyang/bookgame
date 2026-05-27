import type { CharacterId, GameState, Message, StoryPackage, StoryPromptRule } from "@story-game/shared";
import { CharacterService } from "./characterService.js";
import { AgentService } from "./agentService.js";
import type { SkillIndex } from "./skillIndex.js";

export class PromptService {
  constructor(
    private readonly characters: CharacterService,
    private readonly agents: AgentService,
    private readonly skills: SkillIndex
  ) {}

  buildPrompt(speakerId: CharacterId, state: GameState, history: Message[], query: string, storyPackage?: StoryPackage) {
    const { character: speaker, knowledgeHits } = this.agents.buildAgentContext(speakerId, query);
    const roster = this.characters.list();
    const otherCharacterNames = roster.filter((item) => item.id !== speakerId).map((item) => item.name).join("、");
    const enabledRules = storyPackage?.promptRules.filter((rule) => rule.enabled) ?? [];
    const scenarioSetting = storyPackage?.storySettingPrompt || JSON.stringify(state.scenario);
    const introNarration = storyPackage?.uiConfig?.scene?.introNarration;
    const stageDetails = state.scenario.stages.map((stageId, index) => {
      const detail = state.scenario.stageDetails.find((stage) => stage.id === stageId);
      return [
        `${index + 1}. ${stageId}${detail?.title ? `（${detail.title}）` : ""}`,
        detail?.description ? `   含义：${detail.description}` : "",
        detail?.enterWhen ? `   进入条件：${detail.enterWhen}` : "",
        detail?.guidance ? `   推进建议：${detail.guidance}` : ""
      ].filter(Boolean).join("\n");
    }).join("\n");
    const stageGuide = [
      `当前剧情阶段：${state.scenario.currentStage}`,
      `可用剧情阶段：${state.scenario.stages.join(" -> ")}`,
      `阶段卡片说明：\n${stageDetails || "未配置阶段说明，只能参考阶段 ID。"}`,
      `当前剧情目标：${state.scenario.currentGoal}`,
      "如果剧情需要推进，只能在 stageSuggestion 中填入上面可用剧情阶段之一；不确定时沿用当前阶段。"
    ].join("\n");

    const availableSkills = this.skills.list();
    const skillListText = availableSkills.length > 0
      ? `可用技能列表（使用 type=skill 时 skillId 必须填以下技能名）：\n${availableSkills.map((s) => `- ${s.id} (内力:${s.cost.mp}${s.damage ? `, 伤害:${s.damage.min}~${s.damage.max}` : ""})${s.effect ? `: ${s.effect}` : ""}`).join("\n")}`
      : "";

    const attackableIds = speaker.attackableTargetIds ?? [];
    const attackableNames = attackableIds
      .map((tid) => roster.find((c) => c.id === tid)?.name)
      .filter((n): n is string => !!n);
    const attackTargetsText = attackableNames.length > 0
      ? `当前角色可攻击的目标：${attackableNames.join("、")}。使用 type=skill 时 targetIds 必须从这些目标中选择。`
      : "";

    return [
      "你正在驱动一个多人角色互动故事游戏。每次只有一个角色发言。",
      "当前发言者只能扮演自己，不能替其他角色说话、行动或描写心理。",
      "输出必须是严格 JSON，不要包 Markdown 代码块。字段说明：",
      "  speakerId: 当前发言角色 ID",
      "  narration: 场景叙述（纯文本，必须非空）",
      "  dialogue: 角色对话（纯文本，必须非空）",
      "  action: { type: \"skill\"|\"observe\"|\"command\"|\"defend\"|\"escape\", skillId?: 使用的技能名称(可选), targetIds: 目标角色ID数组 }",
      "  stateDeltaSuggestion: { 角色ID_hp: 整数变化值, 角色ID_mp: 整数变化值 } 实际的状态变更(例如 {\"dingchunqiu_hp\": -35, \"xuzhu_mp\": -20})。若你在叙事/对话中宣告了攻击和伤害，此处必须包含目标HP减少条目，不能为空。",
      "  stageSuggestion: 可选，建议推进到的阶段ID",
      "当你使用当前角色知识库中的招式、设定、称号、道具或关键知识时，必须把对应的关键词或短句用 **粗体** 标出；未使用知识库内容时不要强行加粗。",
      "如果知识库技能卡写有「表演」或「触发词」，你可以根据剧情自然决定是否发动；发动时必须加粗该招式名或触发词。",
      skillListText,
      attackTargetsText,
      ...this.renderRules(enabledRules, {
        currentCharacterName: speaker.name,
        otherCharacterNames,
        scenarioSetting,
        retrievedKnowledge: JSON.stringify(knowledgeHits),
        currentGameState: JSON.stringify(state.characters),
        recentHistory: JSON.stringify(history)
      }),
      `群聊成员：${roster.map((item) => `${item.name}(${item.role})`).join("、")}`,
      `当前角色：${speaker.name}`,
      `角色主提示词：${speaker.personaPrompt}`,
      `检索到的角色知识库片段：${JSON.stringify(knowledgeHits)}`,
      `故事包主设定提示词：${scenarioSetting}`,
      ...(introNarration ? [`开场旁白（场景叙述，供你参考剧情起点）：${introNarration}`] : []),
      `剧情阶段信息：\n${stageGuide}`,
      `游戏状态：${JSON.stringify(state.characters)}`,
      `最近历史：${JSON.stringify(history)}`
    ].join("\n\n");
  }

  private renderRules(rules: StoryPromptRule[], variables: Record<string, string>) {
    return rules.map((rule) => {
      const content = Object.entries(variables).reduce(
        (text, [key, value]) => text.replaceAll(`{${key}}`, value),
        rule.content
      );
      return `【故事包规则：${rule.title}】\n${content}`;
    });
  }
}
