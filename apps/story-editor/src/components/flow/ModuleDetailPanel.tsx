import { useState, useEffect } from "react";
import type { StoryModule } from "@story-game/shared";
import { useFlowStore } from "../../store/flowStore.js";
import { useEditorStore } from "../../store/editorStore.js";
import { TYPE_LABELS, TYPE_COLORS } from "../../lib/typeLabels.js";
import { mediaUrl } from "../../lib/api.js";

interface Props {
  moduleId: string;
  edges: any[];
  onEdgesChange: (edges: any[]) => void;
  onClose: () => void;
}

export function ModuleDetailPanel({ moduleId, edges, onEdgesChange, onClose }: Props) {
  const modules = useFlowStore((s) => s.modules);
  const updateModule = useFlowStore((s) => s.updateModule);
  const storyPackage = useEditorStore((s) => s.storyPackage);

  const mod = modules.find((m) => m.id === moduleId);
  const [draft, setDraft] = useState<StoryModule | null>(null);
  // ALL useState BEFORE any early return (React hook rule)
  const [newBranchLabel, setNewBranchLabel] = useState("");

  useEffect(() => {
    if (mod) setDraft({ ...mod });
  }, [moduleId]);

  const stages = storyPackage?.scenario?.stageDetails || [];
  const stageOptions = stages.map((s) => ({ id: s.id, label: s.title || s.id }));

  // ── Edge analysis ──
  const edgeList = edges || [];
  const nodeId = `node_${moduleId}`;
  const incomingEdges = edgeList.filter((e: any) => e.target === nodeId);
  const outgoingEdges = edgeList.filter((e: any) => e.source === nodeId);

  function resolveMod(edgeTargetOrSource: string) {
    const match = edgeTargetOrSource.match(/^node_(.+)$/);
    if (match) {
      const mid = match[1];
      const m = modules.find((m: any) => m.id === mid);
      if (m) return { id: m.id, title: m.title, type: m.type };
    }
    return null;
  }

  if (!mod || !draft) {
    return (
      <div className="detail-panel" style={{ width: 340, flexShrink: 0 }}>
        <div className="dp-header">
          <h3>模块详情</h3>
          <button className="btn btn-ghost btn-xs" onClick={onClose}>✕</button>
        </div>
        <div className="dp-body"><p className="muted">模块未找到</p></div>
      </div>
    );
  }

  function update<K extends keyof StoryModule>(key: K, value: StoryModule[K]) {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  const isChoice = draft.type === "choice";

  // ── Connection editing helpers ──
  const otherModules = modules.filter((m) => m.id !== moduleId);
  const moduleOptions = otherModules.map((m) => ({
    id: m.id, label: `${m.title} [${TYPE_LABELS[m.type] || m.type}]`,
  }));

  function markDirty() { useEditorStore.setState((s) => s.loaded ? { dirty: true } : {}); }
  function replaceEdge(oldId: string, e: any) { onEdgesChange(edgeList.map((x: any) => x.id === oldId ? e : x)); markDirty(); }
  function removeEdgeById(id: string) { onEdgesChange(edgeList.filter((x: any) => x.id !== id)); markDirty(); }
  function addNewEdge(e: any) { onEdgesChange([...edgeList, e]); markDirty(); }
  function chgSrc(oldId: string, newSrc: string) {
    const old = edgeList.find((x: any) => x.id === oldId); if (!old) return;
    const s = `node_${newSrc}`; replaceEdge(oldId, { ...old, id: `edge_${s}_${old.target}`, source: s });
  }
  function chgTgt(oldId: string, newTgt: string, h?: string) {
    const old = edgeList.find((x: any) => x.id === oldId); if (!old) return;
    const t = `node_${newTgt}`; const sh = h || old.sourceHandle || "";
    replaceEdge(oldId, { ...old, id: `edge_${old.source}_${t}_${sh}`, target: t, sourceHandle: sh || undefined });
  }
  function addIn(source: string) { if (source) addNewEdge({ id: `edge_node_${source}_${nodeId}`, source: `node_${source}`, target: nodeId }); }
  function addOut(target: string, h?: string) { if (target) addNewEdge({ id: `edge_${nodeId}_node_${target}_${h||""}`, source: nodeId, target: `node_${target}`, sourceHandle: h||undefined }); }

  return (
    <div className="detail-panel" style={{ width: 380, flexShrink: 0, height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="dp-header"><div><h3>模块详情</h3><span className="faint mono">{moduleId}</span></div><button className="btn btn-ghost btn-xs" onClick={onClose}>✕</button></div>
      <div className="dp-body" style={{ flex: 1, overflow: "auto" }}>
        <label className="field"><span>类型</span>
          <select className="input" value={draft.type} onChange={(e) => update("type", e.target.value as StoryModule["type"])} style={{ borderColor: TYPE_COLORS[draft.type] || "var(--border)" }}>
            {Object.keys(TYPE_LABELS).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]} ({t})</option>)}
          </select>
        </label>
        <label className="field mt3"><span>标题</span><input className="input" value={draft.title} onChange={(e) => update("title", e.target.value)} /></label>
        <label className="field mt3"><span>来源阶段</span>
          <select className="input" value={draft.sourceStage||""} onChange={(e) => update("sourceStage", e.target.value||undefined)}>
            <option value="">无</option>{stageOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        {/* ── Connections ── */}
        <div className="card mt3" style={{ padding: "var(--s3)" }}><div className="card-section-title" style={{ marginTop:0 }}>连接</div>
          <div style={{ marginBottom:"var(--s2)" }}><span className="faint" style={{ fontSize:"var(--fs-xs)" }}>连入 ({incomingEdges.length})</span>
            <div style={{ display:"flex",flexDirection:"column",gap:2,marginTop:4 }}>
              {incomingEdges.map((e:any) => { const src=resolveMod(e.source); return (
                <div key={e.id} style={{ display:"flex",alignItems:"center",gap:4 }}>
                  <span style={{ color:"var(--text-muted)",fontSize:"var(--fs-xs)" }}>←</span>
                  <select className="input" style={{ fontSize:"var(--fs-xs)",padding:"2px 4px",flex:1 }} value={src?.id||""} onChange={(ev) => chgSrc(e.id, ev.target.value)}>
                    <option value="">选择来源...</option>{moduleOptions.map((o:any) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                  <button className="btn btn-ghost btn-xs" style={{ color:"var(--danger)",fontSize:10 }} onClick={() => removeEdgeById(e.id)}>✕</button>
                </div>
              )})}
              <div style={{ display:"flex",alignItems:"center",gap:4 }}><span style={{ color:"var(--cat-green)",fontSize:"var(--fs-xs)" }}>+</span>
                <select className="input" style={{ fontSize:"var(--fs-xs)",padding:"2px 4px",flex:1 }} value="" onChange={(ev) => addIn(ev.target.value)}>
                  <option value="">添加连入...</option>{moduleOptions.map((o:any) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div><span className="faint" style={{ fontSize:"var(--fs-xs)" }}>连出 ({outgoingEdges.length})</span>
            {isChoice ? (
              <ChoiceBranches outgoingEdges={outgoingEdges} nodeId={nodeId} newBranchLabel={newBranchLabel} onNewBranchLabelChange={setNewBranchLabel}
                moduleOptions={moduleOptions as any} onAddEdge={addNewEdge} onReplaceEdge={replaceEdge} onChangeTarget={chgTgt}
                onRemoveEdge={removeEdgeById} resolveMod={resolveMod} markDirty={markDirty} />
            ) : (
              <div style={{ display:"flex",flexDirection:"column",gap:2,marginTop:4 }}>
                {outgoingEdges.filter((e:any)=>!e.sourceHandle).map((e:any)=>{const tgt=resolveMod(e.target);return(
                  <div key={e.id} style={{ display:"flex",alignItems:"center",gap:4 }}>
                    <span style={{ color:"var(--text-muted)",fontSize:"var(--fs-xs)" }}>→</span>
                    <select className="input" style={{ fontSize:"var(--fs-xs)",padding:"2px 4px",flex:1 }} value={tgt?.id||""} onChange={(ev)=>chgTgt(e.id,ev.target.value)}>
                      <option value="">选择目标...</option>{moduleOptions.map((o:any)=><option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                    <button className="btn btn-ghost btn-xs" style={{ color:"var(--danger)",fontSize:10 }} onClick={()=>removeEdgeById(e.id)}>✕</button>
                  </div>
                )})}
                <div style={{ display:"flex",alignItems:"center",gap:4 }}><span style={{ color:"var(--cat-green)",fontSize:"var(--fs-xs)" }}>+</span>
                  <select className="input" style={{ fontSize:"var(--fs-xs)",padding:"2px 4px",flex:1 }} value="" onChange={(ev)=>{if(ev.target.value)addOut(ev.target.value)}}>
                    <option value="">添加连出...</option>{moduleOptions.map((o:any)=><option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
        <label className="field mt3"><span>描述</span><textarea className="input" rows={3} value={draft.description||""} onChange={(e)=>update("description",e.target.value)} /></label>
        <label className="field mt3"><span>进入条件</span><input className="input" value={draft.enterWhen||""} onChange={(e)=>update("enterWhen",e.target.value)} /></label>
        <label className="field mt3"><span>退出条件</span><input className="input" value={draft.exitCondition||""} onChange={(e)=>update("exitCondition",e.target.value)} /></label>
        <label className="field mt3"><span>AI 引导语 (guidance)</span><textarea className="input mono" rows={8} value={draft.guidance||""} onChange={(e)=>update("guidance",e.target.value)} placeholder={"氛围：xxx\n\n角色A：**动作**（描述）\n角色B：**动作**（描述）\n→ 推进条件：xxx"} /></label>
        <label className="field mt3"><span>阶段指令 (directive)</span><textarea className="input mono" rows={4} value={(draft as any).directive||""} onChange={(e)=>update("directive" as any,e.target.value)} placeholder={"必须发生的具体事件，LLM 不可跳过。如：虚竹必须击中丁春秋右肩"} /></label>

        {/* ── 绑定演出 ── */}
        <PerformanceBindings moduleId={moduleId} sourceStage={draft.sourceStage} />
      </div>
      <div style={{ padding:"var(--s3) var(--s4)",borderTop:"1px solid var(--border)",display:"flex",gap:"var(--s2)" }}>
        <button className="btn btn-primary" style={{ flex:1 }} onClick={()=>{if(draft){updateModule(moduleId,draft);onClose()}}}>保存并关闭</button>
        <button className="btn" onClick={onClose}>取消</button>
      </div>
    </div>
  );
}

function ChoiceBranches({ outgoingEdges, nodeId, newBranchLabel, onNewBranchLabelChange, moduleOptions, onAddEdge, onReplaceEdge, onChangeTarget, onRemoveEdge, resolveMod, markDirty }: any) {
  const branchEdges = outgoingEdges.filter((e: any) => e.sourceHandle?.startsWith("branch_"));
  return (
    <div style={{ display:"flex",flexDirection:"column",gap:4,marginTop:4 }}>
      {branchEdges.map((e: any, bi: number) => { const tgt = resolveMod(e.target); return (
        <div key={e.id} style={{ display:"flex",alignItems:"center",gap:4 }}>
          <span style={{ background:`hsl(${bi*60},50%,45%)`,color:"#fff",borderRadius:3,padding:"0 4px",fontSize:9,flexShrink:0 }}>{String.fromCharCode(65+bi)}</span>
          <input className="input" style={{ fontSize:"var(--fs-xs)",padding:"2px 4px",width:60 }} defaultValue={(e.label as string)||""}
            onBlur={(ev:any)=>{if(ev.target.value!==(e.label||""))onReplaceEdge(e.id,{...e,label:ev.target.value})}} placeholder="标签" />
          <select className="input" style={{ fontSize:"var(--fs-xs)",padding:"2px 4px",flex:1 }} value={tgt?.id||""} onChange={(ev:any)=>onChangeTarget(e.id,ev.target.value,e.sourceHandle)}>
            <option value="">选择目标...</option>{moduleOptions.map((o:any)=><option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <button className="btn btn-ghost btn-xs" style={{ color:"var(--danger)",fontSize:10 }} onClick={()=>onRemoveEdge(e.id)}>✕</button>
        </div>
      )})}
      <div style={{ display:"flex",alignItems:"center",gap:4 }}><span style={{ color:"var(--cat-green)",fontSize:"var(--fs-xs)",flexShrink:0 }}>+</span>
        <input className="input" style={{ fontSize:"var(--fs-xs)",padding:"2px 4px",width:60 }} value={newBranchLabel} onChange={(e:any)=>onNewBranchLabelChange(e.target.value)} placeholder="标签" />
        <select className="input" style={{ fontSize:"var(--fs-xs)",padding:"2px 4px",flex:1 }} value="" onChange={(ev:any)=>{if(ev.target.value){
          const h=`branch_${branchEdges.length}`;onAddEdge({id:`edge_${nodeId}_node_${ev.target.value}_${h}`,source:nodeId,target:`node_${ev.target.value}`,sourceHandle:h,label:newBranchLabel||undefined});onNewBranchLabelChange("");markDirty()}}}>
          <option value="">添加分支...</option>{moduleOptions.map((o:any)=><option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}

/** Sub-component: show performances bound to this module's sourceStage + upload new */
function PerformanceBindings({ moduleId, sourceStage }: { moduleId: string; sourceStage?: string }) {
  const { manifest, updateManifest } = useEditorStore();
  const [bindKey, setBindKey] = useState("");
  const [uploading, setUploading] = useState(false);

  const perfs = (manifest?.performances || {}) as Record<string, any>;
  const allKeys = Object.keys(perfs);

  // Find performances bound to this module's sourceStage
  const boundKeys = allKeys.filter((k) => {
    const p = perfs[k];
    return p.trigger?.type === "stageEnter" && p.trigger?.stageId === sourceStage;
  });

  // Available (unbound to this stage) performances for binding
  const availableKeys = allKeys.filter((k) => !boundKeys.includes(k));

  function bindPerformance(key: string) {
    if (!key || !sourceStage) return;
    const p = perfs[key];
    const updated = { ...p, trigger: { ...p.trigger, type: "stageEnter", stageId: sourceStage } };
    updateManifest({ ...(manifest || {}), performances: { ...perfs, [key]: updated } });
  }

  function unbindPerformance(key: string) {
    const p = perfs[key];
    const updated = { ...p, trigger: { ...p.trigger, stageId: undefined } };
    updateManifest({ ...(manifest || {}), performances: { ...perfs, [key]: updated } });
  }

  function deletePerformance(key: string) {
    if (!confirm(`确定删除演出「${perfs[key]?.name || key}」？`)) return;
    const updated = { ...perfs };
    delete updated[key];
    updateManifest({ ...(manifest || {}), performances: updated });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, type: "image" | "audio" | "video") {
    const file = e.target.files?.[0];
    if (!file || !sourceStage) return;

    setUploading(true);
    try {
      const perfKey = `stage_enter_${sourceStage}_${type}`;
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(
        `/api/editor/upload-media?performanceId=${encodeURIComponent(perfKey)}&type=${type}`,
        { method: "POST", body: form }
      );
      const data = await res.json();

      if (!data.path) {
        alert("上传失败：" + (data.error || "未知错误"));
        return;
      }

      // Create or update performance entry
      const existing = perfs[perfKey] || {
        name: `${moduleId} - ${type}`,
        renderer: type,
        durationMs: type === "audio" ? 3000 : 5000,
        playOnce: "session",
        layers: {},
        audio: {},
        video: { containsAudio: false },
      };

      if (type === "image") {
        existing.renderer = "image";
        existing.layers = { ...existing.layers, main: data.path };
      } else if (type === "audio") {
        existing.renderer = existing.layers?.main ? "image" : "audio";
        existing.audio = { ...existing.audio, main: data.path };
      } else if (type === "video") {
        existing.renderer = "video";
        existing.video = { ...(existing.video || {}), mp4: data.path };
      }

      existing.trigger = { type: "stageEnter", stageId: sourceStage };

      updateManifest({ ...(manifest || {}), performances: { ...perfs, [perfKey]: existing } });
    } catch (err) {
      alert("上传失败：" + (err as Error).message);
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = "";
    }
  }

  function getIcon(p: any): string {
    if (p.renderer === "audio") return "🔊";
    if (p.renderer === "video") return "🎬";
    if (p.renderer === "layeredCss" || p.renderer === "image") return "🖼️";
    return "🎭";
  }

  function getPreviewPath(p: any): string | null {
    if (p.renderer === "audio" && p.audio?.main) return p.audio.main;
    if (p.renderer === "image" && p.layers) {
      const first = Object.values(p.layers)[0];
      return typeof first === "string" ? first : null;
    }
    return null;
  }

  if (!manifest) return null;

  // Auto-init performances if missing
  if (!manifest.performances) {
    updateManifest({ ...manifest, performances: {} });
    return null;
  }

  return (
    <div className="card mt3" style={{ padding: "var(--s3)" }}>
      <div className="card-section-title" style={{ marginTop: 0 }}>🎬 阶段演出</div>
      {!sourceStage && (
        <p className="faint" style={{ fontSize: "var(--fs-xs)", margin: 0 }}>
          需要先设置"来源阶段"才能配置演出
        </p>
      )}
      {sourceStage && boundKeys.length === 0 && (
        <p className="faint" style={{ fontSize: "var(--fs-xs)", margin: 0 }}>暂无演出，上传文件或从已有演出中绑定</p>
      )}
      {boundKeys.map((key) => {
        const p = perfs[key];
        const preview = getPreviewPath(p);
        return (
          <div key={key} style={{
            display: "flex", alignItems: "center", gap: "var(--s2)",
            padding: "var(--s1) var(--s2)", background: "var(--bg)",
            borderRadius: "var(--r-sm)", marginBottom: 4,
          }}>
            <span style={{ fontSize: 14 }}>{getIcon(p)}</span>
            <span style={{ flex: 1, fontSize: "var(--fs-sm)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.name || key}
            </span>
            {preview && p.renderer === "audio" && (
              <audio src={mediaUrl(`media/${preview}`)} controls style={{ height: 24, maxWidth: 100 }} />
            )}
            <button className="btn btn-ghost btn-xs" style={{ color: "var(--danger)", fontSize: 10 }}
              onClick={() => unbindPerformance(key)}>解绑</button>
            <button className="btn btn-ghost btn-xs" style={{ color: "var(--danger)", fontSize: 10 }}
              onClick={() => deletePerformance(key)}>删除</button>
          </div>
        );
      })}

      {/* Upload buttons */}
      {sourceStage && (
        <div style={{ display: "flex", gap: "var(--s1)", marginTop: "var(--s2)", flexWrap: "wrap" }}>
          <label className="btn btn-xs" style={{ cursor: "pointer" }}>
            🖼️ 上传图片
            <input type="file" accept="image/*" hidden onChange={(e) => handleFileUpload(e, "image")} />
          </label>
          <label className="btn btn-xs" style={{ cursor: "pointer" }}>
            🔊 上传音频
            <input type="file" accept="audio/*" hidden onChange={(e) => handleFileUpload(e, "audio")} />
          </label>
          <label className="btn btn-xs" style={{ cursor: "pointer" }}>
            🎥 上传视频
            <input type="file" accept="video/*" hidden onChange={(e) => handleFileUpload(e, "video")} />
          </label>
        </div>
      )}
      {uploading && <div style={{ fontSize: 10, color: "var(--cat-orange)", marginTop: 4 }}>上传中...</div>}

      {/* Bind existing performance */}
      {sourceStage && availableKeys.length > 0 && (
        <div style={{ display: "flex", gap: "var(--s1)", marginTop: "var(--s2)" }}>
          <select className="input" style={{ flex: 1, fontSize: "var(--fs-xs)", padding: "2px 6px" }}
            value={bindKey} onChange={(e) => setBindKey(e.target.value)}>
            <option value="">绑定已有演出...</option>
            {availableKeys.map((k) => (
              <option key={k} value={k}>{getIcon(perfs[k])} {perfs[k].name || k}</option>
            ))}
          </select>
          <button className="btn btn-xs" disabled={!bindKey}
            onClick={() => { bindPerformance(bindKey); setBindKey(""); }}>绑定</button>
        </div>
      )}
    </div>
  );
}
