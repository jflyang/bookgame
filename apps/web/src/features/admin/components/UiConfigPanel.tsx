import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import type { StoryPackage, UiConfig } from "@story-game/shared";
import { useGameStore } from "../../../store/gameStore.js";

export function UiConfigPanel() {
  const { editingPackageId, storyPackages, saveStoryPackage } = useGameStore();
  const storyPackage = storyPackages.find((p) => p.id === editingPackageId);
  const [draft, setDraft] = useState<UiConfig>(structuredClone(storyPackage?.uiConfig ?? {}) as UiConfig);

  useEffect(() => {
    setDraft(structuredClone(storyPackage?.uiConfig ?? {}) as UiConfig);
  }, [storyPackage?.id]);

  if (!storyPackage) return null;
  const safePackage = storyPackage;

  function handleSave() {
    void saveStoryPackage({ ...safePackage, uiConfig: draft } as StoryPackage);
  }

  function updateTheme(key: string, value: string) {
    setDraft((prev) => ({ ...prev, theme: { ...prev.theme, [key]: value } }));
  }
  function updateScene(key: string, value: string) {
    setDraft((prev) => ({ ...prev, scene: { ...prev.scene, [key]: value } }));
  }
  function updateLabel(key: string, value: string) {
    setDraft((prev) => ({ ...prev, labels: { ...prev.labels, [key]: value } }));
  }

  const layout = draft.layout ?? {};
  const theme = draft.theme ?? {};
  const scene = draft.scene ?? {};
  const labels = draft.labels ?? {};
  const avatar = draft.avatar ?? {};

  return (
    <section className="panel">
      <h2>UI 配置</h2>

      <details open>
        <summary>布局配置</summary>
        <label className="checkbox-line" style={{ display: "flex", gap: 8, alignItems: "center", margin: "6px 0" }}>
          <input type="checkbox" checked={layout.showCharacterPanel !== false}
            onChange={(e) => setDraft((p) => ({ ...p, layout: { ...p.layout, showCharacterPanel: e.target.checked } }))} />
          显示角色面板
        </label>
        <label className="checkbox-line" style={{ display: "flex", gap: 8, alignItems: "center", margin: "6px 0" }}>
          <input type="checkbox" checked={layout.showQuickActions !== false}
            onChange={(e) => setDraft((p) => ({ ...p, layout: { ...p.layout, showQuickActions: e.target.checked } }))} />
          显示快捷操作
        </label>
        <label className="checkbox-line" style={{ display: "flex", gap: 8, alignItems: "center", margin: "6px 0" }}>
          <input type="checkbox" checked={layout.showDiceButton !== false}
            onChange={(e) => setDraft((p) => ({ ...p, layout: { ...p.layout, showDiceButton: e.target.checked } }))} />
          显示骰子按钮
        </label>
        <label className="checkbox-line" style={{ display: "flex", gap: 8, alignItems: "center", margin: "6px 0" }}>
          <input type="checkbox" checked={layout.showAutoPlay !== false}
            onChange={(e) => setDraft((p) => ({ ...p, layout: { ...p.layout, showAutoPlay: e.target.checked } }))} />
          显示自动继续
        </label>
      </details>

      <details>
        <summary>主题配置</summary>
        <div className="field-grid">
          {([
            ["primaryColor", "主色", theme.primaryColor ?? ""],
            ["accentColor", "强调色", theme.accentColor ?? ""],
            ["backgroundColor", "背景色", theme.backgroundColor ?? ""],
            ["surfaceColor", "表面色", theme.surfaceColor ?? ""],
            ["textColor", "文字色", theme.textColor ?? ""],
            ["navBackground", "导航背景", theme.navBackground ?? ""],
          ] as const).map(([key, label, value]) => (
            <label key={key} className="field-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {label}
              <input type="color" value={value || "#000000"} onChange={(e) => updateTheme(key, e.target.value)} style={{ width: 40 }} />
              <input className="field-input" value={value} onChange={(e) => updateTheme(key, e.target.value)} />
            </label>
          ))}
        </div>
        <label className="field-title" style={{ marginTop: 8 }}>标题字体
          <select className="field-input" value={theme.headingFont ?? "STKaiti"}
            onChange={(e) => updateTheme("headingFont", e.target.value)}>
            <option value="STKaiti">STKaiti (楷体)</option>
            <option value="KaiTi">KaiTi</option>
            <option value="SimSun">SimSun (宋体)</option>
            <option value="serif">serif</option>
            <option value="sans-serif">sans-serif</option>
          </select>
        </label>
        <label className="field-title">正文字体
          <select className="field-input" value={theme.bodyFont ?? "Inter"}
            onChange={(e) => updateTheme("bodyFont", e.target.value)}>
            <option value="Inter">Inter</option>
            <option value="Noto Sans SC">Noto Sans SC</option>
            <option value="system-ui">system-ui</option>
          </select>
        </label>
      </details>

      <details>
        <summary>场景文本</summary>
        <label className="field-title">场景标题
          <input className="field-input" value={scene.heading ?? ""} onChange={(e) => updateScene("heading", e.target.value)} />
        </label>
        <label className="field-title">开场旁白
          <textarea className="field-textarea" rows={3} value={scene.introNarration ?? ""} onChange={(e) => updateScene("introNarration", e.target.value)} />
        </label>
        <label className="field-title">空状态标题
          <input className="field-input" value={scene.emptyTitle ?? ""} onChange={(e) => updateScene("emptyTitle", e.target.value)} />
        </label>
        <label className="field-title">空状态提示
          <textarea className="field-textarea" rows={2} value={scene.emptyHint ?? ""} onChange={(e) => updateScene("emptyHint", e.target.value)} />
        </label>
      </details>

      <details>
        <summary>UI 标签</summary>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {([
            ["hp", "生命值标签"], ["mp", "内力值标签"], ["characters", "角色面板标题"],
            ["lastSpeaker", "上轮发言标签"], ["continue", "继续按钮"], ["autoPlay", "自动继续按钮"],
            ["send", "发送按钮"], ["manageCharacters", "角色管理按钮"],
            ["rules", "规则弹窗标题"], ["scenarioRules", "剧情规则标题"],
            ["promptRules", "提示词规则标题"], ["currentStatus", "当前状态标题"],
            ["round", "回合标签"], ["currentStage", "当前阶段标签"],
            ["statusActive", "进行中状态"], ["statusCompleted", "已结束状态"],
            ["interactiveStory", "页面标题"], ["storyManagement", "管理链接"],
            ["viewRules", "查看规则按钮"],
          ] as const).map(([key, label]) => (
            <label key={key} className="field-title" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {label}
              <input className="field-input" value={(labels as Record<string, string>)[key] ?? ""}
                onChange={(e) => updateLabel(key, e.target.value)} />
            </label>
          ))}
        </div>
      </details>

      <details>
        <summary>头像风格</summary>
        <label className="field-title">风格
          <select className="field-input" value={avatar.style ?? "gradient"}
            onChange={(e) => setDraft((p) => ({ ...p, avatar: { style: e.target.value as "gradient" | "emoji" | "url" } }))}>
            <option value="gradient">CSS 渐变色</option>
            <option value="emoji">Emoji / 文字</option>
            <option value="url">图片 URL</option>
          </select>
        </label>
      </details>

      <button onClick={handleSave}><Save size={16} /> 保存 UI 配置</button>
    </section>
  );
}
