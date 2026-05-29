import { useCallback } from "react";
import { useAudioStore } from "../../../store/audioStore.js";

interface Props {
  messageId: string;
  text: string;
}

/**
 * Play button for narration text. Uses the narrator voice.
 * Only renders when narrateEnabled is true.
 */
export function NarrationAudioButton({ messageId, text }: Props) {
  const ttsEnabled = useAudioStore((s) => s.ttsEnabled);
  const serviceConfig = useAudioStore((s) => s.serviceConfig);
  const currentPlayingId = useAudioStore((s) => s.currentPlayingId);
  const playMessage = useAudioStore((s) => s.playMessage);
  const stopPlaying = useAudioStore((s) => s.stopPlaying);

  const narrationId = `narr_${messageId}`;
  const autoNarrationId = `autonarr_${messageId}`;
  const isPlaying = currentPlayingId === narrationId || currentPlayingId === autoNarrationId;

  const handleClick = useCallback(() => {
    if (isPlaying) {
      stopPlaying();
    } else {
      playMessage(narrationId, text, "__narrator__");
    }
  }, [isPlaying, narrationId, text, playMessage, stopPlaying]);

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
      {isPlaying && <span className="tts-green-dot" />}
      <span className="tts-icon">{isPlaying ? "⏹" : "📖"}</span>
    </button>
  );
}
