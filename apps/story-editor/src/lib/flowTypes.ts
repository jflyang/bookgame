import type { StoryModule, FlowServingLoop } from "@story-game/shared";

// React Flow node/edge types that wrap our domain data

export interface FlowNodeData {
  [key: string]: unknown;
  label: string;
  moduleRef?: string;
  moduleData?: StoryModule;
  colorKey?: string;
  judgmentData?: Record<string, unknown>;
  loopData?: FlowServingLoop;
  actKey?: string;
  triggerRule?: string;
  eventDescription?: string;
  randomPool?: { id: string; title: string }[];
  branches?: { targetStage: string; choiceText?: string; condition?: string; description?: string }[];
}

export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: FlowNodeData;
  parentId?: string;
  extent?: "parent";
  style?: React.CSSProperties;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  data?: { routeKey?: string; condition?: string };
  style?: React.CSSProperties;
}

export interface FlowEditorState {
  modules: StoryModule[];
  acts: Record<string, string[]>;       // actKey → moduleId[]
  actAfterAll?: Record<string, string | null>;  // actKey → target actKey (for inter-act edges)
  servingLoop: FlowServingLoop | null;
  finaleSequence: string[];
  dailyTriggers: { module: string; trigger: string }[];
  _loopChoiceNodes?: string[];            // internal: choice nodes for finale connection
}
