import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  Circle,
  Download,
  FileText,
  GitBranch,
  HelpCircle,
  Music2,
  Palette,
  PlayCircle,
  Save,
  Trash2,
  Users
} from "lucide-react";
import { CharacterConfigPanel } from "./CharacterConfigPanel.js";
import { PromptRulesPanel } from "./PromptRulesPanel.js";
import { PerformanceConfigPanel } from "./PerformanceConfigPanel.js";
import { StorySettingPanel } from "./StorySettingPanel.js";
import { UiConfigPanel } from "./UiConfigPanel.js";
import { useGameStore } from "../../../store/gameStore.js";
import { deleteThumbnail, downloadStoryPackage, uploadThumbnail } from "../../../lib/adminApi.js";
import type { StoryPackage } from "@story-game/shared";

type WorkflowNodeId = "basic" | "scenario" | "characters" | "performances" | "rules" | "ui";

interface WorkflowNode {
  id: WorkflowNodeId;
  label: string;
  group: string;
  icon: React.ComponentType<{ size?: number }>;
  summary: string;
}

const workflowNodes: WorkflowNode[] = [
  { id: "basic", group: "任务包入口", label: "封面与说明", icon: BookOpen, summary: "玩家在故事库里首先看到的信息。" },
  { id: "scenario", group: "世界设定", label: "剧情设定", icon: GitBranch, summary: "定义世界、冲突、阶段和初始状态。" },
  { id: "characters", group: "角色与知识", label: "角色配置", icon: Users, summary: "决定谁会登场、如何说话、拥有哪些能力。" },
  { id: "performances", group: "角色与知识", label: "演出配置", icon: Music2, summary: "把知识库触发词绑定到音效或图片演出。" },
  { id: "rules", group: "LLM 发言流程", label: "提示词规则", icon: Bot, summary: "控制模型生成时必须遵守的工作流规则。" },
  { id: "ui", group: "玩家界面", label: "UI 配置", icon: Palette, summary: "决定玩家端看到的主题、文案和布局。" }
];

const nodeGuides: Record<WorkflowNodeId, {
  title: string;
  what: string;
  impact: string;
  advice: string;
  previewTitle: string;
  preview: (pkg: StoryPackage) => string;
}> = {
  basic: {
    title: "封面与说明",
    what: "这是任务包在后台和玩家故事库中的入口信息，用来帮助用户快速判断这个任务包讲什么、怎么玩。",
    impact: "影响故事库展示、导出文件名和管理识别；不会直接进入 LLM Prompt。",
    advice: "标题要短，说明要说清故事类型、主要冲突和玩法特点。缩略图最好展示真实场景或主要角色。",
    previewTitle: "故事库展示",
    preview: (pkg) => `${pkg.title}\n${pkg.description || "暂无说明"}`
  },
  scenario: {
    title: "剧情设定",
    what: "这是任务包的世界骨架：故事背景、当前目标、阶段列表、初始生命/内力和主设定提示词。",
    impact: "会进入 Prompt 的“故事包主设定”和“游戏状态”层，也会影响角色初始状态和阶段推进。",
    advice: "写清地点、矛盾、角色关系和每轮推进边界。不要把完整结局一次性写死，留出互动空间。",
    previewTitle: "进入 Prompt 的设定片段",
    preview: (pkg) => [
      `故事：${pkg.scenario.title}`,
      `当前阶段：${pkg.scenario.currentStage}`,
      `目标：${pkg.scenario.currentGoal}`,
      "",
      pkg.storySettingPrompt || pkg.scenario.premise
    ].join("\n")
  },
  characters: {
    title: "角色配置",
    what: "这里定义登场角色、人格提示词、技能、知识库关联和角色初始状态。",
    impact: "会影响发言人选择、角色主提示词、知识检索和技能结算。角色 ID 也会进入状态数据。",
    advice: "每个角色都要有清楚的立场、口吻、能力边界。技能和知识库要和角色绑定，避免模型混用。",
    previewTitle: "角色进入 Prompt 的方式",
    preview: (pkg) => pkg.characters.map((c) => `${c.name}(${c.role})\n${c.personaPrompt.slice(0, 160)}`).join("\n\n")
  },
  performances: {
    title: "演出配置",
    what: "把角色知识库中的粗体触发词绑定到音效或图片，LLM 回复命中时自动展示。",
    impact: "写入故事包 manifest 的 performances；玩家端收到角色回复后根据知识库粗体命中触发。",
    advice: "先在角色知识库里写清触发词和输出要求，再在这里填同样的触发词。音频文件建议 1~3 秒。",
    previewTitle: "已配置演出",
    preview: (pkg) => Object.entries(pkg.pluginManifest?.performances ?? {})
      .map(([id, performance]) => `${performance.name} (${id})\n${performance.renderer} · ${performance.trigger.type}`)
      .join("\n\n")
  },
  rules: {
    title: "提示词规则",
    what: "这是 LLM 每次发言前必须阅读的规则树，决定它能说什么、不能说什么、输出什么格式。",
    impact: "会进入 Prompt 的“故事包规则”层，直接影响模型是否越界、是否按 JSON 输出、是否保留状态行。",
    advice: "每条规则只解决一个问题。标题写目的，正文写约束和变量，例如 {currentCharacterName}。",
    previewTitle: "启用规则预览",
    preview: (pkg) => pkg.promptRules.filter((r) => r.enabled).map((r) => `【${r.title}】\n${r.content}`).join("\n\n")
  },
  ui: {
    title: "UI 配置",
    what: "这里只保留玩家端最常用的界面开关：模块显示、整体风格和头像呈现。",
    impact: "不会改变 LLM 的生成逻辑，只改变玩家看到的界面结构和视觉氛围。",
    advice: "先选择整体风格，再决定是否显示角色面板、快捷操作和自动继续。默认文案通常不需要改。",
    previewTitle: "玩家界面预览",
    preview: (pkg) => [
      `角色面板：${pkg.uiConfig?.layout?.showCharacterPanel === false ? "隐藏" : "显示"}`,
      `快捷操作：${pkg.uiConfig?.layout?.showQuickActions === false ? "隐藏" : "显示"}`,
      `头像：${pkg.uiConfig?.avatar?.style ?? "gradient"}`
    ].join("\n")
  }
};

