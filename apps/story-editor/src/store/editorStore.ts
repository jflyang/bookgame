import { create } from "zustand";
import type { StoryPackage, Character, Skill, KnowledgeDocument, StoryPromptRule, Scenario, ScenarioStageDetail } from "@story-game/shared";
import * as api from "../lib/api.js";
import type { EditorState } from "../lib/api.js";
import { useFlowStore } from "./flowStore.js";

interface EditorStore {
  // State
  loaded: boolean;
  storyDir: string;
  storyPackage: StoryPackage | null;
  manifest: Record<string, unknown> | null;
  mediaFiles: string[];
  storySetting: string;
  dirty: boolean;
  saving: boolean;
  error: string | null;

  // Tab
  activeTab: string;

  // AI
  aiLoading: boolean;
  aiResult: string | null;

  // Server upload
  serverUrl: string;
  uploadResult: string | null;

  // Actions
  openPackage: (path: string) => Promise<void>;
  reload: () => Promise<void>;
  save: () => Promise<void>;
  exportZip: () => Promise<void>;
  upload: (url: string) => Promise<void>;

  setActiveTab: (tab: string) => void;

  // Field-level edits
  updateScenario: (scenario: Scenario) => void;
  updateCharacters: (characters: Character[]) => void;
  updateCharacter: (character: Character) => void;
  updateSkills: (skills: Skill[]) => void;
  updateSkill: (skill: Skill) => void;
  updateKnowledgeDocs: (docs: KnowledgeDocument[]) => void;
  updateKnowledgeDoc: (doc: KnowledgeDocument) => void;
  updatePromptRules: (rules: StoryPromptRule[]) => void;
  updatePromptRule: (rule: StoryPromptRule) => void;
  updateStageDetail: (stage: ScenarioStageDetail) => void;
  updateManifest: (manifest: Record<string, unknown>) => void;
  updateStorySetting: (content: string) => void;

  // AI
  aiSuggest: (context: string, instruction: string, dataType: string, currentData?: unknown) => Promise<void>;
  clearAiResult: () => void;

  // Config
  setServerUrl: (url: string) => void;
  clearError: () => void;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  loaded: false,
  storyDir: "",
  storyPackage: null,
  manifest: null,
  mediaFiles: [],
  storySetting: "",
  dirty: false,
  saving: false,
  error: null,
  activeTab: "flow",
  aiLoading: false,
  aiResult: null,
  serverUrl: "http://localhost:4000",
  uploadResult: null,

  async openPackage(path: string) {
    set({ error: null });
    try {
      const state = await api.openPackage(path);
      set({
        loaded: true,
        storyDir: state.dir,
        storyPackage: state.storyPackage,
        manifest: state.manifest,
        mediaFiles: state.mediaFiles,
        dirty: false,
        error: null,
      });

      // Initialize flow editor
      const pkg = state.storyPackage;
      if (state.flowNodes && state.flowEdges && pkg.modules) {
        // Use pre-built ReactFlow nodes/edges from flow.json (preserves manual layout)
        const flowId = pkg.flow?.id || "flow_default";
        const flowTitle = pkg.flow?.title || pkg.title;
        useFlowStore.getState().initFromNodesEdges(
          state.flowNodes as any, state.flowEdges as any, pkg.modules, flowId, flowTitle
        );
      } else if (pkg.flow && pkg.modules) {
        // Fallback: generate layout from FlowDefinition
        useFlowStore.getState().initFromData(pkg.flow, pkg.modules);
      }
    } catch (err) {
      set({ error: (err as Error).message, loaded: false });
    }
  },

  async reload() {
    const dir = get().storyDir;
    if (!dir) return;
    await get().openPackage(dir);
  },

  async save() {
    let pkg = get().storyPackage;
    if (!pkg) return;

    // Merge flow editor data into story package
    const flowStore = useFlowStore.getState();
    if (flowStore.initialized) {
      try {
        const flowData = flowStore.getFlowData();
        pkg = { ...pkg, flow: flowData.flow, modules: flowData.modules };
      } catch (err) {
        console.warn("Failed to serialize flow data:", err);
      }
    }

    set({ saving: true, error: null });
    try {
      await api.saveStoryPackage(pkg);
      // Save ReactFlow nodes/edges to flow.json (editor format, preserves manual layout)
      if (flowStore.initialized) {
        await api.saveFlowNodesEdges(flowStore.nodes, flowStore.edges, flowStore.modules);
      }
      if (get().manifest) await api.saveManifest(get().manifest!);
      if (get().storySetting) await api.saveStorySetting(get().storySetting);
      set({ dirty: false, saving: false });
    } catch (err) {
      set({ error: (err as Error).message, saving: false });
    }
  },

