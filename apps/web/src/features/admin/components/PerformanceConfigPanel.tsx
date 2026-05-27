import { useMemo, useRef, useState } from "react";
import { Image, Music, Plus, Save, Trash2, Upload } from "lucide-react";
import type { StoryPackage, StoryPerformanceDefinition, StoryPluginManifest } from "@story-game/shared";
import { useGameStore } from "../../../store/gameStore.js";
import { uploadPerformanceAudio, uploadPerformanceImage } from "../../../lib/adminApi.js";

type SimplePerformanceRenderer = "audio" | "image";

interface PerformanceDraft {
  id: string;
  name: string;
  renderer: SimplePerformanceRenderer;
  characterId: string;
  knowledgeTitle: string;
  keywordsText: string;
  assetPath: string;
  durationMs: number;
  playOnce: "session" | "story" | "never";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!storyPackage || !editingPackageId) return null;

  const pkg = storyPackage;
  const performances = pkg.pluginManifest?.performances ?? {};
  const simplePerformances = Object.entries(performances).filter(([, performance]) => ["audio", "image"].includes(performance.renderer));

  const isAudio = draft.renderer === "audio";
  const acceptExts = isAudio ? ".mp3,.ogg,.wav,.flac" : ".png,.jpg,.jpeg,.webp";
  const acceptMimes = isAudio
    ? "audio/mpeg,audio/ogg,audio/wav,audio/flac"
    : "image/png,image/jpeg,image/webp";

  function resetDraft() {
    setDraft(makeEmptyDraft(pkg));
    setDragOver(false);
  }

  function handleFile(file: File | undefined) {
    if (!file || !draft.id.trim()) return;
    setUploading(true);
    setDragOver(false);
    const uploadFn = isAudio ? uploadPerformanceAudio : uploadPerformanceImage;
    uploadFn(pkg.id, safeId(draft.id), file)
      .then((result) => setDraft((current) => ({ ...current, assetPath: result.path })))
      .finally(() => setUploading(false));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  async function saveDraft() {
    const performanceId = safeId(draft.id);
    const name = draft.name.trim();
    const assetPath = draft.assetPath.trim();
    if (!performanceId || !name || !assetPath) {
      useGameStore.setState({ error: "请填写演出 ID、名称，并上传或填写资源路径" });
      return;
    }

    const performance: StoryPerformanceDefinition = {
      name,
      renderer: draft.renderer,
      durationMs: clampDuration(draft.durationMs),
      trigger: {
        type: "knowledgeUse",
        characterId: draft.characterId || undefined,
        knowledgeTitle: draft.knowledgeTitle.trim() || undefined,
        keywords: splitKeywords(draft.keywordsText),
        matchBoldOnly: true,
      },
      playOnce: draft.playOnce,
      video: { containsAudio: false },
      layers: !isAudio ? { bg: assetPath } : {},
      audio: isAudio ? { main: assetPath } : {},
    };

    await saveStoryPackage({
      ...pkg,
      pluginManifest: withPerformance(pkg, performanceId, performance),
    });
    resetDraft();
  }

  async function deletePerformance(id: string) {
    if (!confirm("确定删除这个演出配置吗？上传的资源文件会保留在故事包资产中。")) return;
    const nextPerformances = { ...(pkg.pluginManifest?.performances ?? {}) };
    delete nextPerformances[id];
    await saveStoryPackage({
      ...pkg,
      pluginManifest: withPerformances(pkg, nextPerformances),
    });
  }

  const isUploadReady = draft.id.trim() !== "";

  return (
    <div className="performance-config-panel">
      {/* ====== Create / Edit Form ====== */}
      <section className="perf-form">
        <div className="perf-form-header">
          <Music size={18} />
          <div>
            <h3>演出配置</h3>
          </div>
        </div>

        {/* --- Section 1: Basic Info --- */}
        <fieldset className="perf-fieldset">
          <legend className="perf-legend">基本信息</legend>
          <div className="perf-row two-col">
            <label className="form-field">
              <span className="form-label">名称</span>
              <input className="form-input" value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="飞龙在天" />
            </label>
            <label className="form-field">
              <span className="form-label">ID</span>
              <input className="form-input" value={draft.id}
                onChange={(e) => setDraft({ ...draft, id: safeId(e.target.value) })}
                placeholder="qiaofeng_feilong_audio" />
            </label>
          </div>

          <label className="form-label" style={{ marginBottom: 4 }}>类型</label>
          <div className="perf-radio-group">
            <button
              type="button"
              className={`perf-radio ${isAudio ? "active" : ""}`}
              onClick={() => setDraft({ ...draft, renderer: "audio", assetPath: "" })}
            >
              <Music size={16} /> 音效
            </button>
            <button
              type="button"
              className={`perf-radio ${!isAudio ? "active" : ""}`}
              onClick={() => setDraft({ ...draft, renderer: "image", assetPath: "" })}
            >
              <Image size={16} /> 图片
            </button>
          </div>
        </fieldset>

        {/* --- Section 2: Trigger --- */}
        <fieldset className="perf-fieldset">
          <legend className="perf-legend">触发条件</legend>
          <div className="perf-row two-col">
            <label className="form-field">
              <span className="form-label">角色</span>
              <select className="form-input" value={draft.characterId}
                onChange={(e) => setDraft({ ...draft, characterId: e.target.value })}>
                <option value="">不限定</option>
                {pkg.characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
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
        </fieldset>

        {/* --- Section 3: Asset Upload --- */}
        <fieldset className="perf-fieldset">
          <legend className="perf-legend">资源文件</legend>
          <div
            className={`perf-dropzone ${dragOver ? "drag-over" : ""} ${draft.assetPath ? "has-file" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => isUploadReady && fileInputRef.current?.click()}
          >
            {draft.assetPath ? (
              <div className="perf-dropzone-done">
                {isAudio ? <Music size={20} /> : <Image size={20} />}
                <code>{draft.assetPath}</code>
                <span className="perf-dropzone-change">点击更换文件</span>
              </div>
            ) : isUploadReady ? (
              <div className="perf-dropzone-ready">
                <Upload size={24} />
                <span>{uploading ? "上传中..." : `点击或拖拽上传${isAudio ? "音效" : "图片"}`}</span>
                <small>{isAudio ? ".mp3 .ogg .wav .flac" : ".png .jpg .jpeg .webp"}</small>
              </div>
            ) : (
              <div className="perf-dropzone-idle">
                <span>请先填写上方 ID 和名称</span>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept={`${acceptExts},${acceptMimes}`}
              onChange={(e) => handleFile(e.target.files?.[0])} style={{ display: "none" }} />
          </div>
          <label className="form-field" style={{ marginTop: 8 }}>
            <span className="form-label">或手动填写路径</span>
            <input className="form-input mono" value={draft.assetPath}
              onChange={(e) => setDraft({ ...draft, assetPath: e.target.value })}
              placeholder={isAudio ? "assets/performances/xxx/audio/file.mp3" : "assets/performances/xxx/images/file.png"} />
          </label>
        </fieldset>

        <div className="perf-actions-bar">
          <button className="admin-save-button" onClick={() => void saveDraft()}>
            <Save size={16} /> 保存演出
          </button>
          <button className="btn-secondary" onClick={resetDraft}>
            <Plus size={16} /> 取消
          </button>
        </div>
      </section>

      {/* ====== Existing Performances List ====== */}
      <section className="perf-list">
        <h3>已有演出</h3>
        {simplePerformances.length === 0 ? (
          <p className="empty-state small">还没有演出配置。</p>
        ) : (
          simplePerformances.map(([id, performance]) => (
            <article className="perf-row" key={id}>
              <span className={`perf-row-type ${performance.renderer}`}>
                {performance.renderer === "image" ? <Image size={14} /> : <Music size={14} />}
              </span>
              <div className="perf-row-info">
                <strong>{performance.name}</strong>
                <small>{performance.renderer === "image" ? "图片" : "音效"} · {performance.trigger.characterId ?? "任意角色"} · {(performance.trigger.keywords ?? []).join("、") || "知识库命中"}</small>
              </div>
              <code className="perf-row-path">
                {performance.renderer === "image" ? performance.layers.bg : performance.audio.main ?? performance.audio.fallback}
              </code>
              <button className="danger-button" onClick={() => void deletePerformance(id)}>
                <Trash2 size={15} />
              </button>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

function makeEmptyDraft(pkg: StoryPackage | null): PerformanceDraft {
  const qiaofeng = pkg?.characters.find((c) => c.id === "qiaofeng") ?? pkg?.characters[0];
  return {
    id: "",
    name: "",
    renderer: "audio",
    characterId: qiaofeng?.id ?? "",
    knowledgeTitle: "",
    keywordsText: "",
    assetPath: "",
    durationMs: 1500,
    playOnce: "never",
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

function safeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "");
}

function clampDuration(value: number) {
  if (!Number.isFinite(value)) return 1500;
  return Math.max(500, Math.min(10000, Math.round(value)));
}
