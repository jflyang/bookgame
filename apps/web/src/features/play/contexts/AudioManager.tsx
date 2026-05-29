import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import type { StoryPluginManifest } from "@story-game/shared";

interface AudioManagerContextValue {
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  playBgm(stageId?: string): void;
  playSfx(eventName: string): void;
  stopBgm(): void;
  setVolume(v: number): void;
  setMuted(m: boolean): void;
}

const AudioManagerCtx = createContext<AudioManagerContextValue>({
  isPlaying: false,
  volume: 0.5,
  muted: false,
  playBgm: () => {},
  playSfx: () => {},
  stopBgm: () => {},
  setVolume: () => {},
  setMuted: () => {},
});

export function useAudio() {
  return useContext(AudioManagerCtx);
}

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export function AudioManagerProvider({
  packageId,
  manifest,
  currentStage,
  children,
}: {
  packageId: string | null;
  manifest: StoryPluginManifest | null;
  currentStage?: string;
  children: ReactNode;
}) {
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.5);
  const [muted, setMutedState] = useState(() => localStorage.getItem("play:audioMuted") === "true");
  const volumeRef = useRef(0.5);
  const mutedRef = useRef(muted);

  const getUrl = useCallback(
    (relPath: string) => `${API_BASE}/api/story-assets/${encodeURIComponent(packageId ?? "")}/${relPath}`,
    [packageId]
  );

  const playBgm = useCallback(
    (stageId?: string) => {
      if (!manifest?.audio?.bgm || !packageId) return;
      if (mutedRef.current) return;
      const bgm = manifest.audio.bgm;
      const relPath = (stageId && bgm.scenes[stageId]) || bgm.default;
      if (!relPath) return;

      const url = getUrl(relPath);
      if (bgmRef.current) {
        bgmRef.current.pause();
        bgmRef.current = null;
      }
      const audio = new Audio(url);
      audio.loop = true;
      audio.volume = volumeRef.current;
      audio.play().then(() => setIsPlaying(true)).catch((err) => { console.warn("BGM playback failed:", err); setIsPlaying(false); });
      bgmRef.current = audio;
    },
    [manifest, packageId, getUrl]
  );

  const playSfx = useCallback(
    (eventName: string) => {
      if (!manifest?.audio?.sfx || !packageId) return;
      if (mutedRef.current) return;
      const relPath = manifest.audio.sfx[eventName];
      if (!relPath) return;
      const sfx = new Audio(getUrl(relPath));
      sfx.volume = volumeRef.current;
      sfx.play().catch((err) => { console.warn("SFX playback failed:", eventName, err); });
    },
    [manifest, packageId, getUrl]
  );

  const stopBgm = useCallback(() => {
    if (bgmRef.current) {
      bgmRef.current.pause();
      bgmRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const setVolume = useCallback((v: number) => {
    volumeRef.current = v;
    setVolumeState(v);
    if (bgmRef.current) bgmRef.current.volume = v;
  }, []);

  const setMuted = useCallback((m: boolean) => {
    mutedRef.current = m;
    setMutedState(m);
    localStorage.setItem("play:audioMuted", String(m));
    if (m && bgmRef.current) {
      bgmRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  // Auto-switch BGM on stage change
  useEffect(() => {
    if (currentStage && manifest?.audio?.bgm) {
      playBgm(currentStage);
    }
  }, [currentStage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bgmRef.current) {
        bgmRef.current.pause();
        bgmRef.current = null;
      }
    };
  }, []);

  return (
    <AudioManagerCtx.Provider value={{ isPlaying, volume, muted, playBgm, playSfx, stopBgm, setVolume, setMuted }}>
      {children}
    </AudioManagerCtx.Provider>
  );
}
