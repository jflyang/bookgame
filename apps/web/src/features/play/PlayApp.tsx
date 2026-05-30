import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, ChevronsLeft, ChevronsRight, CircleHelp, Eye, EyeOff, FolderOpen, MoreVertical, Play, RefreshCw, RotateCcw, Save, ScrollText, Send, Settings, Users, X } from "lucide-react";
import { CharacterRail } from "./components/CharacterRail.js";
import { Composer } from "./components/Composer.js";
import { MessageList } from "./components/MessageList.js";
import { SaveLoadOverlay } from "./components/SaveLoadOverlay.js";
import { StageJumpModal } from "./components/StageJumpModal.js";
import { TtsToggle } from "./components/TtsToggle.js";
import UiConfigContext, { useLabels, useUiConfig } from "./UiConfigContext.js";
import { StoryAssetsProvider } from "./contexts/StoryAssetsContext.js";
import { AudioManagerProvider, useAudio } from "./contexts/AudioManager.js";
import { StoryPerformanceRuntime } from "./performances/StoryPerformanceRuntime.js";
import { useCustomFonts } from "./hooks/useCustomFonts.js";
import { useCustomCss } from "./hooks/useCustomCss.js";
import type { UiConfig } from "@story-game/shared";
import { useGameStore } from "../../store/gameStore.js";
import * as gameApi from "../../lib/gameApi.js";
import { useAudioStore } from "../../store/audioStore.js";
import { unlockAudio } from "../../lib/audioUnlock.js";

