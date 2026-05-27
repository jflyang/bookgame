import { useEffect, useState } from "react";
import { Download, Eye, EyeOff, FileText, FileUp, MonitorPlay, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { downloadStoryPackage } from "../../../lib/adminApi.js";
import { useGameStore } from "../../../store/gameStore.js";

const DEFAULT_PACKAGE_ID = "xuzhu_vs_dingchunqiu";

export function StoryLibrary() {
  const { storyPackages, createStoryPackage, deleteStoryPackage, editStoryPackage, showImport, start, error, loadStoryPackages, saveStoryPackage } = useGameStore();
  const [title, setTitle] = useState("");
  const [feedback, setFeedback] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const defaultStory = storyPackages[0];

  useEffect(() => {
    void loadStoryPackages(showHidden);
  }, [showHidden]);

  async function handleCreate() {
    const nextTitle = title.trim() || "新的互动故事";
    try {
      await createStoryPackage(nextTitle);
      setTitle("");
      setFeedback(`已创建故事包「${nextTitle}」`);
      setTimeout(() => setFeedback(""), 2500);
    } catch {
      setFeedback("创建失败，请重试");
      setTimeout(() => setFeedback(""), 3000);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (storyPackages.length <= 1) {
      setFeedback("至少保留一个故事包");
      setTimeout(() => setFeedback(""), 2500);
      return;
    }
    if (!confirm(`确定要删除「${title}」吗？此操作不可撤销。`)) return;
    try {
      await deleteStoryPackage(id);
      setFeedback(`已删除「${title}」`);
      setTimeout(() => setFeedback(""), 2500);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "删除失败，请重试");
      setTimeout(() => setFeedback(""), 4000);
    }
  }

  async function handleToggleHidden(id: string, currentHidden: boolean) {
    const pkg = storyPackages.find((p) => p.id === id);
    if (!pkg) return;
    await saveStoryPackage({ ...pkg, hidden: !currentHidden });
  }

  return (
    <section className="library">
      {error ? <p className="error-banner">{error}</p> : null}
      {feedback ? <p className="feedback-toast">{feedback}</p> : null}
      <div className="library-header">
        <div>
          <p className="eyebrow">Story Packages</p>
          <h1>故事管理台</h1>
          <p className="muted">故事包是可插拔插件，只包含剧情、角色、技能和 Markdown 知识库。</p>
        </div>
        <div className="library-actions">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="新故事名称"
            aria-label="新故事名称"
          />
          <button onClick={() => void handleCreate()}><Plus size={17} /> 新建故事</button>
          {defaultStory ? (
            <button onClick={() => void start(defaultStory.id)}><MonitorPlay size={17} /> 进入展示界面</button>
          ) : null}
          <a
            className="ghost-button template-download-link"
            href="/ai-story-package-draft-template.txt"
            download="ai-story-package-draft-template.txt"
          >
            <FileText size={17} /> 下载 AI 模板
          </a>
          <button className="ghost-button" onClick={() => showImport()}><FileUp size={17} /> 导入</button>
          <button
            className={`ghost-button ${showHidden ? "active" : ""}`}
            onClick={() => setShowHidden(!showHidden)}
            title={showHidden ? "隐藏已归档的故事" : "显示已归档的故事"}
          >
            {showHidden ? <EyeOff size={17} /> : <Eye size={17} />}
            {showHidden ? "隐藏归档" : "显示归档"}
          </button>
        </div>
      </div>

      {storyPackages.length === 0 ? (
        <p className="empty-state" style={{ padding: 48, textAlign: "center" }}>暂无故事包，请新建或导入。</p>
      ) : (
        <div className="story-grid">
          {storyPackages.map((storyPackage) => (
            <article
              className={`story-card ${storyPackage.hidden ? "hidden-package" : ""}`}
              key={storyPackage.id}
            >
              {storyPackage.thumbnail ? (
                <img className="story-card-thumb" src={`${storyPackage.thumbnail}?t=${storyPackage.updatedAt ?? Date.now()}`} alt={storyPackage.title} loading="lazy" decoding="async" />
              ) : (
                <div className="story-card-thumb-placeholder">
                  <span style={{ fontSize: "2rem", opacity: 0.4 }}>📦</span>
                </div>
              )}
              <div>
                <h2>
                  {storyPackage.title}
                  {storyPackage.id === DEFAULT_PACKAGE_ID ? <span className="default-badge"><Star size={10} /> 默认</span> : null}
                  {storyPackage.hidden ? <span className="hidden-badge">已归档</span> : null}
                </h2>
                <p>{storyPackage.description}</p>
              </div>
              <dl>
                <div><dt>角色</dt><dd>{storyPackage.characters.length}</dd></div>
                <div><dt>招数</dt><dd>{storyPackage.skills.length}</dd></div>
                <div><dt>阶段</dt><dd>{storyPackage.scenario.currentStage}</dd></div>
                <div><dt>更新</dt><dd>{fmtDate(storyPackage.updatedAt)}</dd></div>
              </dl>
              <div className="card-actions">
                <button className="primary-wide" onClick={() => void start(storyPackage.id)}><MonitorPlay size={17} /> 进入展示界面</button>
                <button className="ghost-button" onClick={() => editStoryPackage(storyPackage.id)}><Pencil size={17} /> 编辑</button>
                <button className="ghost-button" onClick={() => downloadStoryPackage(storyPackage.id)}><Download size={17} /> 导出</button>
                {storyPackage.id !== DEFAULT_PACKAGE_ID && (
                  <button
                    className="ghost-button"
                    onClick={() => void handleToggleHidden(storyPackage.id, storyPackage.hidden ?? false)}
                    title={storyPackage.hidden ? "取消归档" : "归档故事"}
                  >
                    {storyPackage.hidden ? <Eye size={17} /> : <EyeOff size={17} />}
                  </button>
                )}
                {storyPackage.id !== DEFAULT_PACKAGE_ID && (
                  <button className="danger-button" onClick={() => handleDelete(storyPackage.id, storyPackage.title)}><Trash2 size={17} /> 删除</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
