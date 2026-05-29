import { useCallback } from "react";
import { useAudioStore } from "../../../store/audioStore.js";

interface Props {
  messageId: string;
  text: string;
  /** When provided, uses the character's voice instead of the narrator voice */
  characterId?: string;
}

/**
 * Play button for narration text. Uses the character's voice if provided,
 * otherwise falls back to the narrator voice.
 * Only renders when narrateEnabled is true.
 */
export function NarrationAudioButton({ messageId, text, characterId }: Props) {
  const ttsEnabled = useAudioStore((s) => s.ttsEnabled);
  const serviceConfig = useAudioStore((s) => s.serviceConfig);
  const currentPlayingId = useAudioStore((s) => s.currentPlayingId);
  const playMessage = useAudioStore((s) => s.playMessage);
  const stopPlaying = useAudioStore((s) => s.stopPlaying);

  const narrationId = `narr_${messageId}`;
  const autoNarrationId = `autonarr_${messageId}`;
  const isPlaying = currentPlayingId === narrationId || currentPlayingId === autoNarrationId;

  const voiceId = characterId ?? "__narrator__";

  const handleClick = useCallback(() => {
    if (isPlaying) {
      stopPlaying();
    } else {
      playMessage(narrationId, text, voiceId);
    }
  }, [isPlaying, narrationId, text, voiceId, playMessage, stopPlaying]);

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