  async exportZip() {
    set({ error: null });
    try {
      await api.exportZip();
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  async upload(url: string) {
    set({ error: null, uploadResult: null });
    try {
      const result = await api.uploadToServer(url);
      set({ uploadResult: result.ok ? "上传成功！" : `上传失败: ${result.message}` });
    } catch (err) {
      set({ uploadResult: `上传失败: ${(err as Error).message}` });
    }
  },

  setActiveTab(tab: string) { set({ activeTab: tab }); },

  updateScenario(scenario: Scenario) {
    const pkg = get().storyPackage;
    if (!pkg) return;
    set({ storyPackage: { ...pkg, scenario, id: scenario.id, title: scenario.title }, dirty: true });
  },

  updateCharacters(characters: Character[]) {
    const pkg = get().storyPackage;
    if (!pkg) return;
    set({ storyPackage: { ...pkg, characters }, dirty: true });
  },

  updateCharacter(character: Character) {
    const pkg = get().storyPackage;
    if (!pkg) return;
    const chars = pkg.characters.map((c) => (c.id === character.id ? character : c));
    set({ storyPackage: { ...pkg, characters: chars }, dirty: true });
  },

  updateSkills(skills: Skill[]) {
    const pkg = get().storyPackage;
    if (!pkg) return;
    set({ storyPackage: { ...pkg, skills }, dirty: true });
  },

  updateSkill(skill: Skill) {
    const pkg = get().storyPackage;
    if (!pkg) return;
    const skills = pkg.skills.map((s) => (s.id === skill.id ? skill : s));
    set({ storyPackage: { ...pkg, skills }, dirty: true });
  },

  updateKnowledgeDocs(docs: KnowledgeDocument[]) {
    const pkg = get().storyPackage;
    if (!pkg) return;
    set({ storyPackage: { ...pkg, knowledgeDocuments: docs }, dirty: true });
  },

  updateKnowledgeDoc(doc: KnowledgeDocument) {
    const pkg = get().storyPackage;
    if (!pkg) return;
    const docs = pkg.knowledgeDocuments.map((d) => (d.id === doc.id ? doc : d));
    set({ storyPackage: { ...pkg, knowledgeDocuments: docs }, dirty: true });
  },

  updatePromptRules(rules: StoryPromptRule[]) {
    const pkg = get().storyPackage;
    if (!pkg) return;
    set({ storyPackage: { ...pkg, promptRules: rules }, dirty: true });
  },

  updatePromptRule(rule: StoryPromptRule) {
    const pkg = get().storyPackage;
    if (!pkg) return;
    const rules = pkg.promptRules.map((r) => (r.id === rule.id ? rule : r));
    set({ storyPackage: { ...pkg, promptRules: rules }, dirty: true });
  },

  updateStageDetail(stage: ScenarioStageDetail) {
    const pkg = get().storyPackage;
    if (!pkg) return;
    const details = (pkg.scenario.stageDetails || []).map((s) => (s.id === stage.id ? stage : s));
    set({ storyPackage: { ...pkg, scenario: { ...pkg.scenario, stageDetails: details } }, dirty: true });
  },

  updateManifest(manifest: Record<string, unknown>) {
    set({ manifest, dirty: true });
  },

  updateStorySetting(content: string) {
    set({ storySetting: content, dirty: true });
  },

  async aiSuggest(context: string, instruction: string, dataType: string, currentData?: unknown) {
    set({ aiLoading: true, aiResult: null });
    try {
      const result = await api.aiSuggest(context, instruction, currentData, dataType);
      const hasParsed = result.parsed ? "\n\n--- 解析出的 JSON ---\n" + JSON.stringify(result.parsed, null, 2) : "";
      set({ aiLoading: false, aiResult: result.suggestion + hasParsed });
    } catch (err) {
      set({ aiLoading: false, aiResult: `AI 请求失败: ${(err as Error).message}` });
    }
  },

  clearAiResult() {
    set({ aiResult: null });
  },

  setServerUrl(url: string) { set({ serverUrl: url }); },
  clearError() { set({ error: null }); },
}));
