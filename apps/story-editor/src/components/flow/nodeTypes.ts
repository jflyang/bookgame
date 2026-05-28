import { ModuleNode } from "./nodes/ModuleNode.js";
import { ChoiceNode } from "./nodes/ChoiceNode.js";
import { JudgmentNode } from "./nodes/JudgmentNode.js";
import { EventTriggerNode } from "./nodes/EventTriggerNode.js";
import { RandomEventNode } from "./nodes/RandomEventNode.js";
import { RandomJudgmentNode } from "./nodes/RandomJudgmentNode.js";
import { LoopNode } from "./nodes/LoopNode.js";
import { PhaseGroupNode } from "./nodes/PhaseGroupNode.js";
import { DailyTriggerNode } from "./nodes/DailyTriggerNode.js";
import { StartNode } from "./nodes/StartNode.js";
import { EndNode } from "./nodes/EndNode.js";

export const nodeTypes = {
  module: ModuleNode,
  choice: ChoiceNode,
  judgment: JudgmentNode,
  eventTrigger: EventTriggerNode,
  randomEvent: RandomEventNode,
  randomJudgment: RandomJudgmentNode,
  loop: LoopNode,
  phaseGroup: PhaseGroupNode,
  dailyTrigger: DailyTriggerNode,
  start: StartNode,
  end: EndNode,
};
