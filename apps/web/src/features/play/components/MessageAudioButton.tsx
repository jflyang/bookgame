import { useCallback } from "react";
import { useAudioStore } from "../../../store/audioStore.js";

interface Props {
  messageId: string;
  text: string;
  characterId: string;
}

/**
 * Inline play button for TTS on a single message.
 * Playback is handled centrally by audioStore.
 */
export function MessageAudioButton({ messageId, text, characterId }: Props) {
  const ttsEnabled = useAudioStore((s) => s.ttsEnabled);
  const currentPlayingId = useAudioStore((s) => s.currentPlayingId);
  const loadingIds = useAudioStore((s) => s.loadingIds);
  const playMessage = useAudioStore((s) => s.playMessage);
  const stopPlaying = useAudioStore((s) => s.stopPlaying);

  const isPlaying = currentPlayingId === messageId || currentPlayingId === `autodlg_${messageId}`;
  const isLoading = loadingIds.has(messageId) || loadingIds.has(`autodlg_${messageId}`);

  const handleClick = useCallback(() => {
    if (isPlaying) {
      stopPlaying();
    } else {
      playMessage(messageId, text, characterId);
    }
  }, [isPlaying, messageId, text, characterId, playMessage, stopPlaying]);

  // Hide when TTS is disabled
  if (!ttsEnabled) return null;

  return (
    <button
      className={`tts-play-btn ${isPlaying ? "playing" : ""} ${isLoading ? "loading" : ""}`}
      onClick={handleClick}
      disabled={isLoading}
      title={isPlaying ? "停止播放" : "播放语音"}
      aria-label={isPlaying ? "停止播放语音" : "播放语音"}
    >
      {isPlaying && <span className="tts-green-dot" />}
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
