/**
 * Browser-based TTS fallback using Web Speech API (SpeechSynthesis).
 * Used when server-side TTS (CosyVoice/ElevenLabs) is unavailable.
 * Supports Chinese voices on both mobile and desktop browsers.
 */

let currentUtterance: SpeechSynthesisUtterance | null = null;
let onEndCallback: (() => void) | null = null;

/** Voice profiles matching the game characters */
const CHARACTER_VOICES: Record<string, { pitch: number; rate: number; voiceName?: string }> = {
  qiaofeng: { pitch: 0.85, rate: 0.9 },    // deep, slower
  xuzhu: { pitch: 1.1, rate: 1.0 },         // gentle
  duanyu: { pitch: 1.05, rate: 0.95 },       // refined
  dingchunqiu: { pitch: 0.7, rate: 0.85 },   // deep, menacing, slower
};

/** Default voice profile */
const DEFAULT_PROFILE = { pitch: 1.0, rate: 1.0 };

/** Check if browser TTS is supported */
export function isBrowserTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Get available Chinese voices */
function getChineseVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  // Prefer Chinese voices
  const zhVoice = voices.find(
    (v) => v.lang.startsWith("zh") && v.localService
  ) || voices.find(
    (v) => v.lang.startsWith("zh")
  );
  return zhVoice || null;
}

/** Speak text using browser TTS */
export function speakWithBrowserTts(
  text: string,
  characterId?: string,
  onEnd?: () => void,
): boolean {
  if (!isBrowserTtsSupported()) return false;

  // Cancel any ongoing speech
  stopBrowserTts();

  const profile = characterId
    ? { ...DEFAULT_PROFILE, ...(CHARACTER_VOICES[characterId] || {}) }
    : DEFAULT_PROFILE;

  // Clean text: remove markdown, limit length
  const cleanText = text
    .replace(/[*_#`~]/g, "")
    .replace(/\n+/g, "，")
    .trim()
    .slice(0, 500);

  if (!cleanText) return false;

  const utterance = new SpeechSynthesisUtterance(cleanText);

  // Try to use a Chinese voice
  const zhVoice = getChineseVoice();
  if (zhVoice) utterance.voice = zhVoice;

  utterance.pitch = profile.pitch;
  utterance.rate = profile.rate;
  utterance.volume = 0.9;
  utterance.lang = "zh-CN";

  onEndCallback = onEnd || null;
  utterance.onend = () => {
    currentUtterance = null;
    if (onEndCallback) {
      const cb = onEndCallback;
      onEndCallback = null;
      cb();
    }
  };

  utterance.onerror = (e) => {
    console.warn("[BrowserTTS] utterance error:", e.error);
    currentUtterance = null;
    if (onEndCallback) {
      const cb = onEndCallback;
      onEndCallback = null;
      cb();
    }
  };

  currentUtterance = utterance;
  speechSynthesis.speak(utterance);
  return true;
}

/** Stop any ongoing browser TTS */
export function stopBrowserTts(): void {
  if (currentUtterance) {
    currentUtterance.onend = null;
    currentUtterance.onerror = null;
    currentUtterance = null;
  }
  onEndCallback = null;
  if (isBrowserTtsSupported()) {
    speechSynthesis.cancel();
  }
}

/** Check if browser TTS is currently speaking */
export function isBrowserTtsSpeaking(): boolean {
  return currentUtterance !== null && isBrowserTtsSupported() && speechSynthesis.speaking;
}
