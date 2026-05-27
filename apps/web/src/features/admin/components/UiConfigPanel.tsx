import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Image, PanelLeft, Palette, PlayCircle, Save, Sparkles, Upload, Zap } from "lucide-react";
import type { StoryPackage, UiConfig, UiThemeConfig } from "@story-game/shared";
import { useGameStore } from "../../../store/gameStore.js";
import { uploadBackgroundImage } from "../../../lib/adminApi.js";

type ThemePresetId = "classic" | "clean" | "night";

const THEME_PRESETS: Record<ThemePresetId, {
  id: ThemePresetId;
  title: string;
  description: string;
  swatches: string[];
  theme: Partial<UiThemeConfig>;
}> = {
  classic: {
    id: "classic",
    title: "武侠纸页",
    description: "温润纸色，适合古风叙事。",
    swatches: ["#1f5b51", "#2b987a", "#f7f1e7"],
    theme: {
      primaryColor: "#1f5b51",
      accentColor: "#2b987a",
      backgroundColor: "#f7f1e7",
      surfaceColor: "#fffaf2",
      textColor: "#2f3133",
      headingFont: "STKaiti",
      bodyFont: "Inter",
      navBackground: "#0a1728"
    }
  },
  clean: {
    id: "clean",
    title: "清爽浅色",
    description: "更像现代工具，信息更清晰。",
    swatches: ["#2563eb", "#14b8a6", "#f8fafc"],
    theme: {
      primaryColor: "#2563eb",
      accentColor: "#14b8a6",
      backgroundColor: "#f8fafc",
      surfaceColor: "#ffffff",
      textColor: "#0f172a",
      headingFont: "system-ui",
      bodyFont: "Inter",
      navBackground: "#ffffff"
    }
  },
  night: {
    id: "night",
    title: "暗色江湖",
    description: "沉浸感更强，适合紧张剧情。",
    swatches: ["#0f766e", "#f59e0b", "#111827"],
    theme: {
      primaryColor: "#0f766e",
      accentColor: "#f59e0b",
      backgroundColor: "#111827",
      surfaceColor: "#1f2937",
      textColor: "#f8fafc",
      headingFont: "STKaiti",
      bodyFont: "Inter",
      navBackground: "#030712"
    }
  }
};

const AVATAR_OPTIONS = [
  { value: "gradient", title: "渐变头像", description: "按角色生成统一头像色块。" },
  { value: "emoji", title: "文字头像", description: "直接显示角色头像字段。" },
  { value: "url", title: "图片头像", description: "头像字段为链接时显示图片。" }
] as const;

function cloneUiConfig(config?: UiConfig) {
  return structuredClone(config ?? {}) as UiConfig;
}

