import { useState } from "react";
import { Download, FileUp, MonitorPlay, Pencil, Plus, Trash2 } from "lucide-react";
import type { StoryPackage } from "@story-game/shared";
import { useGameStore } from "../../../store/gameStore.js";

export function StoryLibrary() {
  const { storyPackages, createStoryPackage, deleteStoryPackage, editStoryPackage, showImport, start } = useGameStore();
  const [title, setTitle] = useState("");
  const defaultStory = storyPackages[0];

  async function handleCreate() {
    const nextTitle = title.trim() || "新的互动故事";
    await createStoryPackage(nextTitle);
    setTitle("");
  }

  function exportPackage(storyPackage: StoryPackage) {
    const blob = new Blob([JSON.stringify(storyPackage, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${storyPackage.title}.story-package.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="library">
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
          <button className="ghost-button" onClick={() => showImport()}><FileUp size={17} /> 导入</button>
        </div>
      </div>

      <div className="story-grid">
        {storyPackages.map((storyPackage) => (
          <article className="story-card" key={storyPackage.id}>
            <div>
              <h2>{storyPackage.title}</h2>
              <p>{storyPackage.description}</p>
            </div>
            <dl>
              <div><dt>角色</dt><dd>{storyPackage.characters.length}</dd></div>
              <div><dt>招数</dt><dd>{storyPackage.skills.length}</dd></div>
              <div><dt>阶段</dt><dd>{storyPackage.scenario.currentStage}</dd></div>
            </dl>
            <div className="card-actions">
              <button className="primary-wide" onClick={() => void start(storyPackage.id)}><MonitorPlay size={17} /> 进入展示界面</button>
              <button className="ghost-button" onClick={() => editStoryPackage(storyPackage.id)}><Pencil size={17} /> 编辑</button>
              <button className="ghost-button" onClick={() => exportPackage(storyPackage)}><Download size={17} /> 导出</button>
              <button className="danger-button" onClick={() => void deleteStoryPackage(storyPackage.id)}><Trash2 size={17} /> 删除</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

