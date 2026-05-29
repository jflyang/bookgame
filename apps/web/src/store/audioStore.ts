import { create } from "zustand";
import type { TtsConfigView } from "@story-game/shared";
import * as ttsApi from "../lib/ttsApi.js";

/** Single global Audio element for TTS playback */
let globalAudio: HTMLAudioElement | null = null;
let playId = 0; // monotonic ID to prevent stale callbacks

function playAudioElement(url: string, getState: () => AudioState) {
  // Stop any existing playback
  if (globalAudio) {
    globalAudio.pause();
    globalAudio.onended = null;
    globalAudio.onerror = null;
    globalAudio.src = "";
    globalAudio = null;
  }

  const thisPlayId = ++playId;
  const audio = new Audio(url);
  globalAudio = audio;
  const state = getState();
  audio.volume = state.volume;
  audio.playbackRate = state.playbackRate;

  const finish = () => {
    if (playId !== thisPlayId) return; // stale callback, ignore
    globalAudio = null;
    useAudioStore.setState({ currentPlayingId: null });
  };

  audio.onended = finish;
  audio.onerror = finish;
  audio.play().catch(finish);
}

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

  /** Playback speed (1.0 = normal, 1.2 = slightly faster) */
  playbackRate: number;

  /** Whether auto-read has finished for the current message (signals auto-continue can proceed) */
  autoReadDone: boolean;

  // Actions
  loadConfig: () => Promise<void>;
  setEnabled: (enabled: boolean) => void;
  setAutoPlay: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  playMessage: (messageId: string, text: string, characterId: string, emotion?: string) => Promise<void>;
  stopPlaying: () => void;
  setCurrentPlaying: (id: string | null) => void;
  setAutoReadDone: (done: boolean) => void;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  ttsEnabled: false,
  autoPlay: localStorage.getItem("play:ttsAutoPlay") === "true",
  volume: 0.8,
  playbackRate: parseFloat(localStorage.getItem("play:playbackRate") || "1.15"),
  currentPlayingId: null,
  autoReadDone: true,
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
    if (!enabled) {
      get().stopPlaying();
      set({ loadingIds: new Set() });
    }
  },

  setAutoPlay(enabled) {
    set({ autoPlay: enabled });
    if (!enabled) {
      get().stopPlaying();
    }
  },

  setVolume(volume) {
    set({ volume: Math.max(0, Math.min(1, volume)) });
  },

  setPlaybackRate(rate) {
    set({ playbackRate: Math.max(0.5, Math.min(2.0, rate)) });
  },

  async playMessage(messageId, text, characterId, emotion) {
    const { loadingIds, audioCache, ttsEnabled, volume, playbackRate } = get();
    if (!ttsEnabled) return;

    // Already loading this message
    if (loadingIds.has(messageId)) return;

    // Check cache first
    const cached = audioCache.get(messageId);
    if (cached) {
      set({ currentPlayingId: messageId });
      playAudioElement(cached, get);
      return;
    }

    // Start loading
    const nextLoading = new Set(loadingIds);
    nextLoading.add(messageId);
    set({ loadingIds: nextLoading, error: null, currentPlayingId: messageId });

    try {
      const result = await ttsApi.synthesize(text, characterId, emotion);
      const audioUrl = ttsApi.resolveAudioUrl(result.audioUrl);

      const nextCache = new Map(get().audioCache);
      nextCache.set(messageId, audioUrl);

      const doneLoading = new Set(get().loadingIds);
      doneLoading.delete(messageId);

      set({ audioCache: nextCache, loadingIds: doneLoading });

      // Play the audio
      playAudioElement(audioUrl, get);
    } catch (err) {
      const doneLoading = new Set(get().loadingIds);
      doneLoading.delete(messageId);
      set({
        loadingIds: doneLoading,
        currentPlayingId: null,
        error: err instanceof Error ? err.message : "语音合成失败",
      });
    }
  },

  stopPlaying() {
    playId++; // invalidate any pending onended callbacks
    if (globalAudio) {
      globalAudio.pause();
      globalAudio.onended = null;
      globalAudio.onerror = null;
      globalAudio.src = "";
      globalAudio = null;
    }
    set({ currentPlayingId: null });
  },

  setCurrentPlaying(id) {
    set({ currentPlayingId: id });
  },

  setAutoReadDone(done) {
    set({ autoReadDone: done });
  },
}));
