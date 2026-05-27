import { create } from "zustand";
import type { Character, GameState, KnowledgeDocument, LlmConfig, LlmConfigView, Message, Scenario, Skill, StoryPackage } from "@story-game/shared";
import * as adminApi from "../lib/adminApi.js";
import * as gameApi from "../lib/gameApi.js";
import type { SaveMeta } from "../lib/gameApi.js";

type AppView = "library" | "editor" | "play" | "import" | "model-config" | "sessions" | "session-detail" | "runtime" | "audit-log";

interface GameStore {
  view: AppView;
  storyPackages: StoryPackage[];
  editingPackageId: string | null;
  sessionId: string | null;
  gameState: GameState | null;
  characters: Character[];
  skills: Skill[];
  knowledgeDocuments: KnowledgeDocument[];
  messages: Message[];
  selectedCharacterId: string | null;
  debug: Record<string, unknown> | null;
  llmConfig: LlmConfigView | null;
  isSending: boolean;
  isAutoPlaying: boolean;
  error: string | null;
  streamingContent: string | null;
  isStreaming: boolean;
  streamingSpeakerId: string | null;
  streamingSpeakerName: string | null;
  saves: SaveMeta[];
  loadStoryPackages: (includeHidden?: boolean) => Promise<void>;
  loadLlmConfig: () => Promise<void>;
  saveLlmConfig: (config: LlmConfig) => Promise<void>;
  showLibrary: () => void;
  editStoryPackage: (id: string) => void;
  createStoryPackage: (title: string) => Promise<void>;
  saveStoryPackage: (storyPackage: StoryPackage) => Promise<void>;
  importStoryPackage: (storyPackage: StoryPackage) => Promise<void>;
  deleteStoryPackage: (id: string) => Promise<void>;
  start: (storyPackageId: string) => Promise<void>;
  showImport: () => void;
  showModelConfig: () => void;
  showSessions: () => void;
  showRuntime: () => void;
  showAuditLog: () => void;
  selectCharacter: (id: string | null) => void;
  send: (text: string) => Promise<void>;
  sendStream: (text: string) => Promise<void>;
  continueStory: () => Promise<void>;
  setAutoPlay: (enabled: boolean) => void;
  saveScenario: (scenario: Scenario) => Promise<void>;
  saveCharacter: (character: Character) => Promise<void>;
  saveKnowledgeDocuments: (documents: KnowledgeDocument[], characters?: Character[]) => Promise<void>;
  loadSaves: (storyPackageId: string) => Promise<void>;
  saveCurrentSession: (label: string) => Promise<void>;
  loadSavedSession: (storyPackageId: string, saveId: string) => Promise<void>;
  deleteSavedSession: (storyPackageId: string, saveId: string) => Promise<void>;
}

