import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import type { StoryPluginManifest } from "@story-game/shared";

interface AudioManagerContextValue {
  isPlaying: boolean;
  volume: number;
  playBgm(stageId?: string): void;
  playSfx(eventName: string): void;
  stopBgm(): void;
  setVolume(v: number): void;
}

const AudioManagerCtx = createContext<AudioManagerContextValue>({
  isPlaying: false,
  volume: 0.5,
  playBgm: () => {},
  playSfx: () => {},
  stopBgm: () => {},
  setVolume: () => {},
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
  const volumeRef = useRef(0.5);

  const getUrl = useCallback(
    (relPath: string) => `${API_BASE}/api/story-assets/${encodeURIComponent(packageId ?? "")}/${relPath}`,
    [packageId]
  );

  const playBgm = useCallback(
    (stageId?: string) => {
      if (!manifest?.audio?.bgm || !packageId) return;
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
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      bgmRef.current = audio;
    },
    [manifest, packageId, getUrl]
  );

  const playSfx = useCallback(
    (eventName: string) => {
      if (!manifest?.audio?.sfx || !packageId) return;
      const relPath = manifest.audio.sfx[eventName];
      if (!relPath) return;
      const sfx = new Audio(getUrl(relPath));
      sfx.volume = volumeRef.current;
      sfx.play().catch(() => {});
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
    <AudioManagerCtx.Provider value={{ isPlaying, volume, playBgm, playSfx, stopBgm, setVolume }}>
      {children}
    </AudioManagerCtx.Provider>
  );
}
