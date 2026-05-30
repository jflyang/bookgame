/**
 * Mobile audio unlock — works around browser autoplay restrictions.
 * On mobile, browsers block Audio.play() until the user has interacted with the page.
 * Call unlockAudio() on the first user gesture (tap/click) to enable audio for the session.
 */

let audioUnlocked = false;
let unlockPromise: Promise<void> | null = null;

/** Check if audio has been unlocked */
export function isAudioUnlocked(): boolean {
  return audioUnlocked;
}

/**
 * Unlock audio playback for the session.
 * Call this on first user interaction (tap, click, keypress).
 * Uses a silent AudioContext to prime the audio subsystem.
 */
export function unlockAudio(): Promise<void> {
  if (audioUnlocked) return Promise.resolve();
  if (unlockPromise) return unlockPromise;

  unlockPromise = (async () => {
    try {
      // Try AudioContext first (most reliable for mobile)
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      // Create a short silent buffer to confirm unlock
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      await new Promise<void>((resolve) => {
        src.onended = () => resolve();
        setTimeout(resolve, 100);
      });
      ctx.close().catch(() => {});
      console.log("[Audio] unlocked via AudioContext");
    } catch {
      // Fallback: try HTML5 Audio with a silent data URI
      try {
        const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
        audio.volume = 0.01;
        await audio.play();
        audio.pause();
        audio.remove();
        console.log("[Audio] unlocked via HTML5 Audio fallback");
      } catch (err) {
        console.warn("[Audio] unlock failed:", err);
      }
    }
    audioUnlocked = true;
    unlockPromise = null;
  })();

  return unlockPromise;
}

/**
 * Play an audio URL safely, respecting mobile autoplay restrictions.
 * If audio is locked, queues the play for after unlock.
 */
export async function safePlayAudio(url: string, options?: { loop?: boolean; volume?: number }): Promise<HTMLAudioElement | null> {
  const audio = new Audio(url);
  audio.loop = options?.loop ?? false;
  audio.volume = options?.volume ?? 0.9;

  try {
    await audio.play();
    return audio;
  } catch (err) {
    if ((err as Error)?.name === "NotAllowedError") {
      console.warn("[Audio] Play blocked — waiting for user gesture. Tap anywhere to enable sound.");
      // Queue for after unlock
      if (!audioUnlocked) {
        unlockAudio().then(() => {
          audio.play().catch(() => {});
        }).catch(() => {});
      }
    } else {
      console.warn("[Audio] Play failed:", err);
    }
    return null;
  }
}
