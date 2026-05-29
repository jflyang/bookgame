import { useCallback, useEffect, useRef } from "react";
import { useAudioStore } from "../../../store/audioStore.js";
import * as ttsApi from "../../../lib/ttsApi.js";

interface Props {
  messageId: string;
  text: string;
}

/**
 * Play button for narration text. Uses the narrator voice from TTS config.
 * Only renders when narrateEnabled is true in the service config.
 */
export function NarrationAudioButton({ messageId, text }: Props) {
  const ttsEnabled = useAudioStore((s) => s.ttsEnabled);
  const serviceConfig = useAudioStore((s) => s.serviceConfig);
  const currentPlayingId = useAudioStore((s) => s.currentPlayingId);
  const volume = useAudioStore((s) => s.volume);
  const playbackRate = useAudioStore((s) => s.playbackRate);
  const setCurrentPlaying = useAudioStore((s) => s.setCurrentPlaying);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadingRef = useRef(false);
  const cacheRef = useRef<string | null>(null);

  const narrationId = `narr_${messageId}`;
  const isPlaying = currentPlayingId === narrationId;

  const handleClick = useCallback(async () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setCurrentPlaying(null);
      return;
    }

    if (cacheRef.current) {
      setCurrentPlaying(narrationId);
      return;
    }

    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      // Use "__narrator__" as characterId — the backend will use narrateVoiceId
      const result = await ttsApi.synthesize(text, "__narrator__");
      cacheRef.current = ttsApi.resolveAudioUrl(result.audioUrl);
      setCurrentPlaying(narrationId);
    } catch (err) {
      console.error("Narration synthesis failed:", err);
    } finally {
      loadingRef.current = false;
    }
  }, [isPlaying, narrationId, text, setCurrentPlaying]);

  useEffect(() => {
    if (!isPlaying || !cacheRef.current) return;
    const audio = audioRef.current || new Audio();
    audioRef.current = audio;
    audio.src = cacheRef.current;
    audio.volume = volume;
    audio.playbackRate = playbackRate;
    audio.onended = () => setCurrentPlaying(null);
    audio.onerror = () => setCurrentPlaying(null);
    audio.play().catch(() => setCurrentPlaying(null));
    return () => { audio.onended = null; audio.onerror = null; };
  }, [isPlaying, volume, setCurrentPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.playbackRate = playbackRate;
    }
  }, [volume, playbackRate]);

  useEffect(() => {
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } };
  }, []);

  // Hide when TTS disabled or narration not enabled
  if (!ttsEnabled) return null;
  if (!(serviceConfig as any)?.narrateEnabled) return null;

  return (
    <button
      className={`tts-play-btn narration-play ${isPlaying ? "playing" : ""}`}
      onClick={handleClick}
      title={isPlaying ? "停止旁白" : "朗读旁白"}
      aria-label={isPlaying ? "停止旁白朗读" : "朗读旁白"}
      style={{ opacity: 1, position: "absolute", right: 4, top: 2 }}
    >
      <span className="tts-icon">{isPlaying ? "⏹" : "📖"}</span>
    </button>
  );
}