export function StoryEditor() {
  const { editingPackageId, storyPackages, saveStoryPackage, deleteStoryPackage, showLibrary, error } = useGameStore();
  const [activeNodeId, setActiveNodeId] = useState<WorkflowNodeId>(readActiveNodeFromUrl);
  const storyPackage = useMemo(
    () => storyPackages.find((item) => item.id === editingPackageId) ?? null,
    [editingPackageId, storyPackages]
  );
  const [titleDraft, setTitleDraft] = useState(storyPackage?.title ?? "");
  const [descriptionDraft, setDescriptionDraft] = useState(storyPackage?.description ?? "");
  const [thumbnailSizeWarning, setThumbnailSizeWarning] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pkgRef = useRef(storyPackage);
  pkgRef.current = storyPackage;

  useEffect(() => {
    setTitleDraft(storyPackage?.title ?? "");
    setDescriptionDraft(storyPackage?.description ?? "");
    setThumbnailSizeWarning(false);
  }, [storyPackage?.id]);

  if (!storyPackage) {
    return <p className="empty-state">没有选中的故事包。</p>;
  }

  const pkg = storyPackage;
  const nextPackage = { ...pkg, title: titleDraft, description: descriptionDraft };
  const activeNode = workflowNodes.find((node) => node.id === activeNodeId) ?? workflowNodes[0];
  const ActiveIcon = activeNode.icon;
  const guide = nodeGuides[activeNode.id];
  const completion = getCompletion(pkg);

  async function handleThumbnailFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editingPackageId) return;
    if (file.size > 500 * 1024) {
      setThumbnailSizeWarning(true);
    } else {
      setThumbnailSizeWarning(false);
    }
    setIsUploading(true);
    try {
      const result = await uploadThumbnail(editingPackageId, file);
      const currentState = useGameStore.getState();
      const currentPkg = currentState.storyPackages.find(p => p.id === editingPackageId);
      if (currentPkg) {
        await currentState.saveStoryPackage({ ...currentPkg, thumbnail: result.thumbnail });
      }
      setThumbnailSizeWarning(false);
    } catch (err) {
      useGameStore.setState({ error: err instanceof Error ? err.message : "缩略图上传失败" });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleThumbnailRemove() {
    if (!editingPackageId) return;
    setIsUploading(true);
    try {
      await deleteThumbnail(editingPackageId);
      const currentState = useGameStore.getState();
      const currentPkg = currentState.storyPackages.find(p => p.id === editingPackageId);
      if (currentPkg) {
        await currentState.saveStoryPackage({ ...currentPkg, thumbnail: "" });
      }
    } catch (err) {
      useGameStore.setState({ error: err instanceof Error ? err.message : "缩略图删除失败" });
    } finally {
      setIsUploading(false);
    }
  }

  function handleSave() { void saveStoryPackage(nextPackage); }
  function handleExport() { if (editingPackageId) downloadStoryPackage(editingPackageId); }
  function handleDelete() {
    if (!confirm("确定要删除这个故事包吗？此操作不可撤销。")) return;
    void deleteStoryPackage(pkg.id).then(() => showLibrary());
  }
  function handleNodeSelect(nodeId: WorkflowNodeId) {
    setActiveNodeId(nodeId);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", nodeId);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <section className="editor-page">
      {/* Header */}
      <header className="editor-header">
        <div>
          <p className="editor-eyebrow">TASK PACKAGE WORKFLOW</p>
          <h1 className="editor-title">{pkg.title}</h1>
        </div>
        {error && <p className="error-banner" style={{ marginTop: 8 }}>{error}</p>}
        <div className="editor-header-actions">
          <button className="admin-save-button" onClick={handleSave}><Save size={16} /> 保存</button>
          <button className="btn-secondary" onClick={handleExport}><Download size={16} /> 导出</button>
          <button className="btn-danger" onClick={handleDelete}><Trash2 size={16} /> 删除</button>
        </div>
      </header>

      <section className="workflow-summary" aria-label="任务包完成度">
        {completion.map((item) => (
          <div className="workflow-summary-item" key={item.label}>
            <span className={`workflow-summary-dot ${item.done ? "done" : ""}`} />
            <span>{item.label}</span>
          </div>
        ))}
      </section>

      <div className="workflow-editor-shell">
        <aside className="workflow-tree" aria-label="任务包流程树">
          <div className="workflow-tree-header">
            <GitBranch size={18} />
            <span>任务包运行流程</span>
          </div>
          {groupWorkflowNodes(workflowNodes).map(([group, nodes]) => (
            <div className="workflow-group" key={group}>
              <div className="workflow-group-title">
                <ChevronDown size={14} />
                {group}
              </div>
              {nodes.map((node) => {
                const Icon = node.icon;
                const nodeDone = isNodeComplete(node.id, pkg);
                return (
                  <button
                    key={node.id}
                    className={`workflow-node ${activeNodeId === node.id ? "active" : ""}`}
                    onClick={() => handleNodeSelect(node.id)}
                    aria-current={activeNodeId === node.id ? "page" : undefined}
                  >
                    <span className="workflow-node-line" aria-hidden="true" />
                    <span className="workflow-node-icon"><Icon size={17} /></span>
                    <span className="workflow-node-copy">
                      <strong>{node.label}</strong>
                      <small>{node.summary}</small>
                    </span>
                    {nodeDone ? <CheckCircle2 className="workflow-node-status done" size={16} /> : <Circle className="workflow-node-status" size={16} />}
                  </button>
                );
              })}
            </div>
          ))}
        </aside>

        <main className="workflow-node-panel" role="tabpanel" aria-label={activeNode.label}>
          <div className="workflow-node-panel-header">
            <span className="workflow-panel-icon"><ActiveIcon size={20} /></span>
            <div>
              <p className="workflow-panel-kicker">{activeNode.group}</p>
              <h2>{activeNode.label}</h2>
            </div>
          </div>
          {activeNodeId === "basic" && (
            <div className="editor-card compact">
              <div className="editor-card-left">
                <label className="form-field">
                  <span className="form-label">故事包标题</span>
                  <input
                    className="form-input"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    placeholder="输入故事包标题"
                  />
                </label>

                <label className="form-field">
                  <span className="form-label">故事说明</span>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    value={descriptionDraft}
                    onChange={(e) => setDescriptionDraft(e.target.value)}
                    placeholder="简要描述这个故事包的内容和玩法"
                  />
                </label>

                <p className="form-hint">标题和说明由顶部「保存」按钮统一保存，缩略图即时保存。</p>
              </div>

              <div className="editor-card-right">
                <span className="form-label">缩略图</span>
                {pkg.thumbnail ? (
                  <div className="thumbnail-preview-wrap">
                    <img
                      className="thumbnail-preview-img"
                      src={`${pkg.thumbnail}?t=${pkg.updatedAt ?? Date.now()}`}
                      alt="缩略图"
                      onClick={() => fileInputRef.current?.click()}
                      title="点击更换缩略图"
                    />
                    <div className="thumbnail-actions">
                      <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
                        更换缩略图
                      </button>
                      <button className="btn-secondary" onClick={handleThumbnailRemove}>
                        移除
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="thumbnail-zone" onClick={() => fileInputRef.current?.click()}>
                    <span className="thumbnail-zone-icon">+</span>
                    <p className="thumbnail-zone-text">点击上传缩略图</p>
                    <p className="thumbnail-zone-hint">16:9 比例，不超过 500KB</p>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleThumbnailFile} />
                {thumbnailSizeWarning && (
                  <p style={{ color: "#D97706", fontSize: "0.82rem", marginTop: 4 }}>图片超过 500KB，建议压缩后再上传</p>
                )}
                {isUploading && (
                  <p style={{ color: "#64748b", fontSize: "0.82rem", marginTop: 4 }}>正在上传...</p>
                )}
              </div>
            </div>
          )}
          {activeNodeId === "characters" && <CharacterConfigPanel />}
          {activeNodeId === "performances" && <PerformanceConfigPanel />}
          {activeNodeId === "scenario" && <StorySettingPanel />}
          {activeNodeId === "rules" && <PromptRulesPanel />}
          {activeNodeId === "ui" && <UiConfigPanel />}
        </main>

        <aside className="workflow-inspector" aria-label="说明和预览">
          <section className="inspector-section intro">
            <div className="inspector-title">
              <HelpCircle size={18} />
              <h3>{guide.title}</h3>
            </div>
            <dl className="guide-list">
              <div>
                <dt>这是什么？</dt>
                <dd>{guide.what}</dd>
              </div>
              <div>
                <dt>影响哪里？</dt>
                <dd>{guide.impact}</dd>
              </div>
              <div>
                <dt>怎么写？</dt>
                <dd>{guide.advice}</dd>
              </div>
            </dl>
          </section>

          <section className="inspector-section flow">
            <div className="inspector-title">
              <PlayCircle size={18} />
              <h3>运行位置</h3>
            </div>
            <ol className="runtime-flow">
              {runtimeSteps(activeNode.id).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          <section className="inspector-section preview">
            <div className="inspector-title">
              <FileText size={18} />
              <h3>{guide.previewTitle}</h3>
            </div>
            <pre>{guide.preview(pkg) || "暂无内容"}</pre>
          </section>
        </aside>
      </div>
    </section>
  );
}

function groupWorkflowNodes(nodes: WorkflowNode[]) {
  return nodes.reduce<[string, WorkflowNode[]][]>((groups, node) => {
    const group = groups.find(([name]) => name === node.group);
    if (group) group[1].push(node);
    else groups.push([node.group, [node]]);
    return groups;
  }, []);
}

function isNodeComplete(id: WorkflowNodeId, pkg: StoryPackage) {
  if (id === "basic") return Boolean(pkg.title && pkg.description);
  if (id === "scenario") return Boolean(pkg.scenario.title && pkg.scenario.currentGoal && pkg.storySettingPrompt);
  if (id === "characters") return pkg.characters.length > 0;
  if (id === "performances") return Object.keys(pkg.pluginManifest?.performances ?? {}).length > 0;
  if (id === "rules") return pkg.promptRules.some((rule) => rule.enabled);
  if (id === "ui") return Boolean(pkg.uiConfig);
  return false;
}

function getCompletion(pkg: StoryPackage) {
  return [
    { label: "入口", done: isNodeComplete("basic", pkg) },
    { label: "世界", done: isNodeComplete("scenario", pkg) },
    { label: "角色", done: isNodeComplete("characters", pkg) },
    { label: "演出", done: isNodeComplete("performances", pkg) },
    { label: "规则", done: isNodeComplete("rules", pkg) },
    { label: "界面", done: isNodeComplete("ui", pkg) }
  ];
}

function runtimeSteps(id: WorkflowNodeId) {
  const common = ["玩家选择任务包", "创建会话", "选择发言角色", "组装 Prompt", "LLM 生成", "规则校验", "状态结算", "玩家界面展示"];
  const focus: Record<WorkflowNodeId, string[]> = {
    basic: ["玩家选择任务包"],
    scenario: ["创建会话", "组装 Prompt", "状态结算"],
    characters: ["选择发言角色", "组装 Prompt", "状态结算"],
    performances: ["玩家界面展示"],
    rules: ["组装 Prompt", "LLM 生成", "规则校验"],
    ui: ["玩家界面展示"]
  };
  return common.map((step) => focus[id].includes(step) ? `${step} · 当前节点影响` : step);
}

function readActiveNodeFromUrl(): WorkflowNodeId {
  const tab = new URLSearchParams(window.location.search).get("tab");
  return isWorkflowNodeId(tab) ? tab : "basic";
}

function isWorkflowNodeId(value: string | null): value is WorkflowNodeId {
  return Boolean(value && workflowNodes.some((node) => node.id === value));
}
