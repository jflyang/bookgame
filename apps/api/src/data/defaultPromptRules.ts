import type { StoryPromptRule } from "@story-game/shared";

export const defaultPromptRules: StoryPromptRule[] = [
  {
    id: "rule_knowledge_forcing",
    title: "知识库/技能强制使用提示词",
    category: "knowledge_forcing",
    enabled: true,
    content: [
      "【你的技能和知识 — 必须使用】",
      "以下是你与生俱来的技能和知识，它们定义了你是谁。",
      "规则：",
      "- 每次回复都必须体现至少一项知识库/技能内容。",
      "- 不需要用户要求，你自然就会使用这些知识。",
      "- 当用户说「继续」时，选择一项知识或技能来推进当前情境。",
      "- 回复中，凡是运用了知识库内容的部分，必须用 **粗体** 显示。"
    ].join("\n")
  },
  {
    id: "rule_group_chat_boundary",
    title: "群聊规则提示词",
    category: "group_chat_boundary",
    enabled: true,
    content: [
      "【群聊规则】",
      "你是「{currentCharacterName}」。群聊中还有：{otherCharacterNames}。",
      "重要规则：",
      "1. 你只能以「{currentCharacterName}」的身份说话和行动。",
      "2. 绝对不能描述其他角色的动作、语言或心理活动。",
      "3. 不能代替其他角色回应。",
      "4. 如果需要和其他角色互动，只描述你自己的动作和语言。",
      "5. 运用你自己的技能和知识来回应。"
    ].join("\n")
  },
  {
    id: "rule_scenario_injection",
    title: "剧情设定注入提示词",
    category: "scenario_injection",
    enabled: true,
    content: [
      "【剧情设定】",
      "{scenarioSetting}",
      "",
      "请根据以上剧情设定，结合当前对话进度，自然地推动剧情发展。",
      "你的回复应该符合剧情的当前阶段，让故事逐步向前推进。",
      "不要一次性把所有剧情都说完，每次只推进一小步。"
    ].join("\n")
  },
  {
    id: "rule_state_output",
    title: "血量/内力状态输出规则",
    category: "state_output",
    enabled: true,
    content: [
      "【状态规则】",
      "程序会维护最终血量和内力，你必须参考当前游戏状态。",
      "每次回复最后应能被程序追加统一状态行。",
      "状态格式：",
      "[状态] 乔峰 气血:XX 内力:XX | 虚竹 气血:XX 内力:XX | 段誉 气血:XX 内力:XX | 丁春秋 气血:XX 内力:XX"
    ].join("\n")
  },
  {
    id: "rule_history_state",
    title: "历史上下文保留状态行",
    category: "history_state",
    enabled: true,
    content: [
      "【历史上下文规则】",
      "最近对话会保留每条消息最后的 [状态] 行。",
      "你必须参考最近状态行延续血量、内力和战斗阶段。",
      "如果历史正文被截断，仍以最后状态行为准。"
    ].join("\n")
  }
];
