import { createContext, useContext } from "react";
import type { UiConfig } from "@story-game/shared";

const DEFAULT_LABELS = {
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
  viewRules: "查看规则",
} as const;

export type LabelKey = keyof typeof DEFAULT_LABELS;

const UiConfigContext = createContext<UiConfig>({} as UiConfig);

export function useLabels(): Record<LabelKey, string> {
  const config = useContext(UiConfigContext);
  const labels = config.labels ?? {};
  const result = {} as Record<LabelKey, string>;
  for (const key of Object.keys(DEFAULT_LABELS) as LabelKey[]) {
    result[key] = (labels as Record<string, string>)[key] ?? DEFAULT_LABELS[key];
  }
  return result;
}

export function useUiConfig(): UiConfig {
  return useContext(UiConfigContext);
}

export default UiConfigContext;
