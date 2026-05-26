import { useEffect, useState } from "react";
import { Cpu, Save } from "lucide-react";
import type { LlmConfig } from "@story-game/shared";
import { useGameStore } from "../../../store/gameStore.js";

export function LlmConfigPanel() {
  const { llmConfig, loadLlmConfig, saveLlmConfig } = useGameStore();
  const [apiKey, setApiKey] = useState("");
  const [draft, setDraft] = useState<LlmConfig>({
    provider: "mock",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    temperature: 0.8,
    maxTokens: 800
  });

  useEffect(() => {
    void loadLlmConfig();
  }, [loadLlmConfig]);

  useEffect(() => {
    if (!llmConfig) return;
    setDraft({
      provider: llmConfig.provider,
      baseUrl: llmConfig.baseUrl,
      model: llmConfig.model,
      temperature: llmConfig.temperature,
      maxTokens: llmConfig.maxTokens
    });
  }, [llmConfig]);

  const nextConfig: LlmConfig = apiKey.trim() ? { ...draft, apiKey: apiKey.trim() } : draft;

  return (
    <section className="panel llm-config">
      <h2><Cpu size={16} /> 大模型配置</h2>
      <label>
        Provider
        <select value={draft.provider} onChange={(event) => setDraft({ ...draft, provider: event.target.value as LlmConfig["provider"] })}>
          <option value="mock">Mock 本地模拟</option>
          <option value="deepseek">DeepSeek</option>
        </select>
      </label>
      <label>
        Base URL
        <input value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} />
      </label>
      <label>
        Model
        <input value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} />
      </label>
      <div className="inline-fields">
        <label>
          Temperature
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={draft.temperature}
            onChange={(event) => setDraft({ ...draft, temperature: Number(event.target.value) })}
          />
        </label>
        <label>
          Max Tokens
          <input
            type="number"
            min={1}
            value={draft.maxTokens}
            onChange={(event) => setDraft({ ...draft, maxTokens: Number(event.target.value) })}
          />
        </label>
      </div>
      <label>
        DeepSeek API Key
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={llmConfig?.hasApiKey ? "已配置，留空则不修改" : "sk-..."}
        />
      </label>
      <p className="muted">当前密钥状态：{llmConfig?.hasApiKey ? "已配置" : "未配置"}。密钥只保存到后端内存，不会回显到浏览器。</p>
      <button onClick={() => { void saveLlmConfig(nextConfig); setApiKey(""); }}><Save size={16} /> 保存大模型配置</button>
    </section>
  );
}
