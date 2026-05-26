import { Plus, Save, Trash2 } from "lucide-react";
import type { StoryPromptRule } from "@story-game/shared";
import { useGameStore } from "../../../store/gameStore.js";

const categoryLabels: Record<StoryPromptRule["category"], string> = {
  knowledge_forcing: "知识库/技能强制使用",
  group_chat_boundary: "群聊规则",
  scenario_injection: "剧情设定注入",
  state_output: "血量/内力状态输出",
  history_state: "历史上下文保留状态行",
  custom: "自定义特殊规则"
};

export function PromptRulesPanel() {
  const { editingPackageId, storyPackages, saveStoryPackage } = useGameStore();
  const storyPackage = storyPackages.find((item) => item.id === editingPackageId);
  if (!storyPackage) return null;
  const activePackage = storyPackage;

  function savePromptRules(promptRules: StoryPromptRule[]) {
    void saveStoryPackage({ ...activePackage, promptRules });
  }

  function updateRule(ruleId: string, patch: Partial<StoryPromptRule>) {
    const promptRules = activePackage.promptRules.map((rule) => (
      rule.id === ruleId ? { ...rule, ...patch } : rule
    ));
    savePromptRules(promptRules);
  }

  function addRule() {
    const nextRule: StoryPromptRule = {
      id: `rule_custom_${Date.now()}`,
      title: "新的特殊规则",
      category: "custom",
      enabled: true,
      content: "写入这个故事包专属的特殊规则。"
    };
    savePromptRules([...activePackage.promptRules, nextRule]);
  }

  function removeRule(ruleId: string) {
    savePromptRules(activePackage.promptRules.filter((rule) => rule.id !== ruleId));
  }

  return (
    <section className="panel prompt-rules-panel">
      <div className="panel-title-row">
        <h2>故事包规则</h2>
        <button type="button" className="ghost-button" onClick={addRule}><Plus size={16} /> 新增规则</button>
      </div>
      <p className="muted">这些规则属于当前故事包插件，会随故事包导入导出；大模型配置不会包含在这里。</p>
      <div className="rule-list">
        {activePackage.promptRules.map((rule) => (
          <article className="rule-editor" key={rule.id}>
            <div className="rule-editor-header">
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(event) => updateRule(rule.id, { enabled: event.target.checked })}
                />
                启用
              </label>
              <span>{categoryLabels[rule.category]}</span>
              <button type="button" className="danger-button compact-button" onClick={() => removeRule(rule.id)}>
                <Trash2 size={15} /> 删除
              </button>
            </div>
            <label>
              标题
              <input value={rule.title} onChange={(event) => updateRule(rule.id, { title: event.target.value })} />
            </label>
            <label>
              内容
              <textarea value={rule.content} onChange={(event) => updateRule(rule.id, { content: event.target.value })} />
            </label>
          </article>
        ))}
      </div>
      <button type="button" onClick={() => void saveStoryPackage(activePackage)}><Save size={16} /> 保存规则</button>
    </section>
  );
}
