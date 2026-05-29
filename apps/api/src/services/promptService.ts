import type { CharacterId, FlowDefinition, GameState, Message, StoryModule, StoryPackage, StoryPromptRule } from "@story-game/shared";
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

    // --- Skills (stable within a session) ---
    const allSkills = this.skills.list();
    const speakerSkills = allSkills.filter((s) => s.ownerId === speakerId);
    const skillsToShow = speakerSkills.length > 0 ? speakerSkills : allSkills;
    const skillListText = skillsToShow.length > 0
      ? `当前角色可用技能：\n${skillsToShow.map((s) => `- ${s.id} (内力:${s.cost.mp}${s.damage ? `, 伤害:${s.damage.min}~${s.damage.max}` : ""})${s.effect ? `: ${s.effect}` : ""}`).join("\n")}`
      : "";

    const attackableIds = speaker.attackableTargetIds ?? [];
    const attackableNames = attackableIds
      .map((tid) => roster.find((c) => c.id === tid)?.name)
      .filter((n): n is string => !!n);
    const attackTargetsText = attackableNames.length > 0
      ? `可攻击目标：${attackableNames.join("、")}。`
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
      "输出严格 JSON（不要 Markdown 代码块）：{\"speakerId\":\"角色ID\",\"narration\":\"场景叙述(非空)\",\"dialogue\":\"角色对话(非空)\",\"action\":{\"type\":\"skill|observe|command|defend|escape\",\"skillId?\":\"技能ID\",\"targetIds\":[\"目标ID\"]},\"stateDeltaSuggestion\":{\"角色ID_hp\":-数值,\"角色ID_mp\":-数值},\"stageSuggestion?\":\"阶段ID\"}",
      "若叙事中宣告攻击伤害，stateDeltaSuggestion 必须包含目标 HP 减少条目。使用知识库招式时用 **粗体** 标出。",
      skillListText,
      attackTargetsText,
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

    return [
      `当前状态：${compactState}`,
      `最近对话：\n${recentHistory}`,
      queryKnowledge,
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

  // ===== Flow-Aware Stage Guidance (v2) =====

  private buildStageGuide(state: GameState, storyPackage?: StoryPackage): string {
    const currentDetail = state.scenario.stageDetails.find((s) => s.id === state.scenario.currentStage);

    if (storyPackage?.flow && storyPackage?.modules) {
      const guide = this.buildFlowGuide(state, storyPackage.flow, storyPackage.modules, currentDetail);
      if (guide) return guide;
    }

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

  private buildFlowGuide(
    state: GameState,
    flow: FlowDefinition,
    modules: StoryModule[],
    currentDetail: GameState["scenario"]["stageDetails"][number] | undefined
  ): string | null {
    const currentModule = modules.find((m) => m.sourceStage === state.scenario.currentStage);
    const moduleId = currentModule?.id;
    if (!moduleId) return null;

    const moduleMap = new Map(modules.map((m) => [m.id, m]));
    const phaseInfo = this.determinePhase(moduleId, flow);

    if (!phaseInfo) return null;

    const branchGuide = this.buildBranchGuide(currentDetail);
    const lines: string[] = [
      `当前剧情阶段：${state.scenario.currentStage}${currentModule ? `（${currentModule.title}）` : ""}`,
      `当前剧情目标：${state.scenario.currentGoal}`,
    ];

    switch (phaseInfo.phase) {
      case "linear":
        lines.push(...this.buildLinearGuide(phaseInfo, moduleMap, currentModule!));
        break;
      case "serving":
        lines.push(...this.buildServingGuide(state, flow, moduleMap, currentModule!));
        break;
      case "finale":
        lines.push(...this.buildFinaleGuide(flow, moduleMap, currentModule!));
        break;
    }

    if (branchGuide) lines.push(branchGuide);

    const directiveText = currentDetail?.directive
      ? `【阶段指令·必须推动】${currentDetail.directive}\n你必须在本阶段的叙述中自然地引导到这个方向发生，可以用1-2回合铺垫过渡，不要生硬插入。`
      : "";
    if (directiveText) lines.push(directiveText);

    lines.push(
      currentDetail?.isChoicePoint
        ? "当前阶段是抉择点——不要填写 stageSuggestion，让叙述自然引出玩家选择。"
        : "如果剧情需要推进，只能在 stageSuggestion 中填入上面可用剧情阶段之一；不确定时沿用当前阶段。"
    );

    return lines.filter(Boolean).join("\n");
  }

  private determinePhase(moduleId: string, flow: FlowDefinition) {
    for (const [phaseId, phase] of Object.entries(flow.linearPhases)) {
      const idx = phase.sequence.indexOf(moduleId);
      if (idx !== -1) {
        return {
          phase: "linear" as const,
          phaseId,
          phaseTitle: phase.title,
          currentIndex: idx,
          totalInPhase: phase.sequence.length,
          sequence: phase.sequence,
          afterAll: phase.afterAll,
        };
      }
    }

    if (flow.servingLoop) {
      const serveIds = Object.values(flow.servingLoop.serveModuleByCycle);
      const punishIds = Object.values(flow.servingLoop.punishModuleByCycle);
      if (serveIds.includes(moduleId) || punishIds.includes(moduleId)) {
        return { phase: "serving" as const };
      }
    }

    if (flow.finaleSequence?.sequence.includes(moduleId)) {
      const idx = flow.finaleSequence.sequence.indexOf(moduleId);
      return {
        phase: "finale" as const,
        currentIndex: idx,
        total: flow.finaleSequence.sequence.length,
        sequence: flow.finaleSequence.sequence,
      };
    }

    return null;
  }

  private buildLinearGuide(
    phaseInfo: ReturnType<typeof this.determinePhase> & { phase: "linear" },
    moduleMap: Map<string, StoryModule>,
    currentModule: StoryModule
  ): string[] {
    const lines: string[] = [
      `【${phaseInfo.phaseTitle}】第 ${phaseInfo.currentIndex + 1}/${phaseInfo.totalInPhase} 阶段`,
      "",
      `▸ 当前模块：${currentModule.title}`,
      currentModule.description ? `  含义：${currentModule.description}` : "",
      currentModule.guidance ? `  引导：${currentModule.guidance}` : "",
      currentModule.enterWhen ? `  进入条件：${currentModule.enterWhen}` : "",
      currentModule.exitCondition ? `  退出条件：${currentModule.exitCondition}` : "",
    ];

    // Show upcoming module (next 1 only, title only to avoid spoiling)
    const upcoming = phaseInfo.sequence.slice(phaseInfo.currentIndex + 1, phaseInfo.currentIndex + 2);
    if (upcoming.length > 0) {
      const upcomingText = upcoming.map((mid) => {
        const m = moduleMap.get(mid);
        return m ? `  → 下一阶段：${m.title}` : `  → ${mid}`;
      }).join("\n");
      lines.push("", upcomingText);
    }

    // Show afterAll hint
    if (phaseInfo.afterAll && phaseInfo.currentIndex === phaseInfo.totalInPhase - 1) {
      lines.push("", `⚠️ 本幕完成后的下一阶段：${phaseInfo.afterAll}`);
    }

    // Also include current module's consumesSkills if present
    if (currentModule.consumesSkills?.length) {
      lines.push("", `本模块相关技能：${currentModule.consumesSkills.join("、")}`);
    }

    return lines;
  }

  private buildServingGuide(
    state: GameState,
    flow: FlowDefinition,
    moduleMap: Map<string, StoryModule>,
    currentModule: StoryModule
  ): string[] {
    const loop = flow.servingLoop!;
    const cycle = state.currentCycle ?? 1;

    const lines: string[] = [
      `【${loop.title}】第 ${cycle} 次侍寝`,
      "",
      `▸ 当前模块：${currentModule.title}`,
      currentModule.description ? `  含义：${currentModule.description}` : "",
      currentModule.guidance ? `  引导：${currentModule.guidance}` : "",
      currentModule.enterWhen ? `  进入条件：${currentModule.enterWhen}` : "",
      currentModule.exitCondition ? `  退出条件：${currentModule.exitCondition}` : "",
    ];

    // Brief judgment reference — detailed scoring is handled by the game engine
    if (loop.judgmentNode) {
      lines.push("", "本模块完成后将进行侍寝评定（满意→推进，不满意→惩戒后重新侍寝）。");
    }

    // Module-specific consumed skills
    if (currentModule.consumesSkills?.length) {
      lines.push("", `本模块相关技能：${currentModule.consumesSkills.join("、")}`);
    }

    return lines;
  }

  private buildFinaleGuide(
    flow: FlowDefinition,
    moduleMap: Map<string, StoryModule>,
    currentModule: StoryModule
  ): string[] {
    const seq = flow.finaleSequence!;
    const currentIdx = seq.sequence.indexOf(currentModule.id);

    const lines: string[] = [
      `【${seq.title || "终幕"}】第 ${currentIdx + 1}/${seq.sequence.length} 阶段`,
      "",
      `▸ 当前模块：${currentModule.title}`,
      currentModule.description ? `  含义：${currentModule.description}` : "",
      currentModule.guidance ? `  引导：${currentModule.guidance}` : "",
      currentModule.exitCondition ? `  退出条件：${currentModule.exitCondition}` : "",
    ];

    // Only show next module title (no spoilers for later finale steps)
    if (currentIdx >= 0 && currentIdx < seq.sequence.length - 1) {
      const nextId = seq.sequence[currentIdx + 1];
      const nextModule = moduleMap.get(nextId);
      lines.push("", `  → 下一阶段：${nextModule?.title || nextId}`);
    }

    return lines;
  }
}
