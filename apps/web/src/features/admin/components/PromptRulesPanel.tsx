import { CheckCircle2, FileText, Plus, Save, Sparkles, Trash2 } from "lucide-react";
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
  const enabledRuleCount = activePackage.promptRules.filter((rule) => rule.enabled).length;

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
      <div className="prompt-rules-hero">
        <div>
          <span className="eyebrow">Prompt Rule Layer</span>
          <h2>故事包规则</h2>
          <p className="muted">这些规则属于当前故事包插件，会随故事包导入导出；大模型配置不会包含在这里。</p>
        </div>
        <div className="prompt-rules-actions">
          <div className="rule-stat">
            <strong>{enabledRuleCount}</strong>
            <span>已启用</span>
          </div>
          <button type="button" className="primary-soft-button" onClick={addRule}><Plus size={16} /> 新增规则</button>
        </div>
      </div>

      <div className="rule-list">
        {activePackage.promptRules.map((rule, index) => (
          <article className={`rule-editor ${rule.enabled ? "is-enabled" : "is-disabled"}`} key={rule.id}>
            <div className="rule-editor-header">
              <div className="rule-editor-title">
                <span className="rule-order">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <span className="rule-category"><FileText size={14} /> {categoryLabels[rule.category]}</span>
                  <h3>{rule.title || "未命名规则"}</h3>
                </div>
              </div>
              <div className="rule-toolbar">
                <label className="rule-switch">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(event) => updateRule(rule.id, { enabled: event.target.checked })}
                  />
                  <span>{rule.enabled ? "已启用" : "已停用"}</span>
                </label>
                <button type="button" className="danger-button compact-button" onClick={() => removeRule(rule.id)}>
                  <Trash2 size={15} /> 删除
                </button>
              </div>
            </div>

            <div className="rule-form-grid">
              <label className="rule-field">
                <span>规则标题</span>
                <small>显示在规则弹窗和流程树中，建议 6-12 个字说明用途。</small>
                <input value={rule.title} onChange={(event) => updateRule(rule.id, { title: event.target.value })} />
              </label>
              <div className="rule-helper-card">
                <Sparkles size={16} />
                <div>
                  <strong>写法提示</strong>
                  <p>把“模型必须做什么”和“禁止做什么”写成明确指令。涉及角色、状态、知识库时优先使用变量，避免写死内容。</p>
                </div>
              </div>
            </div>

            <label className="rule-field">
              <span>规则内容</span>
              <small>这段文本会进入 LLM 的故事包规则层，越靠前的规则越像全局约束。</small>
              <textarea
                className="rule-content-textarea"
                value={rule.content}
                onChange={(event) => updateRule(rule.id, { content: event.target.value })}
              />
            </label>

            <div className="rule-variable-bar">
              <span><CheckCircle2 size={14} /> 常用变量</span>
              <code>{"{currentCharacterName}"}</code>
              <code>{"{otherCharacterNames}"}</code>
              <code>{"{scenarioSetting}"}</code>
              <code>{"{roundSummary}"}</code>
            </div>
          </article>
        ))}
      </div>
      <div className="prompt-rules-footer">
        <button type="button" className="admin-save-button" onClick={() => void saveStoryPackage(activePackage)}><Save size={16} /> 保存规则</button>
        <span>编辑后会写入当前任务包，导出故事包时一起带走。</span>
      </div>
    </section>
  );
}
