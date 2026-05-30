import type { FlowNodeData } from "../../../lib/flowTypes.js";

export interface FormProps {
  draft: FlowNodeData;
  setDraft: (data: FlowNodeData) => void;
  modules: { id: string; title: string; type?: string }[];
  groupNodes: { id: string; type: string; label: string }[];
  charOptions: { id: string; label: string }[];
  skillOptions: { id: string; label: string }[];
  stageOptions: { id: string; label: string }[];
  moduleOptions: { id: string; label: string }[];
}
