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

  buildPrompt(speakerId: CharacterId, state: GameState, history: Message[], query: string, storyPackage?: StoryPackage) {
    const { character: speaker, knowledgeHits } = this.agents.buildAgentContext(speakerId, query);
    const roster = this.characters.list();
    const otherCharacterNames = roster.filter((item) => item.id !== speakerId).map((item) => item.name).join("、");
    const enabledRules = storyPackage?.promptRules.filter((rule) => rule.enabled) ?? [];
    const scenarioSetting = storyPackage?.storySettingPrompt || JSON.stringify(state.scenario);
    const introNarration = storyPackage?.uiConfig?.scene?.introNarration;
    const stageGuide = this.buildStageGuide(state, storyPackage);

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
      "  action: { type: \"skill\"|\"observe\"|\"command\"|\"defend\"|\"escape\", skillId?: 必须从上面「可用技能列表」中选一个技能ID(如skill_resist), targetIds: 目标角色ID数组 }。注意：skillId 填的是技能ID(英文)，不是技能中文名。不确定时用 type=\"observe\" 或不填 skillId。",
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
    const stageDetails = state.scenario.stages.map((stageId, index) => {
      const detail = state.scenario.stageDetails.find((s) => s.id === stageId);
      return [
        `${index + 1}. ${stageId}${detail?.title ? `（${detail.title}）` : ""}`,
        detail?.description ? `   含义：${detail.description}` : "",
        detail?.enterWhen ? `   进入条件：${detail.enterWhen}` : "",
        detail?.guidance ? `   推进建议：${detail.guidance}` : ""
      ].filter(Boolean).join("\n");
    }).join("\n");

    const branchGuide = this.buildBranchGuide(currentDetail);

    return [
      `当前剧情阶段：${state.scenario.currentStage}`,
      `可用剧情阶段：${state.scenario.stages.join(" -> ")}`,
      `阶段卡片说明：\n${stageDetails || "未配置阶段说明，只能参考阶段 ID。"}`,
      branchGuide,
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

    // Show upcoming modules (next 2)
    const upcoming = phaseInfo.sequence.slice(phaseInfo.currentIndex + 1, phaseInfo.currentIndex + 3);
    if (upcoming.length > 0) {
      const upcomingText = upcoming.map((mid) => {
        const m = moduleMap.get(mid);
        return m ? `  → ${m.title}：${m.description || ""}` : `  → ${mid}`;
      }).join("\n");
      lines.push("", "【即将到来的阶段】", upcomingText);
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
    const cycleKey = String(cycle);
    const serveModuleId = loop.serveModuleByCycle[cycleKey] ?? loop.serveModuleByCycle["default"];
    const punishModuleId = loop.punishModuleByCycle[cycleKey] ?? loop.punishModuleByCycle["default"];

    const serveModule = moduleMap.get(serveModuleId);
    const punishModule = moduleMap.get(punishModuleId);

    const lines: string[] = [
      `【${loop.title}】`,
      `当前循环：第 ${cycle} 次侍寝`,
      "",
      `▸ 当前侍寝模块：${currentModule.title}`,
      currentModule.description ? `  含义：${currentModule.description}` : "",
      currentModule.guidance ? `  引导：${currentModule.guidance}` : "",
      currentModule.enterWhen ? `  进入条件：${currentModule.enterWhen}` : "",
      currentModule.exitCondition ? `  退出条件：${currentModule.exitCondition}` : "",
    ];

    // Judgment criteria
    if (loop.judgmentNode) {
      const judge = loop.judgmentNode;
      lines.push("", "══════════════", "【侍寝判定标准】", judge.description);

      // 3D scoring
      if (judge.scoringMethods?.score_3d) {
        const scoring = judge.scoringMethods.score_3d;
        const dims = Object.entries(scoring.dimensions as Record<string, { name: string; min: number; max: number; description: string }>).map(([, dim]) =>
          `  - ${dim.name}（${dim.min}-${dim.max}分）：${dim.description}`
        ).join("\n");

        const threshold = scoring.thresholdsByCycle[cycleKey] ?? scoring.thresholdsByCycle["default"];
        const thresholdText = threshold
          ? `总分≥${threshold.total}分 且 单项不低于${threshold.perDimension}分`
          : "帝王自行判断";

        lines.push(
          "【三维评分体系】",
          dims,
          `当前循环通过阈值：${thresholdText}`
        );
      }

      // 4-trials scoring (cycle 4 / 杆缚媚药)
      if (judge.scoringMethods?.score_4trials_random) {
        const trials = judge.scoringMethods.score_4trials_random;
        const trialText = trials.trials.map((t: { id: string; name: string; description: string }) => `  ${t.id === "oral" ? "①" : t.id === "moan" ? "②" : t.id === "kiss" ? "③" : "④"} ${t.name}：${t.description}`).join("\n");
        lines.push(
          "【四重考验体系】",
          trialText,
          `全部通过 → 继续；随机失败率 ${Math.round(trials.randomFailChance * 100)}%`,
          trials.randomFailMessage || ""
        );
      }

      // Routes
      if (judge.routes) {
        const sat = judge.routes["satisfied"];
        const unsat = judge.routes["unsatisfied"];
        const satModule = sat?.targetModule ? moduleMap.get(sat.targetModule) : null;
        lines.push(
          "",
          `✅ 满意：${sat?.condition || ""} → ${satModule?.title || sat?.target || "帝王满意阶段"}`,
          `❌ 不满意：${unsat?.condition || ""} → 进入惩戒（${punishModule?.title || "惩戒模块"}）→ 循环数+1 → 重新侍寝`
        );
      }
    }

    // Punishment info
    if (punishModule) {
      lines.push(
        "",
        `【本循环对应惩戒】${punishModule.title}`,
        punishModule.description ? `  ${punishModule.description}` : ""
      );
    }

    // Punishment menu (available alternatives)
    if (flow.punishmentMenu) {
      const menu = flow.punishmentMenu;
      const allPunishments = Object.entries(menu.allPunishmentModules)
        .map(([key, p]) => `  - ${p.title}（严重度 ${p.severity}/10）`)
        .join("\n");
      lines.push(
        "",
        `【可用惩戒菜单 — ${menu.title}】`,
        menu.description || "",
        allPunishments,
        "帝王可根据不满意的程度选择适当的惩戒方式——不限于当前循环的默认惩戒。"
      );
    }

    // Daily system context
    if (flow.dailySystem) {
      const ds = flow.dailySystem;
      const activeDailies = ds.triggerRules
        .filter((r) => {
          // Only show dailies relevant to current state (stage >= 5)
          const stageNum = parseInt(state.scenario.currentStage.replace("stage_", ""), 10);
          if (r.module === "mod_daily_wearables" && stageNum >= 5) return true;
          if (r.module === "mod_daily_morning_inspection" && stageNum >= 7) return true;
          if (r.module === "mod_daily_kneel_day" && stageNum >= 5) return true;
          if (r.module === "mod_daily_silence_day" && stageNum >= 5) return true;
          if (r.module === "mod_daily_dog_bowl" && stageNum >= 11) return true;
          if (r.module === "mod_daily_sleep_punish" && stageNum >= 7) return true;
          return false;
        })
        .map((r) => {
          const m = moduleMap.get(r.module);
          return m ? `  - ${m.title}：${r.trigger}` : `  - ${r.module}：${r.trigger}`;
        })
        .join("\n");

      if (activeDailies) {
        lines.push("", `【当前激活的日常体系 — ${ds.title}】`, activeDailies);
      }
    }

    // PunishThenReServe hint
    if (loop.punishThenReServe) {
      lines.push(
        "",
        `【侍寝失败流程】${loop.punishThenReServe.description}`,
        loop.punishThenReServe.steps.map((s) => `  → ${s.action}${s.note ? `：${s.note}` : ""}`).join("\n")
      );
    }

    return lines;
  }

  private buildFinaleGuide(
    flow: FlowDefinition,
    moduleMap: Map<string, StoryModule>,
    currentModule: StoryModule
  ): string[] {
    const seq = flow.finaleSequence!;
    const lines: string[] = [
      `【${seq.title || "终幕"}】`,
      "",
      `▸ 当前模块：${currentModule.title}`,
      currentModule.description ? `  含义：${currentModule.description}` : "",
      currentModule.guidance ? `  引导：${currentModule.guidance}` : "",
      currentModule.exitCondition ? `  退出条件：${currentModule.exitCondition}` : "",
      "",
      "【终幕序列】",
      seq.sequence.map((mid, i) => {
        const m = moduleMap.get(mid);
        const marker = mid === currentModule.id ? " ◀ 当前" : "";
        return `  ${i + 1}. ${m?.title || mid}${marker}`;
      }).join("\n"),
      seq.description || "",
    ];

    return lines;
  }
}