export const useGameStore = create<GameStore>((set, get) => ({
  view: "library",
  storyPackages: [],
  editingPackageId: null,
  sessionId: null,
  gameState: null,
  characters: [],
  skills: [],
  knowledgeDocuments: [],
  messages: [],
  selectedCharacterId: null,
  debug: null,
  llmConfig: null,
  isSending: false,
  isAutoPlaying: false,
  error: null,
  streamingContent: null,
  isStreaming: false,
  streamingSpeakerId: null,
  streamingSpeakerName: null,
  saves: [],
  async loadStoryPackages(includeHidden?: boolean) {
    set({ error: null });
    try {
      const result = await adminApi.listStoryPackages(includeHidden);
      set({ storyPackages: result.storyPackages });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "加载故事列表失败" });
    }
  },
  async loadLlmConfig() {
    try {
      const result = await adminApi.getLlmConfig();
      set({ llmConfig: result.llmConfig });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "加载大模型配置失败" });
    }
  },
  async saveLlmConfig(config) {
    const result = await adminApi.updateLlmConfig(config);
    set({ llmConfig: result.llmConfig });
  },
  showLibrary() {
    navigateTo("/admin/story-packages");
    set({ view: "library", editingPackageId: null, isAutoPlaying: false });
  },
  editStoryPackage(id) {
    const storyPackage = get().storyPackages.find((item) => item.id === id);
    if (!storyPackage) return;
    navigateTo("/admin/story-packages/" + id);
    set({
      view: "editor",
      editingPackageId: id,
      characters: storyPackage.characters,
      skills: storyPackage.skills,
      knowledgeDocuments: storyPackage.knowledgeDocuments,
      gameState: null,
      debug: { debugConfig: storyPackage.debugConfig },
      messages: []
    });
  },
  async createStoryPackage(title) {
    set({ error: null });
    const result = await adminApi.createStoryPackage(title, get().storyPackages[0]?.id);
    set({ storyPackages: result.storyPackages, view: "library", editingPackageId: null });
  },
  async saveStoryPackage(storyPackage) {
    const result = await adminApi.updateStoryPackage(storyPackage);
    set({
      storyPackages: result.storyPackages,
      editingPackageId: result.storyPackage.id,
      characters: result.storyPackage.characters,
      skills: result.storyPackage.skills,
      knowledgeDocuments: result.storyPackage.knowledgeDocuments,
    });
  },
  async importStoryPackage(storyPackage) {
    const result = await adminApi.updateStoryPackage(storyPackage);
    set({ storyPackages: result.storyPackages, view: "editor", editingPackageId: result.storyPackage.id });
    get().editStoryPackage(result.storyPackage.id);
  },
  async deleteStoryPackage(id) {
    set({ error: null });
    const result = await adminApi.deleteStoryPackage(id);
    set({ storyPackages: result.storyPackages, view: "library", editingPackageId: null, error: null });
  },
  async start(storyPackageId) {
    set({ error: null, isAutoPlaying: false });
    const payload = await gameApi.createSession(storyPackageId);
    navigateTo("/");
    set({ ...payload, messages: [], debug: null, view: "play", editingPackageId: storyPackageId });
  },
  showImport() {
    navigateTo("/admin/story-packages/import");
    set({ view: "import" });
  },
  showModelConfig() {
    navigateTo("/admin/model-config");
    set({ view: "model-config" });
  },
  showSessions() {
    navigateTo("/admin/sessions");
    set({ view: "sessions" });
  },
  showRuntime() {
    navigateTo("/admin/runtime");
    set({ view: "runtime" });
  },
  showAuditLog() {
    navigateTo("/admin/audit-log");
    set({ view: "audit-log" });
  },
  selectCharacter(id) {
    set({ selectedCharacterId: id });
  },
  async send(text) {
    const { sessionId, selectedCharacterId } = get();
    if (!sessionId || !text.trim()) return;
    set({ isSending: true, error: null });
    try {
      const result = await gameApi.sendMessage(sessionId, {
        text,
        targetCharacterId: selectedCharacterId as never
      });
      const userMessage: Message = {
        id: `local_${Date.now()}`,
        sessionId,
        role: "user",
        speakerId: null,
        content: text,
        usedSkills: [],
        stateDelta: {},
        createdAt: new Date().toISOString()
      };
      set((state) => ({
        messages: [...state.messages, userMessage, result.message],
        gameState: result.gameState,
        debug: result.debug,
        selectedCharacterId: null
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "发送失败", isAutoPlaying: false });
    } finally {
      set({ isSending: false });
    }
  },
  async sendStream(text) {
    const { sessionId, selectedCharacterId, characters } = get();
    if (!sessionId || !text.trim()) return;
    const localUserMessage: Message = {
      id: `local_${Date.now()}`,
      sessionId,
      role: "user",
      speakerId: null,
      content: text,
      usedSkills: [],
      stateDelta: {},
      createdAt: new Date().toISOString()
    };
    set((state) => ({
      isSending: true,
      isStreaming: true,
      streamingContent: "",
      streamingSpeakerId: null,
      streamingSpeakerName: null,
      error: null,
      messages: [...state.messages, localUserMessage]
    }));
    try {
      await gameApi.sendMessageStream(
        sessionId,
        { text, targetCharacterId: selectedCharacterId as never },
        (tokenEvent) => {
          set((state) => ({
            streamingContent: (state.streamingContent ?? "") + tokenEvent.token,
            streamingSpeakerId: tokenEvent.speakerId
          }));
        },
        (metaEvent) => {
          set({
            streamingSpeakerId: metaEvent.speakerId,
            streamingSpeakerName: metaEvent.speakerName
          });
        },
        (doneEvent) => {
          set((state) => ({
            messages: [...state.messages, doneEvent.message],
            gameState: doneEvent.gameState,
            debug: doneEvent.debug,
            streamingContent: null,
            isStreaming: false,
            streamingSpeakerId: null,
            streamingSpeakerName: null,
            selectedCharacterId: null
          }));
        }
      );
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "发送失败", isAutoPlaying: false, isStreaming: false, streamingContent: null });
    } finally {
      set({ isSending: false });
    }
  },
  async continueStory() {
    await get().sendStream("继续");
  },
  setAutoPlay(enabled) {
    set({ isAutoPlaying: enabled });
  },
  async saveScenario(scenario) {
    const { editingPackageId, storyPackages } = get();
    if (!editingPackageId) return;
    const storyPackage = storyPackages.find((item) => item.id === editingPackageId);
    if (!storyPackage) return;
    const next = { ...storyPackage, title: scenario.title, scenario };
    await get().saveStoryPackage(next);
  },
  async saveCharacter(character) {
    const { editingPackageId, storyPackages, characters, knowledgeDocuments } = get();
    if (!editingPackageId) return;
    const storyPackage = storyPackages.find((item) => item.id === editingPackageId);
    if (!storyPackage) return;
    const nextCharacters = characters.map((item) => (item.id === character.id ? character : item));
    const next = { ...storyPackage, characters: nextCharacters, knowledgeDocuments };
    await get().saveStoryPackage(next);
    set({ characters: nextCharacters });
  },
  async saveKnowledgeDocuments(documents, characters) {
    const { editingPackageId, storyPackages } = get();
    if (!editingPackageId) return;
    const storyPackage = storyPackages.find((item) => item.id === editingPackageId);
    if (!storyPackage) return;
    const nextCharacters = characters ?? get().characters;
    const next = { ...storyPackage, characters: nextCharacters, knowledgeDocuments: documents };
    await get().saveStoryPackage(next);
    set({ knowledgeDocuments: documents, characters: nextCharacters });
  },
  async loadSaves(storyPackageId) {
    try {
      const saves = await gameApi.listSaves(storyPackageId);
      set({ saves });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "加载存档列表失败" });
    }
  },
  async saveCurrentSession(label) {
    const { sessionId, editingPackageId } = get();
    if (!sessionId || !editingPackageId) return;
    await gameApi.saveSession(editingPackageId, sessionId, label);
    await get().loadSaves(editingPackageId);
  },
  async loadSavedSession(storyPackageId, saveId) {
    set({ error: null, isAutoPlaying: false });
    const payload = await gameApi.loadSession(storyPackageId, saveId);
    navigateTo("/");
    set({ ...payload, messages: payload.messages ?? [], debug: null, view: "play", editingPackageId: storyPackageId, saves: [] });
  },
  async deleteSavedSession(storyPackageId, saveId) {
    await gameApi.deleteSave(storyPackageId, saveId);
    await get().loadSaves(storyPackageId);
  }
}));

function navigateTo(path: string) {
  if (window.location.pathname === path) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("app:navigate"));
}