/** Audio mute toggle — must be rendered inside AudioManagerProvider */
function AudioMuteMenuItem({ onDone }: { onDone: () => void }) {
  const { muted, setMuted } = useAudio();
  return (
    <button onClick={() => { setMuted(!muted); onDone(); }}>
      {muted ? "🔇 音效关闭" : "🔊 音效开启"}
    </button>
  );
}

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
  const [showStageJump, setShowStageJump] = useState(false);
  const [navExpanded, setNavExpanded] = useState(false);
  const [performanceEnabled, setPerformanceEnabled] = useState(() => localStorage.getItem("play:performanceEnabled") !== "false");
  const [animationEnabled, setAnimationEnabled] = useState(() => localStorage.getItem("play:animationEnabled") !== "false");

  /* ── Mobile state ── */
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= 768);
  const [mobileActiveTab, setMobileActiveTab] = useState<"story" | "characters" | "saves" | "more">("story");
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [showCharacterSheet, setShowCharacterSheet] = useState(false);
  const [immersiveMode, setImmersiveMode] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* ── Mobile tab actions ── */
  const handleMobileTab = useCallback((tab: "story" | "characters" | "saves" | "more") => {
    setMobileActiveTab(tab);
    switch (tab) {
      case "story":
        setShowCharacterSheet(false);
        setImmersiveMode(false);
        break;
      case "characters":
        setShowCharacterSheet(true);
        break;
      case "saves":
        if (editingPackageId) {
          loadSaves(editingPackageId);
          setShowSaveModal(true);
        }
        break;
      case "more":
        setShowMoreMenu(true);
        break;
    }
  }, [editingPackageId, loadSaves]);

  /* Toggle immersive reading mode */
  const toggleImmersive = useCallback(() => {
    setImmersiveMode((prev) => !prev);
  }, []);

  /* Double-tap story area for immersive mode */
  const handleStoryDoubleTap = useCallback(() => {
    if (isMobile) toggleImmersive();
  }, [isMobile, toggleImmersive]);
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

  // Auto-continue story
  const ttsAutoPlay = useAudioStore((s) => s.autoPlay);
  const ttsAutoReadDone = useAudioStore((s) => s.autoReadDone);
  const ttsEnabled = useAudioStore((s) => s.ttsEnabled);
  const autoContinueCount = useRef(0);
  const AUTO_CONTINUE_LIMIT = 20;

  // Reset counter when user manually toggles auto-play
  useEffect(() => {
    if (isAutoPlaying) {
      autoContinueCount.current = 0;
    }
  }, [isAutoPlaying]);

  useEffect(() => {
    if (!isAutoPlaying || isSending || gameState?.status === "completed") return;
    // Stop if exceeded limit
    if (autoContinueCount.current >= AUTO_CONTINUE_LIMIT) {
      setAutoPlay(false);
      return;
    }
    // Only block auto-continue if TTS is actually enabled AND auto-play is on AND reading not done
    const ttsBlocking = ttsAutoPlay && ttsEnabled && !ttsAutoReadDone;
    if (ttsBlocking) {
      // Safety: if TTS blocks auto-continue for >30s, force release
      const safetyTimer = window.setTimeout(() => {
        useAudioStore.getState().setAutoReadDone(true);
      }, 30_000);
      return () => window.clearTimeout(safetyTimer);
    }
    const delay = (ttsAutoPlay && ttsEnabled) ? 1000 : 3000;
    const timer = window.setTimeout(() => {
      autoContinueCount.current += 1;
      void continueStory();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [continueStory, gameState?.round, gameState?.status, isAutoPlaying, isSending, setAutoPlay, ttsAutoPlay, ttsAutoReadDone, ttsEnabled]);

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
      <main className={`play-shell${immersiveMode ? " immersive" : ""}`} style={themeVars(uiConfig)} data-story-plugin={editingPackageId ?? ""}>

        {/* ═══ Mobile: Story Selection Screen (when no session) ═══ */}
        {isMobile && !sessionId && (
          <div className="mobile-story-picker">
            <div className="mobile-story-picker-header">
              <h1>📖 选择故事</h1>
              <p>挑一个世界，开始冒险</p>
            </div>
            <div className="mobile-story-picker-grid">
              {storyPackages.length === 0 && (
                <p className="mobile-story-picker-empty">暂无故事包，请先在后台管理中导入</p>
              )}
              {storyPackages.map((pkg) => (
                <button
                  key={pkg.id}
                  className="mobile-story-card"
                  onClick={() => { void start(pkg.id); }}
                >
                  {pkg.thumbnail ? (
                    <img className="mobile-story-card-thumb" src={`${pkg.thumbnail}?t=${pkg.updatedAt ?? Date.now()}`} alt="" />
                  ) : (
                    <span className="mobile-story-card-thumb placeholder">{pkg.title.charAt(0)}</span>
                  )}
                  <span className="mobile-story-card-title">{pkg.title}</span>
                  {pkg.description ? (
                    <span className="mobile-story-card-desc">{pkg.description}</span>
                  ) : null}
                </button>
              ))}
            </div>
            <div className="mobile-story-picker-footer">
              <a href="/admin/story-packages" className="mobile-story-picker-admin">
                <Settings size={18} /> 后台管理
              </a>
            </div>
          </div>
        )}
        {(!isMobile || sessionId) && (<>
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
              {isMobile && (
                <button className="mobile-menu-btn" onClick={() => setShowMobileDrawer(true)} aria-label="菜单">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                  </svg>
                </button>
              )}
              <p className="play-kicker">{labels.interactiveStory}</p>
              <h1>{gameState?.scenario.title ?? "正在载入故事"}</h1>
            </div>
            <div className="play-toolbar">
              <span className={`status-badge ${isCompleted ? "completed" : ""}`} onClick={() => !isCompleted && setShowStageJump(true)} style={{ cursor: isCompleted ? "default" : "pointer" }} title="点击跳转阶段">
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
              {isMobile && (
                <button className="paper-icon" onClick={toggleImmersive} aria-label={immersiveMode ? "退出阅读模式" : "沉浸阅读"} title={immersiveMode ? "退出阅读模式" : "沉浸阅读"}>
                  {immersiveMode ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              )}
              <div className="more-menu-wrap">
                <button className="paper-icon" aria-label="更多" title="更多操作" onClick={() => setShowMoreMenu(!showMoreMenu)}>
                  <MoreVertical size={18} />
                </button>
                {showMoreMenu && (
                  <div className="more-menu" onClick={() => setShowMoreMenu(false)}>
                    <a href="/admin/story-packages">{labels.storyManagement}</a>
                    <button onClick={() => { setShowRules(true); setShowMoreMenu(false); }}>{labels.viewRules}</button>
                    <button onClick={() => { const next = !performanceEnabled; setPerformanceEnabled(next); localStorage.setItem("play:performanceEnabled", String(next)); setShowMoreMenu(false); }}>
                      {performanceEnabled ? "🎭 表演开启" : "🚫 表演关闭"}
                    </button>
                    <button onClick={() => { const next = !animationEnabled; setAnimationEnabled(next); localStorage.setItem("play:animationEnabled", String(next)); setShowMoreMenu(false); }}>
                      {animationEnabled ? "✨ 动画开启" : "🚫 动画关闭"}
                    </button>
                    <button onClick={() => { const current = localStorage.getItem("play:showAudioPulse") !== "false"; localStorage.setItem("play:showAudioPulse", String(!current)); setShowMoreMenu(false); }}>
                      {localStorage.getItem("play:showAudioPulse") !== "false" ? "💬 招式闪字开启" : "🚫 招式闪字关闭"}
                    </button>
                    <AudioMuteMenuItem onDone={() => setShowMoreMenu(false)} />
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

            <section
              className="story-stage"
              aria-label="故事互动区"
            >
              <MessageList characters={characters} />
              <div className="play-composer-shell">
                <div className="quick-actions">
                  {showQuickActions && (
                    <button className="btn-continue" onClick={() => void continueStory()} disabled={isSending || !sessionId || isCompleted} title={isCompleted ? "故事已结束" : labels.continue}>
                      <ScrollText size={17} />
                    </button>
                  )}
                  {showAutoPlay && (
                    <button className={`btn-auto ${isAutoPlaying ? "active" : ""}`} onClick={() => setAutoPlay(!isAutoPlaying)} disabled={!sessionId || isCompleted}>
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
            storyPackageId={editingPackageId ?? undefined}
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
            storyPackageId={editingPackageId ?? undefined}
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

        {showStageJump && gameState && sessionId && (
          <StageJumpModal
            gameState={gameState}
            onJump={async (stageId) => {
              try {
                const result = await gameApi.jumpToStage(sessionId, stageId);
                useGameStore.setState({ gameState: result.gameState });
              } catch (err) {
                console.error("Stage jump failed:", err);
              }
              setShowStageJump(false);
            }}
            onClose={() => setShowStageJump(false)}
          />
        )}

        {/* ═══ Mobile: Hamburger Drawer ═══ */}
        {isMobile && showMobileDrawer && (
          <>
            <div className="mobile-drawer-overlay" onClick={() => setShowMobileDrawer(false)} />
            <aside className="mobile-drawer">
              <div className="mobile-drawer-header">
                <h2>故事包</h2>
                <button className="mobile-drawer-close" onClick={() => setShowMobileDrawer(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="mobile-drawer-list">
                {storyPackages.map((pkg) => (
                  <button
                    key={pkg.id}
                    className={`mobile-drawer-item${editingPackageId === pkg.id ? " active" : ""}`}
                    onClick={() => {
                      if (editingPackageId !== pkg.id) void start(pkg.id);
                      setShowMobileDrawer(false);
                    }}
                  >
                    {pkg.thumbnail ? (
                      <img className="mobile-drawer-thumb" src={`${pkg.thumbnail}?t=${pkg.updatedAt ?? Date.now()}`} alt="" />
                    ) : (
                      <span className="mobile-drawer-thumb-placeholder">{pkg.title.charAt(0)}</span>
                    )}
                    <span className="mobile-drawer-item-title">{pkg.title}</span>
                  </button>
                ))}
              </div>
              <div className="mobile-drawer-footer">
                <a href="/admin/story-packages">
                  <Settings size={18} /> 后台管理
                </a>
              </div>
            </aside>
          </>
        )}

        {/* ═══ Mobile: Character Bottom Sheet ═══ */}
        {isMobile && showCharacterSheet && (() => {
          const initialStates = gameState?.scenario?.initialStates;
          const states = gameState?.characters ?? [];
          const selectedId = useGameStore.getState().selectedCharacterId;
          const selectCharacter = useGameStore.getState().selectCharacter;
          const getMaxHp = (characterId: string) => initialStates?.find((s) => s.characterId === characterId)?.hp ?? 100;
          const getMaxMp = (characterId: string) => initialStates?.find((s) => s.characterId === characterId)?.mp ?? 100;
          return (
          <>
            <div className="mobile-sheet-overlay" onClick={() => setShowCharacterSheet(false)} />
            <div className="mobile-sheet">
              <div className="mobile-sheet-handle" />
              <div className="mobile-sheet-header">
                <h2>角色</h2>
                <button className="mobile-drawer-close" onClick={() => setShowCharacterSheet(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="mobile-sheet-body">
                <div className="character-list">
                  {characters.map((ch) => {
                    const state = states.find((s) => s.characterId === ch.id);
                    const isSelected = selectedId === ch.id;
                    const isLastSpeaker = gameState?.lastSpeakerId === ch.id;
                    const maxHp = getMaxHp(ch.id);
                    const maxMp = getMaxMp(ch.id);
                    return (
                      <button
                        key={ch.id}
                        className={`character-card${isSelected ? " selected" : ""}${isLastSpeaker && !isSelected ? " last-speaker" : ""}`}
                        onClick={() => { selectCharacter(isSelected ? null : ch.id); }}
                      >
                        <div className="character-card-header">
                          <span className={`portrait-avatar text-avatar avatar-${ch.id}`}>{ch.avatar || ch.name.charAt(0)}</span>
                          <div className="character-card-info">
                            <span className="character-name">{ch.name}</span>
                            <span className="character-role">{ch.role}{isLastSpeaker ? " · 最后发言" : ""}</span>
                          </div>
                        </div>
                        {state && (
                          <div className="character-card-stats">
                            <div className="stat-line">
                              <span className="stat-label">HP</span>
                              <div className="stat-bar-track"><div className="stat-bar-fill hp" style={{ width: `${maxHp > 0 ? Math.min(100, Math.round(((state.hp) / maxHp) * 100)) : 0}%` }} /></div>
                              <span className="stat-value">{state.hp}/{maxHp}</span>
                            </div>
                            <div className="stat-line">
                              <span className="stat-label">MP</span>
                              <div className="stat-bar-track"><div className="stat-bar-fill mp" style={{ width: `${maxMp > 0 ? Math.min(100, Math.round(((state.mp) / maxMp) * 100)) : 0}%` }} /></div>
                              <span className="stat-value">{state.mp}/{maxMp}</span>
                            </div>
                          </div>
                        )}
                        {state?.conditions && state.conditions.length > 0 && (
                          <div className="condition-tags">
                            {state.conditions.map((cond, i) => (
                              <span key={i} className="condition-tag">{cond}</span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
          );
        })()}

        {/* ═══ Mobile: Bottom Tab Bar ═══ */}
        {isMobile && (
          <nav className="mobile-tab-bar">
            <button className={`mobile-tab${mobileActiveTab === "story" ? " active" : ""}`} onClick={() => handleMobileTab("story")}>
              <BookOpen size={22} />
              <span>故事</span>
              <span className="tab-dot" />
            </button>
            <button className={`mobile-tab${mobileActiveTab === "characters" ? " active" : ""}`} onClick={() => handleMobileTab("characters")}>
              <Users size={22} />
              <span>角色</span>
              <span className="tab-dot" />
            </button>
            <button className={`mobile-tab${showSaveModal ? " active" : ""}`} onClick={() => handleMobileTab("saves")}>
              <Save size={22} />
              <span>存档</span>
              <span className="tab-dot" />
            </button>
            <button className={`mobile-tab${mobileActiveTab === "more" ? " active" : ""}`} onClick={() => handleMobileTab("more")}>
              <MoreVertical size={22} />
              <span>更多</span>
              <span className="tab-dot" />
            </button>
          </nav>
        )}

        {/* ═══ Mobile: Floating Action Buttons ═══ */}
        {isMobile && sessionId && !immersiveMode && (
          <div className="mobile-fab-group">
            {!isCompleted && (
              <button
                className={`mobile-fab primary${isAutoPlaying ? " auto-active" : ""}`}
                onClick={() => { void continueStory(); }}
                disabled={isSending}
                aria-label={isAutoPlaying ? "自动进行中" : "继续故事"}
                title={isAutoPlaying ? "自动进行中" : "继续故事"}
              >
                {isAutoPlaying ? <RotateCcw size={22} /> : <Play size={22} />}
              </button>
            )}
            <button
              className={`mobile-fab${isAutoPlaying ? " auto-active" : ""}`}
              onClick={() => setAutoPlay(!isAutoPlaying)}
              disabled={isCompleted}
              aria-label={isAutoPlaying ? "停止自动" : "自动播放"}
              title={isAutoPlaying ? "停止自动" : "自动播放"}
            >
              {isAutoPlaying ? <X size={18} /> : <ScrollText size={18} />}
            </button>
            <TtsToggle />
          </div>
        )}

        {/* ═══ Mobile: Immersive Exit Button ═══ */}
        {isMobile && immersiveMode && (
          <button className="immersive-exit-btn" onClick={toggleImmersive} aria-label="退出沉浸阅读">
            <EyeOff size={18} />
          </button>
        )}
        </>
        )}{/* close conditional: !isMobile || sessionId */}
      </main>
    </UiConfigContext.Provider>
    </AudioManagerProvider>
    </StoryAssetsProvider>
  );
}
