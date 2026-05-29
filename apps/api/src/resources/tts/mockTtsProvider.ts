import type { TtsProvider, TtsRequest, TtsSynthesisResult, VoiceInfo } from "./ttsProvider.js";

/**
 * Mock TTS provider for development and testing.
 * Returns placeholder results without actual audio synthesis.
 */
export class MockTtsProvider implements TtsProvider {
  async synthesize(input: TtsRequest): Promise<TtsSynthesisResult> {
    // Estimate duration: ~150ms per Chinese character, ~80ms per English word
    const charCount = input.text.length;
    const estimatedDurationMs = Math.max(500, charCount * 120);

    return {
      audioUrl: `/api/tts/audio/mock_${Date.now()}.mp3`,
      durationMs: estimatedDurationMs,
      cached: false,
    };
  }

  async *streamSynthesize(_input: TtsRequest): AsyncIterable<Buffer> {
    // Yield a minimal valid MP3 frame header as placeholder
    yield Buffer.from([0xff, 0xfb, 0x90, 0x00]);
  }

  async listVoices(): Promise<VoiceInfo[]> {
    return [
      { id: "mock_male", name: "Mock 男声", language: "zh", defaultInstruct: "低沉男声" },
      { id: "mock_female", name: "Mock 女声", language: "zh", defaultInstruct: "温柔女声" },
    ];
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
