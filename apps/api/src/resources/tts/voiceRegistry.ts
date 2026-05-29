import { createModuleLogger } from "../../utils/logger.js";

const logger = createModuleLogger("voiceRegistry");

export interface VoiceProfile {
  characterId: string;
  voiceId: string;
  name: string;
  instruct: string;
  referenceAudio: string;
  language: string;
  emotions?: Record<string, string>;
}

/**
 * Maps game characters to TTS voice profiles.
 * Profiles can be loaded from story packages or registered manually.
 */
export class VoiceRegistry {
  private profiles = new Map<string, VoiceProfile>();

  register(profile: VoiceProfile): void {
    this.profiles.set(profile.characterId, profile);
    logger.debug({ characterId: profile.characterId, voiceId: profile.voiceId }, "voice profile registered");
  }

  registerBatch(profiles: VoiceProfile[]): void {
    for (const p of profiles) this.register(p);
  }

  getProfile(characterId: string): VoiceProfile | undefined {
    return this.profiles.get(characterId);
  }

  getInstruct(characterId: string, emotion?: string): string {
    const profile = this.profiles.get(characterId);
    if (!profile) return "";
    if (emotion && profile.emotions?.[emotion]) {
      return profile.emotions[emotion];
    }
    return profile.instruct;
  }

  getVoiceId(characterId: string): string {
    return this.profiles.get(characterId)?.voiceId || characterId;
  }

  listProfiles(): VoiceProfile[] {
    return [...this.profiles.values()];
  }

  clear(): void {
    this.profiles.clear();
  }
}
