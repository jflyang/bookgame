import { useState, useEffect } from "react";
import { useEditorStore } from "../store/editorStore.js";

export function StorySettingEditor() {
  const { storyPackage, storySetting, updateStorySetting } = useEditorStore();
  const [content, setContent] = useState(storySetting || storyPackage?.storySettingPrompt || "");

  useEffect(() => {
    setContent(storySetting || storyPackage?.storySettingPrompt || "");
  }, [storyPackage?.storySettingPrompt, storySetting]);

  function handleSave() { updateStorySetting(content); }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>故事设定</h2>
          {storyPackage?.storySettingPrompt && !storySetting && (
            <span className="faint">当前显示 story.json 已有设定</span>
          )}
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleSave}>保存设定</button>
      </div>

      <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div className="card-section-title" style={{ marginTop: 0 }}>世界观 Prompt</div>
        <p className="muted">LLM 收到的世界观背景文本 — 灌输世界观、核心冲突、角色关系</p>
        <textarea
          className="input mono"
          rows={22}
          style={{ flex: 1, minHeight: 400 }}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="在此编写故事世界观设定..."
        />
      </div>
    </div>
  );
}
