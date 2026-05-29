import { create } from "zustand";
import type { TtsConfigView } from "@story-game/shared";
import * as ttsApi from "../lib/ttsApi.js";

interface AudioState {
  /** Global TTS on/off */
  ttsEnabled: boolean;
  /** Auto-play voice for new messages */
  autoPlay: boolean;
  /** Volume 0-1 */
  volume: number;
  /** Currently playing message ID */
  currentPlayingId: string | null;
  /** Loading state per message ID */
  loadingIds: Set<string>;
  /** Cached audio URLs per message ID */
  audioCache: Map<string, string>;
  /** TTS service config (fetched from backend) */
  serviceConfig: TtsConfigView | null;
  /** Error message */
  error: string | null;

  // Actions
  loadConfig: () => Promise<void>;
  setEnabled: (enabled: boolean) => void;
  setAutoPlay: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  playMessage: (messageId: string, text: string, characterId: string, emotion?: string) => Promise<void>;
  stopPlaying: () => void;
  setCurrentPlaying: (id: string | null) => void;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  ttsEnabled: false,
  autoPlay: false,
  volume: 0.8,
  currentPlayingId: null,
  loadingIds: new Set(),
  audioCache: new Map(),
  serviceConfig: null,
  error: null,

  async loadConfig() {
    try {
      const config = await ttsApi.getTtsConfig();
      set({
        serviceConfig: config,
        ttsEnabled: config.enabled,
        error: null,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "加载 TTS 配置失败" });
    }
  },

  setEnabled(enabled) {
    set({ ttsEnabled: enabled });
  },

  setAutoPlay(enabled) {
    set({ autoPlay: enabled });
  },

  setVolume(volume) {
    set({ volume: Math.max(0, Math.min(1, volume)) });
  },

  async playMessage(messageId, text, characterId, emotion) {
    const { loadingIds, audioCache, ttsEnabled } = get();
    if (!ttsEnabled) return;

    // Already loading this message
    if (loadingIds.has(messageId)) return;

    // Check cache first
    const cached = audioCache.get(messageId);
    if (cached) {
      set({ currentPlayingId: messageId });
      return;
    }

    // Start loading
    const nextLoading = new Set(loadingIds);
    nextLoading.add(messageId);
    set({ loadingIds: nextLoading, error: null });

    try {
      const result = await ttsApi.synthesize(text, characterId, emotion);
      const audioUrl = ttsApi.resolveAudioUrl(result.audioUrl);

      const nextCache = new Map(get().audioCache);
      nextCache.set(messageId, audioUrl);

      const doneLoading = new Set(get().loadingIds);
      doneLoading.delete(messageId);

      set({
        audioCache: nextCache,
        loadingIds: doneLoading,
        currentPlayingId: messageId,
      });
    } catch (err) {
      const doneLoading = new Set(get().loadingIds);
      doneLoading.delete(messageId);
      set({
        loadingIds: doneLoading,
        error: err instanceof Error ? err.message : "语音合成失败",
      });
    }
  },

  stopPlaying() {
    set({ currentPlayingId: null });
  },

  setCurrentPlaying(id) {
    set({ currentPlayingId: id });
  },
}));
