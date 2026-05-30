/**
 * Story Export Tab — 导出小说 Markdown，作为编辑器内的 tab
 */
import { useState } from "react";
import { useEditorStore } from "../store/editorStore.js";

export function StoryExportTab() {
  const storyPackage = useEditorStore(s => s.storyPackage);
  const storyDir = useEditorStore(s => s.storyDir);

  const [targetWords, setTargetWords] = useState(1500);
  const [style, setStyle] = useState("第三人称，文学性强，注重氛围描写和角色对话");
  const [generating, setGenerating] = useState(false);
  const [chapters, setChapters] = useState<{ title: string; content: string; wordCount: number }[]>([]);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentChapter, setCurrentChapter] = useState("");

  if (!storyPackage || !storyDir) {
    return <div style={{ padding: "var(--s4)" }}>请先打开一个故事包</div>;
  }

  const stageDetails = (storyPackage.scenario?.stageDetails || []) as any[];
  const activeStages = stageDetails.filter((s: any) => s.guidance && s.stageType !== "choice");
  const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);

  async function handleGenerate() {
    setGenerating(true);
    setChapters([]);
    setProgress(0);
    setTotal(activeStages.length);

    const results: { title: string; content: string; wordCount: number }[] = [];
    let prevSummary = "";

    for (let i = 0; i < activeStages.length; i++) {
      const stage = activeStages[i];
      setCurrentChapter(stage.title);
      setProgress(i);

      try {
        const res = await fetch("/api/editor/export/generate-chapter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packagePath: storyDir,
            stageId: stage.id,
            chapterIndex: i,
            totalChapters: activeStages.length,
            targetWords,
            style,
            previousSummary: prevSummary,
            storyContext: {
              title: storyPackage!.title,
              premise: storyPackage!.scenario?.premise || "",
              characters: (storyPackage!.characters || []).map((c: any) => ({ name: c.name, role: c.role })),
            },
            guidance: stage.guidance || "",
            directive: stage.directive || "",
            chapterTitle: stage.title,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          results.push({ title: stage.title, content: data.content, wordCount: data.wordCount });
          prevSummary = data.summary || "";
        } else {
          results.push({ title: stage.title, content: `[生成失败: ${data.error}]`, wordCount: 0 });
        }
      } catch (err) {
        results.push({ title: stage.title, content: `[请求失败: ${(err as Error).message}]`, wordCount: 0 });
      }
      setChapters([...results]);
    }

    setProgress(activeStages.length);
    setGenerating(false);
  }

  function handleDownload() {
    let md = `# ${storyPackage!.title}\n\n`;
    md += `> ${storyPackage!.scenario?.premise || ""}\n\n---\n\n`;
    chapters.forEach((ch, i) => {
      md += `## 第${i + 1}章 ${ch.title}\n\n${ch.content}\n\n---\n\n`;
    });
    md += `\n*全文完*\n`;

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${storyPackage!.title}-小说.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: "var(--s4)", maxWidth: 900, overflow: "auto", height: "100%" }}>
      <h3 style={{ margin: "0 0 var(--s3)" }}>📖 导出小说</h3>
      <p style={{ color: "var(--text-faint)", fontSize: 12, margin: "0 0 var(--s4)" }}>
        将故事流程转化为一篇完整的小说。共 {activeStages.length} 个可导出章节。
      </p>

      {/* Config */}
      {!generating && chapters.length === 0 && (
        <div style={{ background: "var(--surface)", borderRadius: "var(--r-md)", padding: "var(--s4)", display: "flex", flexDirection: "column", gap: "var(--s3)" }}>
          <div style={{ display: "flex", gap: "var(--s4)" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontWeight: 600, fontSize: 12, display: "block", marginBottom: 4 }}>每章字数</label>
              <input className="input" type="number" min={500} max={5000} value={targetWords} onChange={e => setTargetWords(Number(e.target.value))} />
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ fontWeight: 600, fontSize: 12, display: "block", marginBottom: 4 }}>写作风格</label>
              <input className="input" value={style} onChange={e => setStyle(e.target.value)} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
            预计生成 {activeStages.length} 章，约 {Math.round(activeStages.length * targetWords / 1000)}k 字，耗时约 {Math.ceil(activeStages.length * 0.5)} 分钟
          </div>
          <button className="btn btn-primary" onClick={handleGenerate}>
            开始生成小说
          </button>
        </div>
      )}

      {/* Progress + Results */}
      {(generating || chapters.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s3)" }}>
          {/* Progress bar */}
          <div>
            <div style={{ background: "var(--border-light)", borderRadius: 4, height: 8, overflow: "hidden" }}>
              <div style={{ background: "var(--primary)", height: "100%", width: `${total > 0 ? (progress / total) * 100 : 0}%`, transition: "width 0.3s" }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>
              {progress}/{total} 章 · {totalWords.toLocaleString()} 字
              {generating && currentChapter && ` · 当前：${currentChapter}`}
            </div>
          </div>

          {/* Chapter list */}
          <div style={{ maxHeight: 500, overflow: "auto", border: "1px solid var(--border-light)", borderRadius: "var(--r-md)" }}>
            {chapters.map((ch, i) => (
              <details key={i} style={{ borderBottom: "1px solid var(--border-light)" }}>
                <summary style={{ padding: "8px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                  第{i + 1}章 {ch.title} ({ch.wordCount}字)
                </summary>
                <div style={{ padding: "8px 12px 16px", fontSize: 12, lineHeight: 1.8, whiteSpace: "pre-wrap", color: "var(--text2)" }}>
                  {ch.content}
                </div>
              </details>
            ))}
          </div>

          {/* Download */}
          {!generating && chapters.length > 0 && (
            <div style={{ display: "flex", gap: "var(--s2)" }}>
              <button className="btn btn-primary" onClick={handleDownload} style={{ flex: 1 }}>
                📥 下载 Markdown ({totalWords.toLocaleString()} 字)
              </button>
              <button className="btn" onClick={() => { setChapters([]); setProgress(0); }}>
                重新配置
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
