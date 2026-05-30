import { useEffect } from "react";
import { useAudioStore } from "../../../store/audioStore.js";

/**
 * Global TTS on/off toggle + auto-read toggle for the play toolbar.
 * Loads TTS config on mount and shows current state.
 */
export function TtsToggle() {
  const ttsEnabled = useAudioStore((s) => s.ttsEnabled);
  const autoPlay = useAudioStore((s) => s.autoPlay);
  const serviceConfig = useAudioStore((s) => s.serviceConfig);
  const loadConfig = useAudioStore((s) => s.loadConfig);
  const setEnabled = useAudioStore((s) => s.setEnabled);
  const setAutoPlay = useAudioStore((s) => s.setAutoPlay);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Hide TTS toggle entirely when service is explicitly disabled
  if (serviceConfig && !serviceConfig.enabled) return null;
  return (
    <>
      <button
        className={`tts-toggle ${ttsEnabled ? "active" : ""}`}
        onClick={() => setEnabled(!ttsEnabled)}
        title={ttsEnabled ? "关闭语音" : "开启语音"}
        aria-label={ttsEnabled ? "关闭语音合成" : "开启语音合成"}
      >
        <span>{ttsEnabled ? "🔊" : "🔇"}</span>
        <span>{ttsEnabled ? "语音" : "静音"}</span>
      </button>
      {ttsEnabled && (
        <button
          className={`tts-toggle ${autoPlay ? "active" : ""}`}
          onClick={() => {
            const next = !autoPlay;
            setAutoPlay(next);
            localStorage.setItem("play:ttsAutoPlay", String(next));
          }}
          title={autoPlay ? "关闭自动播放" : "开启自动播放"}
          aria-label={autoPlay ? "关闭自动播放" : "开启自动播放"}
        >
          <span>{autoPlay ? "🔊" : "🔇"}</span>
          <span>{autoPlay ? "自动播放已开启" : "自动播放已关闭"}</span>
        </button>
      )}
    </>
  );
}
