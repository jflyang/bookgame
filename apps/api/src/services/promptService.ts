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

  /**
   * Build the stable system prompt (persona, rules, skills, stage structure).
   * This part rarely changes within a session, enabling DeepSeek prefix caching.
   */
  buildSystemPrompt(speakerId: CharacterId, state: GameState, storyPackage?: StoryPackage): string {
    const { character: speaker, knowledgeHits } = this.agents.buildAgentContext(speakerId, "");
    const roster = this.characters.list();
    const otherCharacterNames = roster.filter((item) => item.id !== speakerId).map((item) => item.name).join("、");
    const enabledRules = storyPackage?.promptRules.filter((rule) => rule.enabled) ?? [];
    const introNarration = storyPackage?.uiConfig?.scene?.introNarration;
    const stageGuide = this.buildStageGuide(state, storyPackage);

    // --- Actions & Reactions (v2 — narrative-driven) ---
    const allActions = this.skills.listActions();
    const allReactions = this.skills.listReactions();

    // Build action list grouped by character
    const actionByOwner = new Map<string, typeof allActions>();
    for (const a of allActions) {
      const list = actionByOwner.get(a.ownerId) || [];
      list.push(a);
      actionByOwner.set(a.ownerId, list);
    }
    const actionLines: string[] = [];
    for (const [ownerId, actions] of actionByOwner) {
      const owner = roster.find((c) => c.id === ownerId);
      const ownerName = owner?.name || ownerId;
      actionLines.push(`${ownerName} 可执行：`);
      for (const a of actions) {
        actionLines.push(`  - ${a.name}：${a.description}`);
      }
    }
    const actionListText = actionLines.length > 0
      ? `【角色可用行动】\n${actionLines.join("\n")}`
      : "";

    // Build reaction list grouped by character
    const reactionByOwner = new Map<string, typeof allReactions>();
    for (const r of allReactions) {
      const list = reactionByOwner.get(r.ownerId) || [];
      list.push(r);
      reactionByOwner.set(r.ownerId, list);
    }
    const reactionLines: string[] = [];
    for (const [ownerId, reactions] of reactionByOwner) {
      const owner = roster.find((c) => c.id === ownerId);
      const ownerName = owner?.name || ownerId;
      reactionLines.push(`${ownerName} 被动：`);
      for (const r of reactions) {
        reactionLines.push(`  被${r.trigger}时 → ${r.description}`);
      }
    }
    const reactionListText = reactionLines.length > 0
      ? `【被动反应】\n${reactionLines.join("\n")}`
      : "";

    // Knowledge hits for system prompt (stable context from persona)
    const compactKnowledge = knowledgeHits.length > 0
      ? knowledgeHits.map((hit: { title?: string; content: string }) => {
          const title = hit.title ? `【${hit.title}】` : "";
          return `${title}${hit.content}`;
        }).join("\n")
      : "";

    // Stage context (stable within same stage)
    const currentStageDetail = state.scenario.stageDetails.find((s) => s.id === state.scenario.currentStage);
    const stageContext = currentStageDetail
      ? `当前阶段「${currentStageDetail.title || state.scenario.currentStage}」：${currentStageDetail.description}${currentStageDetail.guidance ? `\n推进建议：${currentStageDetail.guidance}` : ""}`
      : `当前阶段：${state.scenario.currentStage}`;

    return [
      "你正在驱动一个多人角色互动故事游戏。每次只有一个角色发言。",
      "当前发言者只能扮演自己，不能替其他角色说话、行动或描写心理。",
      "输出严格 JSON（不要 Markdown 代码块）：{\"speakerId\":\"角色ID\",\"narration\":\"场景叙述(非空)\",\"dialogue\":\"角色对话(非空)\",\"action\":{\"type\":\"observe|command|defend|escape\",\"targetIds\":[\"目标ID\"]},\"stateDeltaSuggestion\":{},\"stageSuggestion?\":\"阶段ID\"}",
      "在 narration 中融入角色的主动行动和被动反应。使用行动名称时用 **粗体** 标出。",
      actionListText,
      reactionListText,
      ...this.renderRules(enabledRules, {
        currentCharacterName: speaker.name,
        otherCharacterNames,
        scenarioSetting: stageContext,
        retrievedKnowledge: compactKnowledge,
        currentGameState: "", // placeholder — dynamic state goes in user prompt
        recentHistory: ""    // placeholder — dynamic history goes in user prompt
      }),
      `群聊成员：${roster.map((item) => `${item.name}(${item.id},${item.role})`).join("、")}`,
      `当前角色：${speaker.name}(${speakerId})`,
      `人设：${speaker.personaPrompt}`,
      compactKnowledge ? `知识库：\n${compactKnowledge}` : "",
      ...(introNarration && state.round <= 1 ? [`开场旁白：${introNarration}`] : []),
      `剧情阶段信息：\n${stageGuide}`,
    ].filter(Boolean).join("\n\n");
  }

  /**
   * Build the dynamic user prompt (current state, recent history, user input).
   * This changes every turn.
   */
  buildUserPrompt(speakerId: CharacterId, state: GameState, history: Message[], query: string): string {
    const roster = this.characters.list();

    // --- Compact state (changes every turn) ---
    const compactState = state.characters.map((c) => {
      const name = roster.find((r) => r.id === c.characterId)?.name ?? c.characterId;
      return `${name}(${c.characterId}): HP${c.hp} MP${c.mp}${c.isDefeated ? " [败]" : ""}`;
    }).join("、");

    // --- Recent history (last 5 messages, max 300 chars each to conserve tokens) ---
    const recentHistory = history.slice(-5).map((m) => {
      const name = m.speakerId ? (roster.find((r) => r.id === m.speakerId)?.name ?? m.speakerId) : "玩家";
      const text = m.content.length > 300 ? m.content.slice(0, 300) + "…" : m.content;
      return `[${name}] ${text}`;
    }).join("\n");

    // --- Knowledge hits specific to this query ---
    const { knowledgeHits } = this.agents.buildAgentContext(speakerId, query);
    const queryKnowledge = knowledgeHits.length > 0
      ? `相关知识：\n${knowledgeHits.map((hit: { title?: string; content: string }) => {
          const title = hit.title ? `【${hit.title}】` : "";
          return `${title}${hit.content}`;
        }).join("\n")}`
      : "";

    // --- Stage progression nudge when stuck too long ---
    const roundsInStage = state.round - (state.stageEnteredAtRound ?? 0);
    const stageNudge = roundsInStage >= 8
      ? `⚠️ 当前阶段已持续 ${roundsInStage} 回合。如果阶段推进条件已满足，请在 stageSuggestion 中填入下一阶段 ID 推动剧情发展。`
      : "";

    return [
      `当前状态：${compactState}`,
      `最近对话：\n${recentHistory}`,
      queryKnowledge,
      stageNudge,
      `玩家输入：${query}`
    ].filter(Boolean).join("\n\n");
  }

  /**
   * Legacy single-string prompt (for backward compatibility).
   * Combines system + user prompt into one string.
   */
  buildPrompt(speakerId: CharacterId, state: GameState, history: Message[], query: string, storyPackage?: StoryPackage) {
    const systemPrompt = this.buildSystemPrompt(speakerId, state, storyPackage);
    const userPrompt = this.buildUserPrompt(speakerId, state, history, query);
    return `${systemPrompt}\n\n${userPrompt}`;
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

  // ===== Stage Guidance (scenario-driven only) =====
  // Note: Flow/modules are purely an editor visualization tool.
  // The runtime reads ONLY scenario.stageDetails for building the AI prompt.

  private buildStageGuide(state: GameState, _storyPackage?: StoryPackage): string {
    const currentDetail = state.scenario.stageDetails.find((s) => s.id === state.scenario.currentStage);
    return this.buildLegacyStageGuide(state, currentDetail);
  }

  private buildLegacyStageGuide(state: GameState, currentDetail: GameState["scenario"]["stageDetails"][number] | undefined): string {
    const currentIdx = state.scenario.stages.indexOf(state.scenario.currentStage);

    // Only show current stage + next stage to prevent future plot leaking
    const visibleStages = state.scenario.stages.filter((_stageId, index) => {
      return index <= currentIdx + 1;
    });

    const stageDetails = visibleStages.map((stageId, index) => {
      const detail = state.scenario.stageDetails.find((s) => s.id === stageId);
      const isCurrent = stageId === state.scenario.currentStage;
      const prefix = isCurrent ? "▸" : `${index + 1}.`;
      return [
        `${prefix} ${stageId}${detail?.title ? `（${detail.title}）` : ""}`,
        detail?.description ? `   含义：${detail.description}` : "",
        // Only show enterWhen and guidance for current and next stage
        detail?.enterWhen ? `   进入条件：${detail.enterWhen}` : "",
        isCurrent && detail?.guidance ? `   推进建议：${detail.guidance}` : ""
      ].filter(Boolean).join("\n");
    }).join("\n");

    const branchGuide = this.buildBranchGuide(currentDetail);
    const directiveText = currentDetail?.directive
      ? `【阶段指令·必须推动】${currentDetail.directive}\n你必须在本阶段的叙述中自然地引导到这个方向发生，可以用1-2回合铺垫过渡，不要生硬插入。`
      : "";

    return [
      `当前剧情阶段：${state.scenario.currentStage}`,
      `可用剧情阶段：${visibleStages.join(" -> ")}${currentIdx < state.scenario.stages.length - 1 ? " -> ..." : ""}`,
      `阶段卡片说明：\n${stageDetails || "未配置阶段说明，只能参考阶段 ID。"}`,
      branchGuide,
      directiveText,
      `当前剧情目标：${state.scenario.currentGoal}`,
      currentDetail?.isChoicePoint
        ? "当前阶段是抉择点——不要填写 stageSuggestion，让叙述自然引出玩家选择。"
        : "如果剧情需要推进，只能在 stageSuggestion 中填入上面可用剧情阶段之一；不确定时沿用当前阶段。"
    ].filter(Boolean).join("\n");
  }

  private buildBranchGuide(currentDetail: GameState["scenario"]["stageDetails"][number] | undefined): string {
    if (!currentDetail?.isChoicePoint || !currentDetail.branches?.length) return "";

    const branchLines = currentDetail.branches.map((b, i) =>
      `  选项${i + 1}：${b.choiceText || b.condition || ""} → 进入 ${b.targetStage}${b.description ? `（${b.description}）` : ""}`
    ).join("\n");
    return [
      `⚠️ 当前阶段是抉择点。你必须在此轮回复中把剧情推进到需要玩家做出选择的时刻——自然地在对话或叙述中铺垫出${currentDetail.branches.length}条可能的方向。`,
      `抉择分支：\n${branchLines}`,
      `关键：本轮不要填写 stageSuggestion。等待玩家做出选择后系统会自动推进。`
    ].join("\n");
  }

}
