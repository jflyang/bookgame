import { useState, useEffect } from "react";
import type { FlowNodeData } from "../../../lib/flowTypes.js";
import { useEditorStore } from "../../../store/editorStore.js";
import type { FormProps } from "./types.js";
import { ModuleForm } from "./forms/ModuleForm.js";
import { ChoiceForm } from "./forms/ChoiceForm.js";
import { JudgmentForm } from "./forms/JudgmentForm.js";
import { EventTriggerForm, RandomEventForm, RandomJudgmentForm, LoopForm, DailyTriggerForm, StartEndForm } from "./forms/SimpleNodeForms.js";

interface Props {
  nodeId: string;
  nodeType: string;
  data: FlowNodeData;
  modules: { id: string; title: string; type?: string }[];
  groupNodes: { id: string; type: string; label: string }[];
  onSave: (data: FlowNodeData) => void;
  onClose: () => void;
}

const typeLabel: Record<string, string> = {
  module: "故事模块", choice: "多分支抉择", judgment: "判断节点",
  eventTrigger: "事件触发", randomEvent: "随机事件", randomJudgment: "随机判断",
  loop: "循环入口", dailyTrigger: "日常触发", start: "开始", end: "结束",
};

const modalColors: Record<string, string> = {
  module: "var(--cat-blue)", choice: "var(--cat-purple)", judgment: "var(--cat-orange)",
  eventTrigger: "var(--cat-orange)", randomEvent: "var(--cat-pink)", randomJudgment: "var(--cat-purple)",
  loop: "var(--cat-blue)", dailyTrigger: "var(--cat-gray)", start: "var(--cat-green)", end: "var(--cat-red)",
};

export function NodeEditModal({ nodeType, data, modules, groupNodes, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<FlowNodeData>({ ...data });
  const storyPackage = useEditorStore((s) => s.storyPackage);

  useEffect(() => { setDraft({ ...data }); }, [data]);

  // Build dropdown options from story data
  const characters = storyPackage?.characters || [];
  const skills = storyPackage?.skills || [];
  const stages = storyPackage?.scenario?.stageDetails || [];

  const charOptions = characters.map((c) => ({ id: c.id, label: `${c.name} (${c.role})` }));
  const skillOptions = skills.map((s) => ({ id: s.id, label: `${s.name}` }));
  const stageOptions = stages.map((s) => ({ id: s.id, label: `${s.title || s.id}` }));
  const moduleOptions = modules.map((m) => ({ id: m.id, label: `${m.title} (${m.id})` }));

  const accent = modalColors[nodeType] || "var(--accent)";

  const formProps: FormProps = {
    draft, setDraft, modules, groupNodes,
    charOptions, skillOptions, stageOptions, moduleOptions,
  };

  // Select the appropriate form component
  function renderForm() {
    switch (nodeType) {
      case "module": return <ModuleForm {...formProps} />;
      case "choice": return <ChoiceForm {...formProps} />;
      case "judgment": return <JudgmentForm {...formProps} />;
      case "eventTrigger": return <EventTriggerForm {...formProps} />;
      case "randomEvent": return <RandomEventForm {...formProps} />;
      case "randomJudgment": return <RandomJudgmentForm {...formProps} />;
      case "loop": return <LoopForm {...formProps} />;
      case "dailyTrigger": return <DailyTriggerForm {...formProps} />;
      case "start":
      case "end": return <StartEndForm {...formProps} nodeType={nodeType} />;
      default: return <p className="faint">未知节点类型: {nodeType}</p>;
    }
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-popup" style={{ width: 700 }}>
        <div className="modal-header">
          <div className="flex-center gap3">
            <span style={{ width: 10, height: 10, borderRadius: 3, background: accent, flexShrink: 0 }} />
            <h3>编辑{typeLabel[nodeType] || nodeType}</h3>
            <span className="faint mono" style={{ fontSize: 9 }}>{nodeType}</span>
          </div>
          <button className="btn btn-ghost btn-xs" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "var(--s4)" }}>
          {renderForm()}

          <div className="flex-center gap2" style={{ justifyContent: "flex-end", borderTop: "1px solid var(--border-light)", paddingTop: "var(--s4)" }}>
            <button className="btn" onClick={onClose}>取消</button>
            <button className="btn btn-primary" onClick={() => { onSave(draft); onClose(); }}>保存</button>
          </div>
        </div>
      </div>
    </>
  );
}
