import { create } from "zustand";
import type { TtsConfigView } from "@story-game/shared";
import * as ttsApi from "../lib/ttsApi.js";
import { isBrowserTtsSupported, speakWithBrowserTts, stopBrowserTts } from "../lib/browserTts.js";

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
    if (playId !== thisPlayId) {
      return;
    }
    globalAudio = null;
    useAudioStore.setState({ currentPlayingId: null });
  };

  audio.onended = finish;
  audio.onerror = (e) => {
    console.error(`[TTS] audio error:`, e, `url=${url.slice(-30)}, playId=${thisPlayId}`);
    finish();
  };
  audio.play().then(() => {
    // started
  }).catch((err) => {
    console.error(`[TTS] play() rejected:`, err);
    finish();
  });
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
  ttsEnabled: localStorage.getItem("play:ttsEnabled") !== "false", // default: true (with browser fallback)
  autoPlay: localStorage.getItem("play:ttsAutoPlay") === "true",
  volume: parseFloat(localStorage.getItem("play:volume") || "0.8"),
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
      const useServerTts = config.enabled && config.provider !== "disabled";
      set({
        serviceConfig: config,
        // Keep browser fallback if server TTS is not available
        ttsEnabled: useServerTts ? true : get().ttsEnabled,
        error: null,
      });
    } catch (err) {
      // Server unavailable — use browser TTS as fallback
      console.log("[TTS] Server TTS unavailable, using browser TTS fallback");
      set({ error: null });
    }
  },

  setEnabled(enabled) {
    set({ ttsEnabled: enabled });
    localStorage.setItem("play:ttsEnabled", String(enabled));
    if (!enabled) {
      get().stopPlaying();
      set({ loadingIds: new Set() });
    }
  },

  setAutoPlay(enabled) {
    set({ autoPlay: enabled });
    localStorage.setItem("play:ttsAutoPlay", String(enabled));
    if (!enabled) {
      get().stopPlaying();
    }
  },

  setVolume(volume) {
    const clamped = Math.max(0, Math.min(1, volume));
    set({ volume: clamped });
    localStorage.setItem("play:volume", String(clamped));
  },

  setPlaybackRate(rate) {
    const clamped = Math.max(0.5, Math.min(2.0, rate));
    set({ playbackRate: clamped });
    localStorage.setItem("play:playbackRate", String(clamped));
  },

  async playMessage(messageId, text, characterId, emotion) {
    const { loadingIds, audioCache, ttsEnabled, serviceConfig } = get();
    if (!ttsEnabled) { return; }

    // Already loading this message
    if (loadingIds.has(messageId)) { return; }

    // Check cache first
    const cached = audioCache.get(messageId);
    if (cached) {
      set({ currentPlayingId: messageId });
      playAudioElement(cached, get);
      return;
    }

    // If server TTS is enabled, try it first
    const useServer = serviceConfig?.enabled && serviceConfig.provider !== "disabled";

    if (useServer) {
      // Start loading from server
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

        set({ audioCache: nextCache, loadingIds: doneLoading, currentPlayingId: messageId });

        // Play the audio
        playAudioElement(audioUrl, get);
        return;
      } catch (err) {
        console.warn(`[TTS] Server synthesize failed, falling back to browser TTS:`, err);
        const doneLoading = new Set(get().loadingIds);
        doneLoading.delete(messageId);
        set({ loadingIds: doneLoading });
      }
    }

    // Fall back to browser TTS
    if (isBrowserTtsSupported()) {
      set({ currentPlayingId: messageId });
      const ok = speakWithBrowserTts(text, characterId, () => {
        useAudioStore.setState({
          currentPlayingId: null,
          autoReadDone: true,
        });
      });
      if (!ok) {
        set({ currentPlayingId: null });
      }
    } else {
      set({
        error: "浏览器不支持语音播放",
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
    // Also stop browser TTS
    stopBrowserTts();
    set({ currentPlayingId: null });
  },

  setCurrentPlaying(id) {
    set({ currentPlayingId: id });
  },

  setAutoReadDone(done) {
    set({ autoReadDone: done });
  },
}));
