import { useEffect, useState } from "react";
import { CircleHelp, FolderOpen, MoreVertical, RefreshCw, RotateCcw, Save, ScrollText, Send, Settings, X } from "lucide-react";
import { CharacterRail } from "./components/CharacterRail.js";
import { Composer } from "./components/Composer.js";
import { MessageList } from "./components/MessageList.js";
import UiConfigContext, { useLabels, useUiConfig } from "./UiConfigContext.js";
import { StoryAssetsProvider } from "./contexts/StoryAssetsContext.js";
import { AudioManagerProvider } from "./contexts/AudioManager.js";
import { StoryPerformanceRuntime } from "./performances/StoryPerformanceRuntime.js";
import { useCustomFonts } from "./hooks/useCustomFonts.js";
import { useCustomCss } from "./hooks/useCustomCss.js";
import type { UiConfig } from "@story-game/shared";
import { useGameStore } from "../../store/gameStore.js";

function themeVars(uiConfig?: UiConfig): React.CSSProperties {
  const theme = uiConfig?.theme;
  const scene = uiConfig?.scene;
  const vars: Record<string, string> = {};
  if (theme?.primaryColor) vars["--color-primary"] = theme.primaryColor;
  if (theme?.accentColor) {
    vars["--color-accent"] = theme.accentColor;
    vars["--color-selected-indicator"] = theme.accentColor;
  }
  if (theme?.backgroundColor) vars["--color-bg"] = theme.backgroundColor;
  if (theme?.surfaceColor) vars["--color-surface"] = theme.surfaceColor;
  if (theme?.textColor) vars["--color-text"] = theme.textColor;
  if (theme?.headingFont) {
    vars["--font-heading"] = theme.headingFont;
    vars["--font-narrator"] = theme.headingFont;
  }
  if (theme?.bodyFont) vars["--font-body"] = theme.bodyFont;
  if (theme?.navBackground) vars["--color-nav-bg"] = theme.navBackground;
  if (scene?.backgroundImage) vars["--stage-bg-image"] = `url(${scene.backgroundImage})`;
  return vars as React.CSSProperties;
}

