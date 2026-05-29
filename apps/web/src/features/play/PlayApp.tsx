import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight, CircleHelp, FolderOpen, MoreVertical, RefreshCw, RotateCcw, Save, ScrollText, Send, Settings, X } from "lucide-react";
import { CharacterRail } from "./components/CharacterRail.js";
import { Composer } from "./components/Composer.js";
import { MessageList } from "./components/MessageList.js";
import { SaveLoadOverlay } from "./components/SaveLoadOverlay.js";
import { TtsToggle } from "./components/TtsToggle.js";
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
    saveSlots,
    loadSaves,
    saveCurrentSession,
    loadSavedSession,
    loadSavedSessionBySlot,
    deleteSavedSession
  } = useGameStore();

  const [showRules, setShowRules] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [navExpanded, setNavExpanded] = useState(false);
  const [performanceEnabled, setPerformanceEnabled] = useState(true);
  const [animationEnabled, setAnimationEnabled] = useState(true);
  const storyPackage = storyPackages.find((p) => p.id === editingPackageId);
  const labels = useLabels();
  const uiConfig = storyPackage?.uiConfig;
  const showCharacterPanel = uiConfig?.layout?.showCharacterPanel !== false;
  const showQuickActions = uiConfig?.layout?.showQuickActions !== false;
  const showAutoPlay = uiConfig?.layout?.showAutoPlay !== false;

  useEffect(() => {
    void loadStoryPackages();
  }, [loadStoryPackages]);

  // Auto-save on refresh/close (best-effort via sendBeacon)
  useEffect(() => {
    const handleUnload = () => {
      if (sessionId && editingPackageId) {
        const now = new Date().toLocaleString("zh-CN");
        sessionStorage.setItem("auto-save-sessionId", sessionId);
        sessionStorage.setItem("auto-save-packageId", editingPackageId);
        sessionStorage.setItem("auto-save-label", now + " " + stageDisplayName());
        // fire-and-forget — if it fails, auto-restore will fall back gracefully
        navigator.sendBeacon?.(
          `${window.location.origin}/api/admin/story-packages/${editingPackageId}/saves`,
          new Blob([JSON.stringify({ sessionId, label: now + " " + stageDisplayName(), slot: 1 })], { type: "application/json" })
        );
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [sessionId, editingPackageId]); // eslint-disable-line

  // Auto-restore on load
  useEffect(() => {
    if (sessionId || storyPackages.length === 0) return;
    const savedSessionId = sessionStorage.getItem("auto-save-sessionId");
    const savedPackageId = sessionStorage.getItem("auto-save-packageId");
    if (savedSessionId && savedPackageId) {
      loadSaves(savedPackageId).then(() => {
        const slots = useGameStore.getState().saveSlots;
        const match = slots.find((s) => s.save?.sessionId === savedSessionId);
        if (match) {
          void loadSavedSessionBySlot(savedPackageId, match.slot);
        } else {
          void start(savedPackageId);
        }
      }).catch(() => {
        // loadSaves failed (network error etc.) — clear stale markers and start fresh
        void start(savedPackageId);
      }).finally(() => {
        sessionStorage.removeItem("auto-save-sessionId");
        sessionStorage.removeItem("auto-save-packageId");
        sessionStorage.removeItem("auto-save-label");
      });
    } else {
      const lastId = sessionStorage.getItem("last-packageId");
      const targetId = lastId && storyPackages.some((p) => p.id === lastId) ? lastId : storyPackages[0]?.id;
      if (targetId) void start(targetId);
    }
  }, [sessionId, start, storyPackages]); // eslint-disable-line

  useEffect(() => {
    if (!isAutoPlaying || isSending || gameState?.status === "completed") return;
    const timer = window.setTimeout(() => {
      void continueStory();
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [continueStory, gameState?.round, gameState?.status, isAutoPlaying, isSending]);

  const isCompleted = gameState?.status === "completed";

  function stageDisplayName() {
    const stage = gameState?.scenario?.currentStage;
    if (!stage) return "";
    const detail = gameState?.scenario?.stageDetails?.find((s) => s.id === stage);
    return detail?.title || stage;
  }

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
    <StoryPerformanceRuntime enabled={performanceEnabled} animationEnabled={animationEnabled} />
    <UiConfigContext.Provider value={uiConfig ?? {} as UiConfig}>
      <main className="play-shell" style={themeVars(uiConfig)} data-story-plugin={editingPackageId ?? ""}>
        <aside className={`play-nav ${navExpanded ? "expanded" : ""}`} aria-label="主导航">
          <button className="nav-toggle" onClick={() => setNavExpanded(!navExpanded)} title={navExpanded ? "收起" : "展开"}>
            {navExpanded ? <ChevronsLeft size={20} /> : <ChevronsRight size={20} />}
          </button>
          {navExpanded && <p className="nav-section-title">故事包</p>}
          {navExpanded && <div className="nav-packages">
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
          </div>}
          {navExpanded && <div className="nav-divider" />}
          {navExpanded && <a className="nav-settings-btn" href="/admin/story-packages" title="后台管理">
            <Settings size={20} />
            <span>后台管理</span>
          </a>}
        </aside>

        <section className="play-main">
          <header className="play-topbar">
            <div className="play-topbar-left">
              <p className="play-kicker">{labels.interactiveStory}</p>
              <h1>{gameState?.scenario.title ?? "正在载入故事"}</h1>
            </div>
            <div className="play-toolbar">
              <span className={`status-badge ${isCompleted ? "completed" : ""}`}>
                {isCompleted ? labels.statusCompleted : `${labels.round} ${gameState?.round ?? 0} · ${stageDisplayName()}`}
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
                    <button onClick={(e) => { setPerformanceEnabled(!performanceEnabled); setShowMoreMenu(false); }}>
                      {performanceEnabled ? "表演开启" : "表演关闭"}
                    </button>
                    <button onClick={(e) => { setAnimationEnabled(!animationEnabled); setShowMoreMenu(false); }}>
                      {animationEnabled ? "动画开启" : "动画关闭"}
                    </button>
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
                    <button className="btn-continue" onClick={() => void continueStory()} disabled={isSending || !sessionId} title={labels.continue}>
                      <ScrollText size={17} />
                    </button>
                  )}
                  {showAutoPlay && (
                    <button className={`btn-auto ${isAutoPlaying ? "active" : ""}`} onClick={() => setAutoPlay(!isAutoPlaying)} disabled={!sessionId}>
                      <RotateCcw size={17} /> {labels.autoPlay}
                    </button>
                  )}
                  <TtsToggle />
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
          <SaveLoadOverlay
            mode="save"
            title="保存进度"
            saveSlots={saveSlots}
            storyPackage={storyPackage}
            stageName={stageDisplayName()}
            gameRound={gameState?.round ?? 0}
            messageCount={useGameStore.getState().messages.length}
            onSave={(slot) => {
              const label = new Date().toLocaleString("zh-CN") + " " + stageDisplayName();
              void saveCurrentSession(label, slot);
              setShowSaveModal(false);
            }}
            onClose={() => setShowSaveModal(false)}
          />
        )}

        {showLoadModal && (
          <SaveLoadOverlay
            mode="load"
            title="载入进度"
            saveSlots={saveSlots}
            storyPackage={storyPackage}
            stageName={stageDisplayName()}
            gameRound={gameState?.round ?? 0}
            messageCount={useGameStore.getState().messages.length}
            onLoadBySlot={(slot) => {
              void loadSavedSessionBySlot(editingPackageId!, slot);
              setShowLoadModal(false);
            }}
            onDelete={(saveId, slot) => {
              void deleteSavedSession(editingPackageId!, saveId, slot);
            }}
            onClose={() => setShowLoadModal(false)}
          />
        )}
      </main>
    </UiConfigContext.Provider>
    </AudioManagerProvider>
    </StoryAssetsProvider>
  );
}
