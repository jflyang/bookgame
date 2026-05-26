import { useEffect, useMemo, useState } from "react";
import { Download, Save, Trash2 } from "lucide-react";
import { CharacterConfigPanel } from "./CharacterConfigPanel.js";
import { DebugPanel } from "./DebugPanel.js";
import { PromptRulesPanel } from "./PromptRulesPanel.js";
import { StorySettingPanel } from "./StorySettingPanel.js";
import { UiConfigPanel } from "./UiConfigPanel.js";
import { useGameStore } from "../../../store/gameStore.js";

const tabs = [
  { id: "basic", label: "基本信息" },
  { id: "characters", label: "角色配置" },
  { id: "scenario", label: "剧情设定" },
  { id: "rules", label: "提示词规则" },
  { id: "ui", label: "UI 配置" },
  { id: "debug", label: "调试配置" },
];

export function StoryEditor() {
  const { editingPackageId, storyPackages, saveStoryPackage, deleteStoryPackage, showLibrary } = useGameStore();
  const [activeTab, setActiveTab] = useState<string>("basic");
  const storyPackage = useMemo(
    () => storyPackages.find((item) => item.id === editingPackageId) ?? null,
    [editingPackageId, storyPackages]
  );
  const [description, setDescription] = useState(storyPackage?.description ?? "");

  useEffect(() => {
    setDescription(storyPackage?.description ?? "");
  }, [storyPackage?.id, storyPackage?.description]);

  if (!storyPackage) {
    return <p className="empty-story">没有选中的故事包。</p>;
  }

  const pkg = storyPackage;
  const nextPackage = { ...pkg, description };

  function exportPackage() {
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${pkg.title}.story-package.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleDelete() {
    void deleteStoryPackage(pkg.id).then(() => {
      showLibrary();
    });
  }

  function renderTabContent() {
    switch (activeTab) {
      case "basic":
        return (
          <label className="panel package-description">
            故事说明
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
        );
      case "characters":
        return <CharacterConfigPanel />;
      case "scenario":
        return <StorySettingPanel />;
      case "rules":
        return <PromptRulesPanel />;
      case "ui":
        return <UiConfigPanel />;
      default:
        return <DebugPanel />;
    }
  }

  return (
    <section className="editor-workspace">
      <div className="editor-header">
        <div>
          <p className="eyebrow">Package Editor</p>
          <h1>{pkg.title}</h1>
        </div>
        <div className="editor-header-actions" style={{ display: "flex", gap: 8 }}>
          <button onClick={() => void saveStoryPackage(nextPackage)}><Save size={17} /> 保存</button>
          <button className="ghost-button" onClick={exportPackage}><Download size={17} /> 导出</button>
          <button className="danger-button" onClick={handleDelete}><Trash2 size={17} /> 删除</button>
        </div>
      </div>
      <div className="editor-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`editor-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {renderTabContent()}
      </div>
    </section>
  );
}
