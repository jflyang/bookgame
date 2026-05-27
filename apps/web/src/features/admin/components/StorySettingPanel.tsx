import { useEffect, useState } from "react";
import { Eraser, FileText, Plus, Save, Settings2, Trash2 } from "lucide-react";
import type { Scenario, ScenarioStageDetail } from "@story-game/shared";
import { useGameStore } from "../../../store/gameStore.js";

export function StorySettingPanel() {
  const { editingPackageId, storyPackages, saveStoryPackage } = useGameStore();
  const storyPackage = storyPackages.find((item) => item.id === editingPackageId);
  const scenario = storyPackage?.scenario;

  const [title, setTitle] = useState(scenario?.title ?? "");
  const [premise, setPremise] = useState(scenario?.premise ?? "");
  const [currentStage, setCurrentStage] = useState(scenario?.currentStage ?? "");
  const [stagesText, setStagesText] = useState(scenario?.stages?.join(", ") ?? "");
  const [currentGoal, setCurrentGoal] = useState(scenario?.currentGoal ?? "");
  const [rulesText, setRulesText] = useState(scenario?.rules?.join("\n") ?? "");
  const [storySettingPrompt, setStorySettingPrompt] = useState(storyPackage?.storySettingPrompt ?? "");
  const [stageDetails, setStageDetails] = useState<ScenarioStageDetail[]>(buildStageDetails(scenario?.stages ?? [], scenario?.stageDetails ?? []));
  const [defaultSpeakerId, setDefaultSpeakerId] = useState(scenario?.defaultSpeakerId ?? "");
  const hasDuplicatedStateHints = /初始状态|状态格式|\[状态\]/.test(storySettingPrompt);

  useEffect(() => {
    setTitle(scenario?.title ?? "");
    setPremise(scenario?.premise ?? "");
    setCurrentStage(scenario?.currentStage ?? "");
    setStagesText(scenario?.stages?.join(", ") ?? "");
    setCurrentGoal(scenario?.currentGoal ?? "");
    setRulesText(scenario?.rules?.join("\n") ?? "");
    setStorySettingPrompt(storyPackage?.storySettingPrompt ?? "");
    setStageDetails(buildStageDetails(scenario?.stages ?? [], scenario?.stageDetails ?? []));
    setDefaultSpeakerId(scenario?.defaultSpeakerId ?? "");
  }, [storyPackage?.id, scenario?.title]);

  if (!storyPackage || !scenario) return null;
  const safeScenario = scenario;
  const safePackage = storyPackage;

  function buildScenario(): Scenario {
    const stages = stagesText.split(",").map((s) => s.trim()).filter(Boolean);
    const rules = rulesText.split("\n").map((s) => s.trim()).filter(Boolean);
    return {
      id: safeScenario.id,
      title,
      premise,
      currentStage,
      stages: stages.length > 0 ? stages : [...safeScenario.stages],
      stageDetails: buildStageDetails(stages.length > 0 ? stages : [...safeScenario.stages], stageDetails),
      currentGoal,
      rules: rules.length > 0 ? rules : [...safeScenario.rules],
      initialStates: [...safeScenario.initialStates],
      defaultSpeakerId: defaultSpeakerId || undefined
    };
  }

  function handleSaveStorySetting() {
    const scenario = buildScenario();
    void saveStoryPackage({
      ...safePackage,
      title: scenario.title,
      scenario,
      storySettingPrompt
    });
  }

  function stageList() {
    return stageDetails.map((stage) => stage.id);
  }

  function saveStageList(nextStages: string[]) {
    const nextDetails = buildStageDetails(nextStages, stageDetails);
    setStageDetails(nextDetails);
    setStagesText(nextStages.join(", "));
    if (!nextStages.includes(currentStage)) {
      setCurrentStage(nextStages[0] ?? "");
    }
  }

  function updateStage(index: number, patch: Partial<ScenarioStageDetail>) {
    setStageDetails((prev) => {
      const next = prev.map((stage, i) => (i === index ? { ...stage, ...patch, id: patch.id?.trim() ?? stage.id } : stage));
      const validStages = next.map((stage) => stage.id).filter(Boolean);
      setStagesText(validStages.join(", "));
      if (patch.id && currentStage === prev[index]?.id) {
        setCurrentStage(patch.id.trim());
      }
      return next;
    });
  }

  function moveStage(index: number, direction: -1 | 1) {
    setStageDetails((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      setStagesText(next.map((stage) => stage.id).filter(Boolean).join(", "));
      return next;
    });
  }

  function makeUniqueStageId(baseId: string) {
    const existing = new Set(stageList());
    if (!existing.has(baseId)) return baseId;
    let i = 2;
    while (existing.has(`${baseId}_${i}`)) {
      i += 1;
    }
    return `${baseId}_${i}`;
  }

  function addStage() {
    const id = makeUniqueStageId("new_stage");
    const next = [...stageDetails, { id, title: "新阶段", description: "", enterWhen: "", guidance: "" }];
    setStageDetails(next);
    setStagesText(next.map((stage) => stage.id).join(", "));
    if (!currentStage) setCurrentStage(id);
  }

  function removeStage(index: number) {
    saveStageList(stageList().filter((_, i) => i !== index));
  }

  return (
    <section className="panel scenario-panel markdown-scenario-panel">
      <div className="scenario-editor-hero">
        <div>
          <span className="eyebrow">Scenario Markdown</span>
          <h2>剧情设定</h2>
          <p className="muted">按顺序填写：主设定 Markdown、阶段卡片、系统读取配置。阶段卡片会注入给 LLM，用来判断 stageSuggestion。</p>
        </div>
        <button type="button" className="admin-save-button" onClick={handleSaveStorySetting}><Save size={16} /> 保存剧情设定</button>
      </div>

      <div className="scenario-editor-grid">
        <section className="markdown-editor-card">
          <div className="markdown-editor-header">
            <div>
              <span><FileText size={16} /> 主设定提示词</span>
              <small>写世界观、人物关系、战斗规则和叙事限制；不要在这里重复维护阶段说明和初始数值。</small>
            </div>
          </div>
          {hasDuplicatedStateHints && (
            <div className="markdown-duplication-warning">
              <div>
                <strong>检测到 Markdown 里包含状态数值说明</strong>
                <p>初始气血/内力由右侧结构化配置作为唯一数据源；每轮状态行由服务端自动追加，建议从 Markdown 中移除重复状态段。</p>
              </div>
              <button type="button" className="ghost-button" onClick={() => setStorySettingPrompt(removeGeneratedStateHints(storySettingPrompt))}>
                <Eraser size={15} /> 清理重复状态段
              </button>
            </div>
          )}
          <textarea
            className="story-setting-editor markdown-story-editor"
            value={storySettingPrompt}
            onChange={(e) => setStorySettingPrompt(e.target.value)}
            spellCheck={false}
          />
        </section>

        <section className="stage-config-card stage-card-section">
          <div className="stage-config-heading">
            <strong>阶段卡片</strong>
            <small>阶段 ID 给程序匹配；标题、说明、进入条件、推进建议会注入 Prompt，帮助 LLM 判断下一阶段。</small>
          </div>
          <label className="system-field current-stage-select">
            <span>当前阶段</span>
            <select value={currentStage} onChange={(e) => setCurrentStage(e.target.value)}>
              {stageList().map((stage) => (
                <option value={stage} key={stage}>{stage}</option>
              ))}
              {!stageList().includes(currentStage) && currentStage && <option value={currentStage}>{currentStage}</option>}
            </select>
          </label>
          <label className="system-field">
            <span>默认发言者</span>
            <select value={defaultSpeakerId} onChange={(e) => setDefaultSpeakerId(e.target.value)}>
              <option value="">（不指定，取列表第一个）</option>
              {safePackage.characters.map((c) => (
                <option value={c.id} key={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <div className="stage-card-list">
            {stageDetails.map((stage, index) => (
              <article className={`stage-detail-card ${stage.id === currentStage ? "active" : ""}`} key={`${stage.id}-${index}`}>
                <div className="stage-detail-card-header">
                  <span className="stage-flow-index">{index + 1}</span>
                  <div>
                    <strong>{stage.title || stage.id || "未命名阶段"}</strong>
                    <small>ID: {stage.id || "empty"}</small>
                  </div>
                  <div className="stage-card-actions">
                    <button type="button" className="ghost-button compact-button" disabled={index === 0} onClick={() => moveStage(index, -1)}>上移</button>
                    <button type="button" className="ghost-button compact-button" disabled={index === stageDetails.length - 1} onClick={() => moveStage(index, 1)}>下移</button>
                    <button type="button" className="icon-only danger-lite" aria-label={`删除阶段 ${stage.id}`} onClick={() => removeStage(index)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="stage-detail-grid">
                  <label className="system-field">
                    <span>阶段 ID</span>
                    <input value={stage.id} onChange={(e) => updateStage(index, { id: e.target.value })} placeholder="poison_fog" />
                  </label>
                  <label className="system-field">
                    <span>显示名称</span>
                    <input value={stage.title} onChange={(e) => updateStage(index, { title: e.target.value })} placeholder="毒雾初起" />
                  </label>
                  <label className="system-field wide">
                    <span>阶段说明</span>
                    <textarea value={stage.description} onChange={(e) => updateStage(index, { description: e.target.value })} rows={2} placeholder="这个阶段发生了什么，场面有什么变化。" />
                  </label>
                  <label className="system-field">
                    <span>进入条件</span>
                    <textarea value={stage.enterWhen} onChange={(e) => updateStage(index, { enterWhen: e.target.value })} rows={2} placeholder="什么时候可以进入这个阶段。" />
                  </label>
                  <label className="system-field">
                    <span>推进建议</span>
                    <textarea value={stage.guidance} onChange={(e) => updateStage(index, { guidance: e.target.value })} rows={2} placeholder="进入该阶段后，LLM 应该怎么推进剧情。" />
                  </label>
                </div>
              </article>
            ))}
          </div>
          <button type="button" className="ghost-button stage-add-button" onClick={addStage}><Plus size={15} /> 添加阶段卡片</button>
        </section>

        <section className="system-config-card">
          <div className="system-config-header">
            <Settings2 size={18} />
            <div>
              <h3>系统读取配置</h3>
              <p>这些字段会被服务端读取，影响开局状态和阶段校验。</p>
            </div>
          </div>

          <label className="system-field">
            <span>故事标题</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <details className="legacy-scenario-fields">
            <summary>兼容旧结构字段</summary>
            <label className="system-field">
              <span>前提交代</span>
              <textarea value={premise} onChange={(e) => setPremise(e.target.value)} rows={2} />
            </label>
            <label className="system-field">
              <span>当前目标</span>
              <textarea value={currentGoal} onChange={(e) => setCurrentGoal(e.target.value)} rows={2} />
            </label>
            <label className="system-field">
              <span>故事规则（一行一条）</span>
              <textarea value={rulesText} onChange={(e) => setRulesText(e.target.value)} rows={4} />
            </label>
          </details>

          <button type="button" className="admin-save-button" onClick={handleSaveStorySetting}><Save size={16} /> 保存剧情设定</button>
        </section>
      </div>
    </section>
  );
}

function removeGeneratedStateHints(text: string) {
  return text
    .split("\n")
    .filter((line) => !/初始状态|每次对话最后|状态格式|\[状态\]/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildStageDetails(stages: string[], details: ScenarioStageDetail[]) {
  return stages.map((stageId) => {
    const existing = details.find((stage) => stage.id === stageId);
    return existing ?? {
      id: stageId,
      title: inferStageTitle(stageId),
      description: "",
      enterWhen: "",
      guidance: ""
    };
  });
}

function inferStageTitle(stageId: string) {
  const titles: Record<string, string> = {
    opening: "开场",
    encounter: "遭遇",
    poison_fog: "毒雾初起",
    counterattack: "反击",
    crisis: "危机",
    resolution: "结局"
  };
  return titles[stageId] ?? stageId.replaceAll("_", " ");
}
