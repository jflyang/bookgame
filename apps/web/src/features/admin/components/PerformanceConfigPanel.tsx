import { useMemo, useRef, useState } from "react";
import { Film, Image, Music, Pause, Pencil, Play, Plus, Save, Trash2, Upload, Video, X } from "lucide-react";
import { pinyin } from "pinyin-pro";
import type { StoryPackage, StoryPerformanceDefinition, StoryPluginManifest } from "@story-game/shared";
import { useGameStore } from "../../../store/gameStore.js";
import { uploadPerformanceAudio, uploadPerformanceImage, uploadPerformanceVideo } from "../../../lib/adminApi.js";

type PerfRenderer = "audio" | "image" | "video" | "layeredCss" | "none";
type PerfTriggerType = "knowledgeUse" | "firstAppearance" | "stageEnter";

const RENDERER_LABELS: Record<PerfRenderer, string> = {
  audio: "声音", image: "图片", video: "视频", layeredCss: "CSS图层", none: "仅记账",
};
const RENDERER_ICONS: Record<PerfRenderer, typeof Music> = {
  audio: Music, image: Image, video: Video, layeredCss: Film, none: Film,
};
const TRIGGER_LABELS: Record<PerfTriggerType, string> = {
  knowledgeUse: "知识库命中", firstAppearance: "首次出场", stageEnter: "阶段进入",
};

interface PerfAssetFile {
  role: string;  // "webm" | "mp4" | "poster" | "bg" | "main" | "fallback"
  label: string;
  acceptExts: string;
  acceptMimes: string;
}

interface PerformanceDraft {
  id: string;
  name: string;
  renderer: PerfRenderer;
  triggerType: PerfTriggerType;
  characterId: string;
  stageId: string;
  knowledgeTitle: string;
  keywordsText: string;
  durationMs: number;
  playOnce: "session" | "story" | "never";
  containsAudio: boolean;
  // Multi-asset paths (role → path)
  assets: Record<string, string>;
}

