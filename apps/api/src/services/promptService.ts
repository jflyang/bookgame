import type { CharacterId, GameState, Message, StoryPackage, StoryPromptRule } from "@story-game/shared";
import { CharacterService } from "./characterService.js";
import { AgentService } from "./agentService.js";

export class PromptService {
  constructor(
    private readonly characters: CharacterService,
    private readonly agents: AgentService
  ) {}

  buildPrompt(speakerId: CharacterId, state: GameState, history: Message[], query: string, storyPackage?: StoryPackage) {
    const { character: speaker, knowledgeHits } = this.agents.buildAgentContext(speakerId, query);
    const roster = this.characters.list();
    const otherCharacterNames = roster.filter((item) => item.id !== speakerId).map((item) => item.name).join("、");
    const enabledRules = storyPackage?.promptRules.filter((rule) => rule.enabled) ?? [];
    const scenarioSetting = storyPackage?.storySettingPrompt || JSON.stringify(state.scenario);

    return [
      "你正在驱动一个多人角色互动故事游戏。每次只有一个角色发言。",
      "当前发言者只能扮演自己，不能替其他角色说话、行动或描写心理。",
      "输出必须是符合约定 schema 的 JSON：speakerId,narration,dialogue,action,stateDeltaSuggestion,stageSuggestion。",
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
