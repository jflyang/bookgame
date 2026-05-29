import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Mock ttsApi
const mockSynthesize = vi.fn();
const mockResolveAudioUrl = vi.fn((url: string) => `http://localhost${url}`);
const mockGetTtsConfig = vi.fn();

vi.mock("../../lib/ttsApi.js", () => ({
  synthesize: (...args: unknown[]) => mockSynthesize(...args),
  resolveAudioUrl: (url: string) => mockResolveAudioUrl(url),
  getTtsConfig: () => mockGetTtsConfig(),
}));

// Mock Audio
const mockPlay = vi.fn().mockResolvedValue(undefined);
const mockPause = vi.fn();
let audioInstances: Array<{ src: string; volume: number; playbackRate: number; onended: (() => void) | null; onerror: (() => void) | null; play: typeof mockPlay; pause: typeof mockPause }> = [];

vi.stubGlobal("Audio", class {
  src = "";
  volume = 1;
  playbackRate = 1;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = mockPlay;
  pause = mockPause;
  constructor(url?: string) {
    if (url) this.src = url;
    audioInstances.push(this as any);
  }
});

// Mock localStorage
const localStorageData: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => localStorageData[key] ?? null,
  setItem: (key: string, value: string) => { localStorageData[key] = value; },
  removeItem: (key: string) => { delete localStorageData[key]; },
});

import { useAudioStore } from "../audioStore.js";

describe("audioStore", () => {
  beforeEach(() => {
    // Reset store state
    useAudioStore.setState({
      ttsEnabled: true,
      autoPlay: false,
      volume: 0.8,
      playbackRate: 1.15,
      currentPlayingId: null,
      autoReadDone: true,
      loadingIds: new Set(),
      audioCache: new Map(),
      serviceConfig: null,
      error: null,
    });
    vi.clearAllMocks();
    audioInstances = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("playMessage", () => {
    it("does nothing when ttsEnabled is false", async () => {
      useAudioStore.setState({ ttsEnabled: false });
      await useAudioStore.getState().playMessage("msg1", "hello", "char1");
      expect(mockSynthesize).not.toHaveBeenCalled();
      expect(useAudioStore.getState().currentPlayingId).toBeNull();
    });

    it("uses cache on second call", async () => {
      const cache = new Map([["msg1", "http://localhost/cached.mp3"]]);
      useAudioStore.setState({ audioCache: cache });

      await useAudioStore.getState().playMessage("msg1", "hello", "char1");

      expect(mockSynthesize).not.toHaveBeenCalled();
      expect(useAudioStore.getState().currentPlayingId).toBe("msg1");
      expect(audioInstances.length).toBe(1);
      expect(audioInstances[0].src).toBe("http://localhost/cached.mp3");
    });

    it("calls synthesize API and plays audio", async () => {
      mockSynthesize.mockResolvedValue({ audioUrl: "/api/tts/audio/abc.mp3", durationMs: 1000, cached: false });

      await useAudioStore.getState().playMessage("msg2", "test text", "qiaofeng");

      expect(mockSynthesize).toHaveBeenCalledWith("test text", "qiaofeng", undefined);
      expect(useAudioStore.getState().audioCache.get("msg2")).toBe("http://localhost/api/tts/audio/abc.mp3");
      expect(useAudioStore.getState().loadingIds.has("msg2")).toBe(false);
      expect(audioInstances.length).toBe(1);
    });

    it("handles API failure gracefully", async () => {
      mockSynthesize.mockRejectedValue(new Error("Network error"));

      await useAudioStore.getState().playMessage("msg3", "fail", "char1");

      expect(useAudioStore.getState().currentPlayingId).toBeNull();
      expect(useAudioStore.getState().error).toBe("Network error");
      expect(useAudioStore.getState().loadingIds.has("msg3")).toBe(false);
    });

    it("does not duplicate requests for same messageId", async () => {
      mockSynthesize.mockImplementation(() => new Promise(() => {})); // never resolves

      // First call starts loading
      useAudioStore.getState().playMessage("msg4", "text", "char1");
      expect(useAudioStore.getState().loadingIds.has("msg4")).toBe(true);

      // Second call should be ignored
      await useAudioStore.getState().playMessage("msg4", "text", "char1");
      expect(mockSynthesize).toHaveBeenCalledTimes(1);
    });
  });

  describe("stopPlaying", () => {
    it("stops audio and clears currentPlayingId", () => {
      useAudioStore.setState({ currentPlayingId: "msg1" });
      useAudioStore.getState().stopPlaying();
      expect(useAudioStore.getState().currentPlayingId).toBeNull();
    });

    it("prevents stale onended from firing after stop", async () => {
      mockSynthesize.mockResolvedValue({ audioUrl: "/api/tts/audio/x.mp3", durationMs: 500, cached: false });
      await useAudioStore.getState().playMessage("msg5", "text", "char1");

      const audio = audioInstances[0];
      useAudioStore.getState().stopPlaying();

      // Simulate stale onended firing
      useAudioStore.setState({ currentPlayingId: "something_else" });
      audio.onended?.();

      // Should NOT have reset currentPlayingId (stale callback ignored)
      expect(useAudioStore.getState().currentPlayingId).toBe("something_else");
    });
  });

  describe("setEnabled", () => {
    it("stops playback when disabled", () => {
      useAudioStore.setState({ currentPlayingId: "msg1", ttsEnabled: true });
      useAudioStore.getState().setEnabled(false);
      expect(useAudioStore.getState().ttsEnabled).toBe(false);
      expect(useAudioStore.getState().currentPlayingId).toBeNull();
    });
  });

  describe("setAutoPlay", () => {
    it("stops playback when auto-play disabled", () => {
      useAudioStore.setState({ currentPlayingId: "msg1", autoPlay: true });
      useAudioStore.getState().setAutoPlay(false);
      expect(useAudioStore.getState().autoPlay).toBe(false);
      expect(useAudioStore.getState().currentPlayingId).toBeNull();
    });
  });

  describe("autoReadDone", () => {
    it("defaults to true", () => {
      expect(useAudioStore.getState().autoReadDone).toBe(true);
    });

    it("can be set to false and back", () => {
      useAudioStore.getState().setAutoReadDone(false);
      expect(useAudioStore.getState().autoReadDone).toBe(false);
      useAudioStore.getState().setAutoReadDone(true);
      expect(useAudioStore.getState().autoReadDone).toBe(true);
    });
  });
});