export function UiConfigPanel() {
  const { editingPackageId, storyPackages, saveStoryPackage } = useGameStore();
  const storyPackage = storyPackages.find((p) => p.id === editingPackageId);
  const [draft, setDraft] = useState<UiConfig>(cloneUiConfig(storyPackage?.uiConfig));
  const [bgUploading, setBgUploading] = useState(false);
  const bgFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(cloneUiConfig(storyPackage?.uiConfig));
  }, [storyPackage?.id]);

  if (!storyPackage) return null;
  const safePackage = storyPackage;
  const layout = draft.layout ?? {};
  const theme = draft.theme ?? {};
  const avatar = draft.avatar ?? {};
  const scene = draft.scene ?? {};
  const activePreset = detectPreset(theme);

  function handleSave() {
    void saveStoryPackage({ ...safePackage, uiConfig: draft } as StoryPackage);
  }

  function updateLayout(key: "showCharacterPanel" | "showQuickActions" | "showAutoPlay", value: boolean) {
    setDraft((prev) => ({ ...prev, layout: { ...prev.layout, [key]: value } }));
  }

  function applyPreset(id: ThemePresetId) {
    setDraft((prev) => ({ ...prev, theme: { ...prev.theme, ...THEME_PRESETS[id].theme } }));
  }

  function updateAvatarStyle(style: "gradient" | "emoji" | "url") {
    setDraft((prev) => ({ ...prev, avatar: { ...prev.avatar, style } }));
  }

  function updateScene(key: string, value: string) {
    setDraft((prev) => ({ ...prev, scene: { ...prev.scene, [key]: value } }));
  }

  async function handleBgUpload(file: File | undefined) {
    if (!file || !editingPackageId) return;
    setBgUploading(true);
    try {
      const result = await uploadBackgroundImage(editingPackageId, file);
      setDraft((prev) => ({ ...prev, scene: { ...prev.scene, backgroundImage: result.path } }));
    } catch (err) {
      console.error("Failed to upload background image:", err);
    } finally {
      setBgUploading(false);
    }
  }

  return (
    <section className="panel ui-config-panel">
      <div className="ui-config-hero">
        <div>
          <span className="eyebrow">Player Interface</span>
          <h2>玩家界面</h2>
          <p className="muted">只保留会影响玩家体验的核心开关。复杂文案和内部标签继续使用默认配置。</p>
        </div>
        <button type="button" className="admin-save-button" onClick={handleSave}>
          <Save size={16} /> 保存界面配置
        </button>
      </div>

      <div className="ui-config-shell">
        <section className="ui-config-card">
          <div className="ui-section-heading">
            <PanelLeft size={18} />
            <div>
              <strong>玩家端模块</strong>
              <small>决定玩家界面上显示哪些操作区域。</small>
            </div>
          </div>
          <div className="ui-toggle-list">
            <ToggleRow
              icon={<PanelLeft size={18} />}
              title="角色面板"
              description="显示角色状态、技能和选中发言人。"
              checked={layout.showCharacterPanel !== false}
              onChange={(value) => updateLayout("showCharacterPanel", value)}
            />
            <ToggleRow
              icon={<Zap size={18} />}
              title="快捷操作"
              description="显示继续、规则、存档等常用按钮。"
              checked={layout.showQuickActions !== false}
              onChange={(value) => updateLayout("showQuickActions", value)}
            />
            <ToggleRow
              icon={<PlayCircle size={18} />}
              title="自动继续"
              description="允许玩家一键让故事持续推进。"
              checked={layout.showAutoPlay !== false}
              onChange={(value) => updateLayout("showAutoPlay", value)}
            />
          </div>
        </section>

        <section className="ui-config-card">
          <div className="ui-section-heading">
            <Palette size={18} />
            <div>
              <strong>视觉风格</strong>
              <small>选择一个整体风格即可，不需要逐项调色。</small>
            </div>
          </div>
          <div className="ui-preset-grid">
            {Object.values(THEME_PRESETS).map((preset) => (
              <button
                className={`ui-preset-card ${activePreset === preset.id ? "active" : ""}`}
                type="button"
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                onMouseDown={() => applyPreset(preset.id)}
              >
                <span className="ui-preset-swatches">
                  {preset.swatches.map((color) => <i key={color} style={{ background: color }} />)}
                </span>
                <strong>{preset.title}</strong>
                <small>{preset.description}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="ui-config-card">
          <div className="ui-section-heading">
            <Sparkles size={18} />
            <div>
              <strong>场景设置</strong>
              <small>对话页面的场景标题、开场文案和背景图。</small>
            </div>
          </div>
          <div className="ui-scene-fields">
            <label className="ui-field">
              <span>场景标题</span>
              <input
                type="text"
                value={scene.heading ?? ""}
                onChange={(e) => updateScene("heading", e.target.value)}
                placeholder="如：别墅密室"
              />
            </label>
            <label className="ui-field">
              <span>背景图片</span>
              <div className="ui-field-row">
                <input
                  type="text"
                  value={scene.backgroundImage ?? ""}
                  onChange={(e) => updateScene("backgroundImage", e.target.value)}
                  placeholder="上传图片或手动输入 URL"
                  style={{ flex: 1 }}
                />
                <input
                  ref={bgFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => handleBgUpload(e.target.files?.[0])}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ minHeight: 36, fontSize: "0.82rem", whiteSpace: "nowrap" }}
                  disabled={bgUploading}
                  onClick={() => bgFileRef.current?.click()}
                >
                  <Upload size={14} /> {bgUploading ? "上传中..." : "上传"}
                </button>
                {scene.backgroundImage && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ minHeight: 36, fontSize: "0.82rem" }}
                    onClick={() => updateScene("backgroundImage", "")}
                    title="清除背景图"
                  >
                    清除
                  </button>
                )}
              </div>
            </label>
            <label className="ui-field">
              <span>开场旁白</span>
              <textarea
                rows={2}
                value={scene.introNarration ?? ""}
                onChange={(e) => updateScene("introNarration", e.target.value)}
                placeholder="故事开始前显示的叙述文字"
              />
            </label>
            <label className="ui-field">
              <span>空状态标题</span>
              <input
                type="text"
                value={scene.emptyTitle ?? ""}
                onChange={(e) => updateScene("emptyTitle", e.target.value)}
                placeholder="尚无消息时显示的标题"
              />
            </label>
            <label className="ui-field">
              <span>空状态提示</span>
              <input
                type="text"
                value={scene.emptyHint ?? ""}
                onChange={(e) => updateScene("emptyHint", e.target.value)}
                placeholder="尚无消息时显示的提示文字"
              />
            </label>
          </div>
        </section>

        <section className="ui-config-card">
          <div className="ui-section-heading">
            <Image size={18} />
            <div>
              <strong>头像显示</strong>
              <small>控制玩家端角色头像的呈现方式。</small>
            </div>
          </div>
          <div className="ui-segmented-options">
            {AVATAR_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.value}
                className={avatar.style === option.value || (!avatar.style && option.value === "gradient") ? "active" : ""}
                onClick={() => updateAvatarStyle(option.value)}
                onMouseDown={() => updateAvatarStyle(option.value)}
              >
                <strong>{option.title}</strong>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
        </section>

        <aside className="ui-preview-card" style={{
          "--preview-primary": theme.primaryColor ?? "#1f5b51",
          "--preview-accent": theme.accentColor ?? "#2b987a",
          "--preview-bg": theme.backgroundColor ?? "#f7f1e7",
          "--preview-surface": theme.surfaceColor ?? "#fffaf2",
          "--preview-text": theme.textColor ?? "#2f3133"
        } as CSSProperties}>
          <div className="ui-preview-topbar">
            <span />
            <span />
            <span />
          </div>
          <div className="ui-preview-body">
            <div>
              <small>界面预览</small>
              <strong>{THEME_PRESETS[activePreset].title}</strong>
            </div>
            <div className="ui-preview-message">
              <Sparkles size={16} />
              <span>故事会按这个风格展示给玩家。</span>
            </div>
            <div className="ui-preview-actions">
              {layout.showQuickActions !== false && <span>快捷操作</span>}
              {layout.showCharacterPanel !== false && <span>角色面板</span>}
              {layout.showAutoPlay !== false && <span>自动继续</span>}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange
}: {
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="ui-toggle-row" onMouseDown={(event) => {
      event.preventDefault();
      onChange(!checked);
    }}>
      <span className="ui-toggle-icon">{icon}</span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

function detectPreset(theme: Partial<UiThemeConfig>): ThemePresetId {
  const match = Object.values(THEME_PRESETS).find((preset) => preset.theme.primaryColor === theme.primaryColor);
  return match?.id ?? "classic";
}
