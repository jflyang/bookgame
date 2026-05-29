/**
 * TTS Provider interface — abstraction for text-to-speech services.
 * Mirrors the LlmProvider pattern for consistency.
 */

export interface TtsVoiceConfig {
  mode: "zero_shot" | "instruct" | "sft";
  referenceAudio?: string;
  instruct?: string;
}

export interface TtsRequest {
  text: string;
  voiceId: string;
  instruct?: string;
  format?: "mp3" | "ogg" | "wav";
  sampleRate?: number;
}

export interface TtsSynthesisResult {
  audioUrl: string;
  durationMs: number;
  cached: boolean;
}

export interface VoiceInfo {
  id: string;
  name: string;
  language: string;
  defaultInstruct?: string;
}

export interface TtsProvider {
  synthesize(input: TtsRequest): Promise<TtsSynthesisResult>;
  streamSynthesize(input: TtsRequest): AsyncIterable<Buffer>;
  listVoices(): Promise<VoiceInfo[]>;
  isAvailable(): Promise<boolean>;
}