export function PerformanceConfigPanel() {
  const { editingPackageId, storyPackages, saveStoryPackage } = useGameStore();
  const storyPackage = useMemo(
    () => storyPackages.find((item) => item.id === editingPackageId) ?? null,
    [editingPackageId, storyPackages]
  );
  const [draft, setDraft] = useState<PerformanceDraft>(() => makeEmptyDraft(storyPackage));
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [activeAssetRole, setActiveAssetRole] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const userEditedId = useRef(false);

  if (!storyPackage || !editingPackageId) return null;

  const pkg = storyPackage;
  const performances = pkg.pluginManifest?.performances ?? {};

  function resetDraft() {
    setDraft(makeEmptyDraft(pkg));
    setDragOver(false);
    setActiveAssetRole("");
    setEditingId(null);
    userEditedId.current = false;
  }

  function startEdit(id: string, perf: StoryPerformanceDefinition) {
    const trigger = perf.trigger;
    setDraft({
      id,
      name: perf.name,
      renderer: perf.renderer === "none" ? "none" : (perf.renderer as PerfRenderer),
      triggerType: (trigger.type as PerfTriggerType) ?? "firstAppearance",
      characterId: trigger.characterId ?? "",
      stageId: trigger.stageId ?? "",
      knowledgeTitle: trigger.knowledgeTitle ?? "",
      keywordsText: (trigger.keywords ?? []).join("、"),
      durationMs: perf.durationMs,
      playOnce: perf.playOnce,
      containsAudio: perf.video?.containsAudio ?? true,
      assets: {
        ...(perf.video?.webm ? { webm: perf.video.webm } : {}),
        ...(perf.video?.mp4 ? { mp4: perf.video.mp4 } : {}),
        ...(perf.video?.poster ? { poster: perf.video.poster } : {}),
        ...(perf.audio?.main ? { main: perf.audio.main } : {}),
        ...(perf.layers?.bg ? { bg: perf.layers.bg } : {}),
      },
    });
    setEditingId(id);
    setActiveAssetRole("");
    setDragOver(false);
    userEditedId.current = true;
  }

  function getAssetRoles(): PerfAssetFile[] {
    switch (draft.renderer) {
      case "video":
        return [
          { role: "webm", label: "WebM 视频", acceptExts: ".webm", acceptMimes: "video/webm" },
          { role: "mp4", label: "MP4 视频", acceptExts: ".mp4", acceptMimes: "video/mp4" },
          { role: "poster", label: "封面图", acceptExts: ".png,.jpg,.jpeg,.webp", acceptMimes: "image/png,image/jpeg,image/webp" },
        ];
      case "audio":
        return [{ role: "main", label: "音频文件", acceptExts: ".mp3,.ogg,.wav,.flac", acceptMimes: "audio/mpeg,audio/ogg,audio/wav,audio/flac" }];
      case "image":
        return [{ role: "bg", label: "图片文件", acceptExts: ".png,.jpg,.jpeg,.webp", acceptMimes: "image/png,image/jpeg,image/webp" }];
      case "layeredCss":
        return [{ role: "bg", label: "背景图", acceptExts: ".png,.jpg,.jpeg,.webp", acceptMimes: "image/png,image/jpeg,image/webp" }];
      default:
        return [];
    }
  }

  async function uploadAsset(file: File, role: string) {
    if (!file || !draft.id.trim()) return;
    setUploading(true);
    try {
      let fn;
      if (draft.renderer === "video") fn = uploadPerformanceVideo;
      else if (draft.renderer === "audio" || role === "main") fn = uploadPerformanceAudio;
      else fn = uploadPerformanceImage;
      const result = await fn(pkg.id, safeId(draft.id), file);
      setDraft((d) => ({ ...d, assets: { ...d.assets, [role]: result.path } }));
    } catch (err) {
      console.error("Failed to upload asset:", err);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && activeAssetRole) uploadAsset(file, activeAssetRole);
  }

  async function saveDraft() {
    const isEditing = editingId !== null;
    const baseId = isEditing ? editingId : (safeId(draft.id) || toPinyinId(draft.name));
    const performanceId = isEditing ? editingId : uniquePerformanceId(baseId, performances);
    const name = draft.name.trim();
    if (!performanceId || !name) {
      useGameStore.setState({ error: "请填写演出名称" });
      return;
    }

    const performance: StoryPerformanceDefinition = {
      name,
      renderer: draft.renderer === "none" ? "none" : draft.renderer,
      durationMs: clampDuration(draft.durationMs),
      trigger: buildTrigger(),
      playOnce: draft.playOnce,
      video: draft.renderer === "video" ? {
        webm: draft.assets.webm,
        mp4: draft.assets.mp4,
        poster: draft.assets.poster,
        containsAudio: draft.containsAudio,
      } : undefined,
      layers: draft.renderer === "image" ? { bg: draft.assets.bg ?? "" }
        : draft.renderer === "layeredCss" ? { bg: draft.assets.bg ?? "" }
        : {},
      audio: draft.renderer === "audio" ? { main: draft.assets.main ?? "" }
        : (draft.assets.main ? { main: draft.assets.main } : {}),
    };

    await saveStoryPackage({
      ...pkg,
      pluginManifest: withPerformance(pkg, performanceId, performance),
    });
    resetDraft();
  }

  function buildTrigger() {
    const t = draft.triggerType;
    return {
      type: t,
      characterId: draft.characterId || undefined,
      ...(t === "knowledgeUse" ? {
        knowledgeTitle: draft.knowledgeTitle.trim() || undefined,
        keywords: splitKeywords(draft.keywordsText),
        matchBoldOnly: true,
      } : {}),
      ...(t === "stageEnter" ? { stageId: draft.stageId || undefined } : {}),
    };
  }

  async function deletePerformance(id: string) {
    if (!confirm("确定删除这个演出配置吗？")) return;
    const next = { ...(pkg.pluginManifest?.performances ?? {}) };
    delete next[id];
    await saveStoryPackage({ ...pkg, pluginManifest: withPerformances(pkg, next) });
  }

  function getAssetUrl(relativePath: string) {
    if (!relativePath || !editingPackageId) return "";
    return `/api/story-assets/${editingPackageId}/${relativePath}`;
  }

  function getPerformanceAssetPath(perf: StoryPerformanceDefinition): string {
    if (perf.renderer === "audio") return perf.audio?.main ?? "";
    if (perf.renderer === "image") return perf.layers?.bg ?? "";
    if (perf.renderer === "video") return perf.video?.webm ?? perf.video?.mp4 ?? "";
    return "";
  }

  function toggleAudio(perfId: string, assetPath: string) {
    if (playingId === perfId) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(getAssetUrl(assetPath));
    audioRef.current = audio;
    audio.play().catch(() => {});
    setPlayingId(perfId);
    audio.addEventListener("ended", () => {
      audioRef.current = null;
      setPlayingId(null);
    });
  }

  const isUploadReady = draft.id.trim() !== "";
  const assetRoles = getAssetRoles();
  const allPerformances = Object.entries(performances);

  return (
    <div className="performance-config-panel">
      <section className="perf-form">
        <div className="perf-form-header">
          <Film size={18} />
          <div>
            <h3>{editingId ? `编辑演出 — ${draft.name || editingId}` : "演出配置"}</h3>
            {editingId && <small style={{ color: "var(--color-accent, #14b8a6)" }}>正在编辑已有演出，保存后覆盖原配置</small>}
          </div>
        </div>

        {/* Basic Info */}
        <fieldset className="perf-fieldset">
          <legend className="perf-legend">基本信息</legend>
          <div className="perf-row two-col">
            <label className="form-field">
              <span className="form-label">名称</span>
              <input className="form-input" value={draft.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setDraft((d) => ({ ...d, name, id: userEditedId.current ? d.id : toPinyinId(name) }));
                }}
                placeholder="飞龙在天" />
            </label>
            <label className="form-field">
              <span className="form-label">ID</span>
              <input className="form-input" value={draft.id}
                onChange={(e) => { userEditedId.current = true; setDraft({ ...draft, id: safeId(e.target.value) }); }}
                placeholder="自动生成" />
            </label>
          </div>

          <div className="perf-row two-col">
            <label className="form-field">
              <span className="form-label">渲染器</span>
              <select className="form-input" value={draft.renderer}
                onChange={(e) => setDraft({ ...draft, renderer: e.target.value as PerfRenderer, assets: {} })}>
                {(Object.keys(RENDERER_LABELS) as PerfRenderer[]).map((r) => (
                  <option key={r} value={r}>{RENDERER_LABELS[r]}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="form-label">触发器</span>
              <select className="form-input" value={draft.triggerType}
                onChange={(e) => setDraft({ ...draft, triggerType: e.target.value as PerfTriggerType })}>
                {(Object.keys(TRIGGER_LABELS) as PerfTriggerType[]).map((t) => (
                  <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="perf-row two-col">
            <label className="form-field">
              <span className="form-label">时长 (ms)</span>
              <input className="form-input" type="number" min={500} max={10000} step={100}
                value={draft.durationMs} onChange={(e) => setDraft({ ...draft, durationMs: Number(e.target.value) || 1500 })} />
            </label>
            <label className="form-field">
              <span className="form-label">播放频次</span>
              <select className="form-input" value={draft.playOnce}
                onChange={(e) => setDraft({ ...draft, playOnce: e.target.value as PerformanceDraft["playOnce"] })}>
                <option value="never">每次都播</option>
                <option value="session">每会话一次</option>
                <option value="story">每故事一次</option>
              </select>
            </label>
          </div>
        </fieldset>

        {/* Trigger Fields */}
        <fieldset className="perf-fieldset">
          <legend className="perf-legend">触发条件 — {TRIGGER_LABELS[draft.triggerType]}</legend>
          <div className="perf-row two-col">
            <label className="form-field">
              <span className="form-label">角色</span>
              <select className="form-input" value={draft.characterId}
                onChange={(e) => setDraft({ ...draft, characterId: e.target.value })}>
                <option value="">不限定</option>
                {pkg.characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            {draft.triggerType === "stageEnter" && (
              <label className="form-field">
                <span className="form-label">阶段</span>
                <select className="form-input" value={draft.stageId}
                  onChange={(e) => setDraft({ ...draft, stageId: e.target.value })}>
                  <option value="">选择阶段</option>
                  {pkg.scenario.stages.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            )}
          </div>
          {draft.triggerType === "knowledgeUse" && (
            <>
              <label className="form-field">
                <span className="form-label">知识库标题</span>
                <input className="form-input" value={draft.knowledgeTitle}
                  onChange={(e) => setDraft({ ...draft, knowledgeTitle: e.target.value })}
                  placeholder="降龙十八掌·飞龙在天" />
              </label>
              <label className="form-field">
                <span className="form-label">触发词（逗号分隔）</span>
                <input className="form-input" value={draft.keywordsText}
                  onChange={(e) => setDraft({ ...draft, keywordsText: e.target.value })}
                  placeholder="飞龙在天、降龙十八掌" />
              </label>
            </>
          )}
        </fieldset>

        {/* Assets */}
        {assetRoles.length > 0 && (
          <fieldset className="perf-fieldset">
            <legend className="perf-legend">资源文件 — {RENDERER_LABELS[draft.renderer]}</legend>
            {draft.renderer === "video" && (
              <label className="form-field" style={{ marginBottom: 12 }}>
                <span className="form-label">
                  <input type="checkbox" checked={draft.containsAudio}
                    onChange={(e) => setDraft({ ...draft, containsAudio: e.target.checked })}
                    style={{ width: "auto", minHeight: "auto", marginRight: 6 }} />
                  视频含音频
                </span>
              </label>
            )}
            {assetRoles.map((ar) => (
              <div key={ar.role} style={{ marginBottom: 14 }}>
                <span className="form-label" style={{ display: "block", marginBottom: 6 }}>{ar.label}</span>
                <div
                  className={`perf-dropzone ${dragOver && activeAssetRole === ar.role ? "drag-over" : ""} ${draft.assets[ar.role] ? "has-file" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); setActiveAssetRole(ar.role); }}
                  onDragLeave={() => { setDragOver(false); setActiveAssetRole(""); }}
                  onDrop={handleDrop}
                  onClick={() => { if (isUploadReady) { setActiveAssetRole(ar.role); fileInputRef.current?.click(); } }}
                >
                  {draft.assets[ar.role] ? (
                    <div className="perf-dropzone-done">
                      <Upload size={16} />
                      <code>{draft.assets[ar.role]}</code>
                      <span className="perf-dropzone-change">点击更换</span>
                    </div>
                  ) : isUploadReady ? (
                    <div className="perf-dropzone-ready">
                      <Upload size={18} />
                      <span>{uploading ? "上传中..." : "点击或拖拽上传"}</span>
                      <small>{ar.acceptExts}</small>
                    </div>
                  ) : (
                    <div className="perf-dropzone-idle"><span>请先填写上方 ID 和名称</span></div>
                  )}
                </div>
                <input className="form-input mono" style={{ marginTop: 4, fontSize: "0.78rem" }}
                  value={draft.assets[ar.role] ?? ""}
                  onChange={(e) => setDraft({ ...draft, assets: { ...draft.assets, [ar.role]: e.target.value } })}
                  placeholder={`或手动填写 ${ar.label} 路径`} />
              </div>
            ))}
            <input ref={fileInputRef} type="file"
              accept={assetRoles.map((a) => a.acceptExts).join(",")}
              onChange={(e) => { const f = e.target.files?.[0]; if (f && activeAssetRole) uploadAsset(f, activeAssetRole); }}
              style={{ display: "none" }} />
          </fieldset>
        )}

        <div className="perf-actions-bar">
          <button className="admin-save-button" onClick={() => void saveDraft()}>
            <Save size={16} /> {editingId ? "保存修改" : "保存演出"}
          </button>
          {editingId ? (
            <button className="btn-secondary" onClick={resetDraft}>
              <X size={16} /> 取消编辑
            </button>
          ) : (
            <button className="btn-secondary" onClick={resetDraft}>
              <Plus size={16} /> 清空表单
            </button>
          )}
        </div>
      </section>

      {/* Existing Performances */}
      <section className="perf-list">
        <h3>已有演出 ({allPerformances.length})</h3>
        {allPerformances.length === 0 ? (
          <p className="empty-state small">还没有演出配置。</p>
        ) : (
          allPerformances.map(([id, p]) => {
            const Icon = RENDERER_ICONS[p.renderer as PerfRenderer] ?? Film;
            const isEditing = editingId === id;
            const assetPath = getPerformanceAssetPath(p);
            const isPlaying = playingId === id;
            return (
              <article className={`perf-row ${isEditing ? "editing" : ""}`} key={id}>
                <span className={`perf-row-type ${p.renderer}`}>
                  <Icon size={14} />
                </span>
                <div className="perf-row-info">
                  <strong>{p.name}</strong>
                  <small>
                    {RENDERER_LABELS[p.renderer as PerfRenderer] ?? p.renderer} · {TRIGGER_LABELS[p.trigger.type as PerfTriggerType] ?? p.trigger.type}
                    {p.trigger.characterId ? ` · ${pkg.characters.find((c) => c.id === p.trigger.characterId)?.name ?? p.trigger.characterId}` : ""}
                    {p.trigger.stageId ? ` · ${p.trigger.stageId}` : ""}
                    {" · "}{(p.trigger.keywords ?? []).join("、") || p.trigger.knowledgeTitle || p.trigger.type}
                  </small>
                </div>
                <code className="perf-row-path">{p.durationMs}ms</code>
                {p.renderer === "audio" && assetPath && (
                  <button
                    className={`perf-preview-btn ${isPlaying ? "playing" : ""}`}
                    title={isPlaying ? "停止播放" : "试听"}
                    onClick={() => toggleAudio(id, assetPath)}
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                )}
                {p.renderer === "image" && assetPath && (
                  <a className="perf-preview-img" href={getAssetUrl(assetPath)} target="_blank" rel="noreferrer"
                    title="查看图片">
                    <img src={getAssetUrl(assetPath)} alt={p.name} />
                  </a>
                )}
                <button className="paper-icon" title="编辑演出" onClick={() => startEdit(id, p)}>
                  <Pencil size={15} />
                </button>
                <button className="danger-button" onClick={() => void deletePerformance(id)}>
                  <Trash2 size={15} />
                </button>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}

function makeEmptyDraft(pkg: StoryPackage | null): PerformanceDraft {
  const firstChar = pkg?.characters[0];
  return {
    id: "", name: "",
    renderer: "video",
    triggerType: "firstAppearance",
    characterId: firstChar?.id ?? "",
    stageId: pkg?.scenario?.stages?.[0] ?? "",
    knowledgeTitle: "", keywordsText: "",
    durationMs: 3800,
    playOnce: "session",
    containsAudio: true,
    assets: {},
  };
}

function withPerformance(pkg: StoryPackage, id: string, performance: StoryPerformanceDefinition) {
  return withPerformances(pkg, { ...(pkg.pluginManifest?.performances ?? {}), [id]: performance });
}

function withPerformances(pkg: StoryPackage, performances: Record<string, StoryPerformanceDefinition>): StoryPluginManifest {
  const now = new Date().toISOString();
  return {
    id: pkg.id, type: "story-plugin", schemaVersion: "2",
    title: pkg.title, description: pkg.description,
    version: pkg.pluginManifest?.version ?? "1.0.0",
    author: pkg.pluginManifest?.author ?? "",
    capabilities: {
      audio: true,
      customFonts: pkg.pluginManifest?.capabilities.customFonts ?? false,
      customCss: pkg.pluginManifest?.capabilities.customCss ?? false,
      characterPortraits: pkg.pluginManifest?.capabilities.characterPortraits ?? false,
      backgroundImages: pkg.pluginManifest?.capabilities.backgroundImages ?? false,
      performances: true,
    },
    audio: pkg.pluginManifest?.audio ?? { bgm: { scenes: {} }, sfx: {} },
    images: pkg.pluginManifest?.images ?? { portraits: {}, backgrounds: {} },
    fonts: pkg.pluginManifest?.fonts ?? {},
    performances,
    entry: pkg.pluginManifest?.entry ?? "story.json",
    createdAt: pkg.pluginManifest?.createdAt ?? pkg.createdAt ?? now,
    updatedAt: now,
  };
}

function splitKeywords(value: string) {
  return value.split(/[，,、]/).map((s) => s.trim()).filter(Boolean);
}

function toPinyinId(name: string): string {
  if (!name.trim()) return "";
  const py = pinyin(name, { toneType: "none", type: "array" });
  return py.join("_").toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "").replace(/_+/g, "_");
}

function safeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "");
}

function uniquePerformanceId(baseId: string, existing: Record<string, unknown>): string {
  if (!baseId) return "";
  if (!existing[baseId]) return baseId;
  let n = 2;
  while (existing[`${baseId}_${n}`]) n++;
  return `${baseId}_${n}`;
}

function clampDuration(value: number) {
  if (!Number.isFinite(value)) return 1500;
  return Math.max(500, Math.min(10000, Math.round(value)));
}
