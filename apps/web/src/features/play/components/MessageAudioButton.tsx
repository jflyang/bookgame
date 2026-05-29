import { useCallback, useEffect, useRef } from "react";
import { useAudioStore } from "../../../store/audioStore.js";

interface Props {
  messageId: string;
  text: string;
  characterId: string;
}

/**
 * Inline play button for TTS on a single message.
 * Shows a speaker icon; clicking synthesizes and plays audio.
 */
export function MessageAudioButton({ messageId, text, characterId }: Props) {
  const ttsEnabled = useAudioStore((s) => s.ttsEnabled);
  const currentPlayingId = useAudioStore((s) => s.currentPlayingId);
  const loadingIds = useAudioStore((s) => s.loadingIds);
  const audioCache = useAudioStore((s) => s.audioCache);
  const volume = useAudioStore((s) => s.volume);
  const playMessage = useAudioStore((s) => s.playMessage);
  const stopPlaying = useAudioStore((s) => s.stopPlaying);
  const setCurrentPlaying = useAudioStore((s) => s.setCurrentPlaying);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlaying = currentPlayingId === messageId;
  const isLoading = loadingIds.has(messageId);
  const audioUrl = audioCache.get(messageId);

  // Don't render if TTS is disabled
  if (!ttsEnabled) return null;

  const handleClick = useCallback(() => {
    if (isPlaying) {
      // Stop current playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      stopPlaying();
    } else {
      playMessage(messageId, text, characterId);
    }
  }, [isPlaying, messageId, text, characterId, playMessage, stopPlaying]);

  // Play audio when URL becomes available and this message is current
  useEffect(() => {
    if (!isPlaying || !audioUrl) return;

    const audio = audioRef.current || new Audio();
    audioRef.current = audio;
    audio.src = audioUrl;
    audio.volume = volume;

    audio.onended = () => {
      setCurrentPlaying(null);
    };

    audio.onerror = () => {
      setCurrentPlaying(null);
    };

    audio.play().catch(() => {
      setCurrentPlaying(null);
    });

    return () => {
      audio.onended = null;
      audio.onerror = null;
    };
  }, [isPlaying, audioUrl, volume, setCurrentPlaying]);

  // Update volume on playing audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <button
      className={`tts-play-btn ${isPlaying ? "playing" : ""} ${isLoading ? "loading" : ""}`}
      onClick={handleClick}
      disabled={isLoading}
      title={isPlaying ? "停止播放" : "播放语音"}
      aria-label={isPlaying ? "停止播放语音" : "播放语音"}
    >
      {isLoading ? (
        <span className="tts-icon tts-loading">⏳</span>
      ) : isPlaying ? (
        <span className="tts-icon tts-stop">⏹</span>
      ) : (
        <span className="tts-icon tts-speaker">🔊</span>
      )}
    </button>
  );
}
