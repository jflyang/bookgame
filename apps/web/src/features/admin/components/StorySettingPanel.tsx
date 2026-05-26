import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import type { Scenario, InitialCharacterState } from "@story-game/shared";
import { useGameStore } from "../../../store/gameStore.js";

export function StorySettingPanel() {
  const { editingPackageId, storyPackages, saveScenario, saveStoryPackage } = useGameStore();
  const storyPackage = storyPackages.find((item) => item.id === editingPackageId);
  const scenario = storyPackage?.scenario;

  const [title, setTitle] = useState(scenario?.title ?? "");
  const [premise, setPremise] = useState(scenario?.premise ?? "");
  const [currentStage, setCurrentStage] = useState(scenario?.currentStage ?? "");
  const [stagesText, setStagesText] = useState(scenario?.stages?.join(", ") ?? "");
  const [currentGoal, setCurrentGoal] = useState(scenario?.currentGoal ?? "");
  const [rulesText, setRulesText] = useState(scenario?.rules?.join("\n") ?? "");
  const [storySettingPrompt, setStorySettingPrompt] = useState(storyPackage?.storySettingPrompt ?? "");
  const [initialStates, setInitialStates] = useState<InitialCharacterState[]>(scenario?.initialStates ?? []);

  useEffect(() => {
    setTitle(scenario?.title ?? "");
    setPremise(scenario?.premise ?? "");
    setCurrentStage(scenario?.currentStage ?? "");
    setStagesText(scenario?.stages?.join(", ") ?? "");
    setCurrentGoal(scenario?.currentGoal ?? "");
    setRulesText(scenario?.rules?.join("\n") ?? "");
    setStorySettingPrompt(storyPackage?.storySettingPrompt ?? "");
    setInitialStates(scenario?.initialStates ?? []);
  }, [storyPackage?.id, scenario?.title]);

  if (!storyPackage || !scenario) return null;
  const safeScenario = scenario;
  const safePackage = storyPackage;

  function handleSaveScenario() {
    const stages = stagesText.split(",").map((s) => s.trim()).filter(Boolean);
    const rules = rulesText.split("\n").map((s) => s.trim()).filter(Boolean);
    const next: Scenario = {
      id: safeScenario.id,
      title,
      premise,
      currentStage,
      stages: stages.length > 0 ? stages : [...safeScenario.stages],
      currentGoal,
      rules: rules.length > 0 ? rules : [...safeScenario.rules],
      initialStates
    };
    void saveScenario(next);
  }

  function handleSavePrompt() {
    void saveStoryPackage({ ...safePackage, storySettingPrompt });
  }

  function updateInitialState(characterId: string, field: "hp" | "mp", value: number) {
    setInitialStates((prev) =>
      prev.map((s) => (s.characterId === characterId ? { ...s, [field]: value } : s))
    );
  }

  return (
    <section className="panel scenario-panel">
      <h2>剧情设置</h2>

      <div className="field-grid">
        <label className="field-title">故事标题</label>
        <input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} />

        <label className="field-title">前提交代</label>
        <textarea className="field-textarea" value={premise} onChange={(e) => setPremise(e.target.value)} rows={2} />

        <label className="field-title">当前阶段</label>
        <input className="field-input" value={currentStage} onChange={(e) => setCurrentStage(e.target.value)} />

        <label className="field-title">阶段列表（逗号分隔）</label>
        <input className="field-input" value={stagesText} onChange={(e) => setStagesText(e.target.value)} placeholder="opening, encounter, poison_fog, counterattack, crisis, resolution" />

        <label className="field-title">当前目标</label>
        <textarea className="field-textarea" value={currentGoal} onChange={(e) => setCurrentGoal(e.target.value)} rows={2} />

        <label className="field-title">故事规则（一行一条）</label>
        <textarea className="field-textarea" value={rulesText} onChange={(e) => setRulesText(e.target.value)} rows={4} />
      </div>

      <h3 style={{ marginTop: 16 }}>角色初始状态</h3>
      <div className="field-grid">
        {initialStates.map((s) => (
          <div key={s.characterId} style={{ display: "contents" }}>
            <label className="field-title">{s.characterId}</label>
            <span className="initial-state-row">
              <label>气血</label>
              <input type="number" value={s.hp} onChange={(e) => updateInitialState(s.characterId, "hp", Number(e.target.value))} />
              <label>内力</label>
              <input type="number" value={s.mp} onChange={(e) => updateInitialState(s.characterId, "mp", Number(e.target.value))} />
            </span>
          </div>
        ))}
      </div>

      <button onClick={handleSaveScenario}><Save size={16} /> 保存剧情设定</button>

      <hr style={{ margin: "20px 0", borderColor: "#ded1bf" }} />

      <h2>故事包主设定提示词</h2>
      <p className="muted">剧情走向、生命内力、状态格式、输出规则等额外提示词。</p>
      <textarea
        className="story-setting-editor"
        value={storySettingPrompt}
        onChange={(e) => setStorySettingPrompt(e.target.value)}
      />
      <button onClick={handleSavePrompt}><Save size={16} /> 保存主设定</button>
    </section>
  );
}