export function PlayApp() {
  const {
    loadStoryPackages,
    storyPackages,
    start,
    gameState,
    sessionId,
    characters,
    continueStory,
    isSending,
    isAutoPlaying,
    setAutoPlay,
    editingPackageId,
    error,
    saves,
    loadSaves,
    saveCurrentSession,
    loadSavedSession,
    deleteSavedSession
  } = useGameStore();

  const [showRules, setShowRules] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const storyPackage = storyPackages.find((p) => p.id === editingPackageId);
  const labels = useLabels();
  const uiConfig = storyPackage?.uiConfig;
  const showCharacterPanel = uiConfig?.layout?.showCharacterPanel !== false;
  const showQuickActions = uiConfig?.layout?.showQuickActions !== false;
  const showAutoPlay = uiConfig?.layout?.showAutoPlay !== false;

  useEffect(() => {
    void loadStoryPackages();
  }, [loadStoryPackages]);

  useEffect(() => {
    if (sessionId || storyPackages.length === 0) return;
    void start(storyPackages[0].id);
  }, [sessionId, start, storyPackages]);

  useEffect(() => {
    if (!isAutoPlaying || isSending || gameState?.status === "completed") return;
    const timer = window.setTimeout(() => {
      void continueStory();
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [continueStory, gameState?.round, gameState?.status, isAutoPlaying, isSending]);

  const isCompleted = gameState?.status === "completed";

  const pluginManifest = storyPackage?.pluginManifest ?? null;

  useCustomFonts(pluginManifest, editingPackageId ?? null);
  useCustomCss(pluginManifest, editingPackageId ?? null);

  return (
    <StoryAssetsProvider packageId={editingPackageId ?? null} manifest={pluginManifest}>
    <AudioManagerProvider
      packageId={editingPackageId ?? null}
      manifest={pluginManifest}
      currentStage={gameState?.scenario?.currentStage}
    >
    <StoryPerformanceRuntime />
    <UiConfigContext.Provider value={uiConfig ?? {} as UiConfig}>
      <main className="play-shell" style={themeVars(uiConfig)} data-story-plugin={editingPackageId ?? ""}>
        <aside className="play-nav" aria-label="主导航">
          <div className="window-dots" aria-hidden="true"><span /><span /><span /></div>
          <p className="nav-section-title">故事包</p>
          <div className="nav-packages">
            {storyPackages.map((pkg) => (
              <button
                key={pkg.id}
                className={`nav-package-item ${editingPackageId === pkg.id ? "active" : ""}`}
                onClick={() => { if (editingPackageId !== pkg.id) void start(pkg.id); }}
                title={pkg.title}
              >
                <span className="nav-package-title">{pkg.title}</span>
                {pkg.thumbnail ? (
                  <img className="nav-package-thumb" src={`${pkg.thumbnail}?t=${pkg.updatedAt ?? Date.now()}`} alt="" />
                ) : (
                  <span className="nav-package-thumb placeholder" aria-hidden="true">{pkg.title.charAt(0)}</span>
                )}
              </button>
            ))}
          </div>
          <div className="nav-divider" />
          <a className="nav-settings-btn" href="/admin/story-packages" title="后台管理">
            <Settings size={20} />
            <span>后台管理</span>
          </a>
        </aside>

        <section className="play-main">
          <header className="play-topbar">
            <div className="play-topbar-left">
              <p className="play-kicker">{labels.interactiveStory}</p>
              <h1>{gameState?.scenario.title ?? "正在载入故事"}</h1>
            </div>
            <div className="play-toolbar">
              <span className={`status-badge ${isCompleted ? "completed" : ""}`}>
                {isCompleted ? labels.statusCompleted : `${labels.round} ${gameState?.round ?? 0}`}
              </span>
              <button className="paper-icon" onClick={() => setShowRules(true)} aria-label="查看规则" title="查看规则">
                <CircleHelp size={18} />
              </button>
              {editingPackageId ? (
                <button className="paper-icon" onClick={() => void start(editingPackageId)} aria-label="重置剧情" title="重置剧情">
                  <RefreshCw size={18} />
                </button>
              ) : null}
              <button className="paper-button" onClick={() => setShowSaveModal(true)}><Save size={16} /> 保存进度</button>
              <button className="paper-button" onClick={() => { if (editingPackageId) { loadSaves(editingPackageId); setShowLoadModal(true); } }}><FolderOpen size={16} /> 载入进度</button>
              <div className="more-menu-wrap">
                <button className="paper-icon" aria-label="更多" title="更多操作" onClick={() => setShowMoreMenu(!showMoreMenu)}>
                  <MoreVertical size={18} />
                </button>
                {showMoreMenu && (
                  <div className="more-menu" onClick={() => setShowMoreMenu(false)}>
                    <a href="/admin/story-packages">{labels.storyManagement}</a>
                    <button onClick={() => { setShowRules(true); setShowMoreMenu(false); }}>{labels.viewRules}</button>
                    {editingPackageId ? (
                      <button onClick={() => { void start(editingPackageId); setShowMoreMenu(false); }}>重置剧情</button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </header>

          {error ? <p className="error-banner play-error">{error}</p> : null}

          <section className="play-board" style={{
            gridTemplateColumns: showCharacterPanel ? undefined : "minmax(0, 1fr)"
          }}>
            {showCharacterPanel && (
              <CharacterRail
                characters={characters}
                states={gameState?.characters ?? []}
                lastSpeakerId={gameState?.lastSpeakerId ?? null}
                initialStates={gameState?.scenario?.initialStates}
              />
            )}

            <section className="story-stage" aria-label="故事互动区">
              <MessageList characters={characters} />
              <div className="play-composer-shell">
                <div className="quick-actions">
                  {showQuickActions && (
                    <button className="btn-continue" onClick={() => void continueStory()} disabled={isSending || !sessionId}>
                      <ScrollText size={17} /> {labels.continue}
                    </button>
                  )}
                  {showAutoPlay && (
                    <button className={`btn-auto ${isAutoPlaying ? "active" : ""}`} onClick={() => setAutoPlay(!isAutoPlaying)} disabled={!sessionId}>
                      <RotateCcw size={17} /> {labels.autoPlay}
                    </button>
                  )}
                </div>
                <Composer icon={<Send size={19} />} />
              </div>
            </section>
          </section>
        </section>

        {showRules && (
          <div className="rules-overlay" onClick={() => setShowRules(false)}>
            <div className="rules-panel" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ margin: 0, border: "none", padding: 0 }}>{labels.rules}</h2>
                <button className="paper-icon" onClick={() => setShowRules(false)} aria-label="关闭"><X size={20} /></button>
              </div>
              <h3>{labels.scenarioRules}</h3>
              {(gameState?.scenario?.rules ?? []).map((rule, i) => (
                <p key={i} className="rule-line">{i + 1}. {rule}</p>
              ))}
              {storyPackage?.promptRules?.filter((r) => r.enabled).length ? (
                <>
                  <h3>{labels.promptRules}</h3>
                  {storyPackage.promptRules.filter((r) => r.enabled).map((rule) => (
                    <div key={rule.id} style={{ marginBottom: 12 }}>
                      <strong>{rule.title}</strong>
                      <p className="muted" style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{rule.content}</p>
                    </div>
                  ))}
                </>
              ) : null}
              <h3>{labels.currentStatus}</h3>
              <p className="rule-line">{labels.round}: {gameState?.round ?? 0}</p>
              <p className="rule-line">{labels.currentStage}: {gameState?.scenario?.currentStage ?? "无"}</p>
              <p className="rule-line">状态: {isCompleted ? labels.statusCompleted : labels.statusActive}</p>
            </div>
          </div>
        )}

        {showSaveModal && (
          <div className="rules-overlay" onClick={() => setShowSaveModal(false)}>
            <div className="rules-panel" onClick={(e) => e.stopPropagation()}>
              <h2>保存进度</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label className="field-title">
                  存档名称
                  <input className="field-input" value={saveLabel} onChange={(e) => setSaveLabel(e.target.value)}
                    placeholder={new Date().toLocaleString("zh-CN")} />
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { void saveCurrentSession(saveLabel || new Date().toLocaleString("zh-CN")); setShowSaveModal(false); setSaveLabel(""); }}>
                    保存
                  </button>
                  <button className="ghost-button" onClick={() => setShowSaveModal(false)}>取消</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showLoadModal && (
          <div className="rules-overlay" onClick={() => setShowLoadModal(false)}>
            <div className="rules-panel" onClick={(e) => e.stopPropagation()}>
              <h2>载入进度</h2>
              {saves.length === 0 ? (
                <p className="muted">暂无存档</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {saves.map((save) => (
                    <div key={save.sessionId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <div>
                        <strong>{save.label}</strong>
                        <p className="muted" style={{ margin: 0 }}>回合 {save.round} · {save.messageCount} 条消息 · {save.status === "completed" ? "已结束" : "进行中"}</p>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => { void loadSavedSession(editingPackageId!, save.sessionId); setShowLoadModal(false); }}>载入</button>
                        <button className="danger-button" onClick={() => { void deleteSavedSession(editingPackageId!, save.sessionId); }}>删除</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button className="ghost-button" style={{ marginTop: 12 }} onClick={() => setShowLoadModal(false)}>关闭</button>
            </div>
          </div>
        )}
      </main>
    </UiConfigContext.Provider>
    </AudioManagerProvider>
    </StoryAssetsProvider>
  );
}
