import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AudioManagerProvider, useAudio } from "../AudioManager.js";

describe("AudioManagerProvider", () => {
  beforeEach(() => {
    HTMLAudioElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });

  it("renders children", () => {
    render(<AudioManagerProvider packageId="test" manifest={null}><div data-testid="c">X</div></AudioManagerProvider>);
    expect(screen.getByTestId("c")).toBeTruthy();
  });

  it("provides default context values", () => {
    function C() { const a = useAudio(); return <><span data-testid="p">{String(a.isPlaying)}</span><span data-testid="v">{a.volume}</span></>; }
    render(<AudioManagerProvider packageId="test" manifest={null}><C /></AudioManagerProvider>);
    expect(screen.getByTestId("p").textContent).toBe("false");
    expect(screen.getByTestId("v").textContent).toBe("0.5");
  });

  it("exposes functions without throwing", () => {
    function C() {
      const a = useAudio();
      expect(typeof a.playBgm).toBe("function");
      expect(typeof a.playSfx).toBe("function");
      expect(typeof a.stopBgm).toBe("function");
      expect(typeof a.setVolume).toBe("function");
      return null;
    }
    render(<AudioManagerProvider packageId="test" manifest={null}><C /></AudioManagerProvider>);
  });

  it("works with full manifest and stage", () => {
    const mf = { id: "t", type: "story-plugin" as const, schemaVersion: "2" as const, title: "T", description: "", version: "1.0.0", author: "", capabilities: {}, audio: { bgm: { default: "b.mp3", scenes: {} }, sfx: {} }, images: {}, fonts: {}, performances: {}, entry: "story.json", createdAt: "", updatedAt: "" };
    render(<AudioManagerProvider packageId="p" manifest={mf} currentStage="s1"><div data-testid="ok">OK</div></AudioManagerProvider>);
    expect(screen.getByTestId("ok")).toBeTruthy();
  });
});
