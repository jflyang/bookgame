import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Character, Message } from "@story-game/shared";

// Mock audioStore
const mockPlayMessage = vi.fn();
const mockSetAutoReadDone = vi.fn();
let storeState: Record<string, unknown> = {};

vi.mock("../../../../store/audioStore.js", () => ({
  useAudioStore: (selector: (s: Record<string, unknown>) => unknown) => selector(storeState),
}));

import { useAutoReadMessage } from "../useAutoReadMessage.js";

function makeAssistantMsg(id: string, content: string, speakerId = "qiaofeng"): Message {
  return { id, sessionId: "s1", role: "assistant", speakerId, content, usedSkills: [], stateDelta: {}, createdAt: "" };
}

function makeUserMsg(id: string, content: string): Message {
  return { id, sessionId: "s1", role: "user", speakerId: null, content, usedSkills: [], stateDelta: {}, createdAt: "" };
}

const chars: Character[] = [
  { id: "qiaofeng", name: "QF", role: "hero", avatar: "", personaPrompt: "", rules: [], knowledgeBaseIds: [], attackableTargetIds: [] },
];

describe("useAutoReadMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState = {
      autoPlay: true,
      ttsEnabled: true,
      serviceConfig: { narrateEnabled: true },
      currentPlayingId: null,
      playMessage: mockPlayMessage,
      setAutoReadDone: mockSetAutoReadDone,
    };
  });

  it("does not trigger on initial render with existing messages", () => {
    const msgs = [makeAssistantMsg("m1", "hello")];
    renderHook(() => useAutoReadMessage(msgs, chars, false));
    expect(mockPlayMessage).not.toHaveBeenCalled();
  });

  it("triggers playMessage when new assistant message arrives", () => {
    const msgs1 = [makeAssistantMsg("m1", "old")];
    const { rerender } = renderHook(
      ({ m, s }) => useAutoReadMessage(m, chars, s),
      { initialProps: { m: msgs1, s: false } }
    );

    const msgs2 = [...msgs1, makeAssistantMsg("m2", "narration text\n\nQF: dialog")];
    rerender({ m: msgs2, s: false });

    expect(mockSetAutoReadDone).toHaveBeenCalledWith(false);
    expect(mockPlayMessage).toHaveBeenCalled();
  });

  it("does not trigger while streaming", () => {
    const msgs1 = [makeAssistantMsg("m1", "old")];
    const { rerender } = renderHook(
      ({ m, s }) => useAutoReadMessage(m, chars, s),
      { initialProps: { m: msgs1, s: false } }
    );

    const msgs2 = [...msgs1, makeAssistantMsg("m2", "new content")];
    rerender({ m: msgs2, s: true });

    expect(mockPlayMessage).not.toHaveBeenCalled();
  });

  it("does not trigger when autoPlay is false", () => {
    storeState.autoPlay = false;
    const msgs1 = [makeAssistantMsg("m1", "old")];
    const { rerender } = renderHook(
      ({ m }) => useAutoReadMessage(m, chars, false),
      { initialProps: { m: msgs1 } }
    );

    rerender({ m: [...msgs1, makeAssistantMsg("m2", "new")] });
    expect(mockPlayMessage).not.toHaveBeenCalled();
  });

  it("does not trigger when ttsEnabled is false", () => {
    storeState.ttsEnabled = false;
    const msgs1 = [makeAssistantMsg("m1", "old")];
    const { rerender } = renderHook(
      ({ m }) => useAutoReadMessage(m, chars, false),
      { initialProps: { m: msgs1 } }
    );

    rerender({ m: [...msgs1, makeAssistantMsg("m2", "new")] });
    expect(mockPlayMessage).not.toHaveBeenCalled();
  });

  it("ignores user messages", () => {
    const msgs1: Message[] = [];
    const { rerender } = renderHook(
      ({ m }) => useAutoReadMessage(m, chars, false),
      { initialProps: { m: msgs1 } }
    );

    rerender({ m: [makeUserMsg("u1", "hello")] });
    expect(mockPlayMessage).not.toHaveBeenCalled();
  });

  it("plays narration with __narrator__ when narrateEnabled", () => {
    const msgs1: Message[] = [];
    const { rerender } = renderHook(
      ({ m }) => useAutoReadMessage(m, chars, false),
      { initialProps: { m: msgs1 } }
    );

    rerender({ m: [makeAssistantMsg("m1", "narration part\n\nQF: dialogue part")] });

    // First call should be narration
    expect(mockPlayMessage).toHaveBeenCalledWith("autonarr_m1", "narration part", "__narrator__");
  });

  it("skips narration when narrateEnabled is false", () => {
    storeState.serviceConfig = { narrateEnabled: false };
    const msgs1: Message[] = [];
    const { rerender } = renderHook(
      ({ m }) => useAutoReadMessage(m, chars, false),
      { initialProps: { m: msgs1 } }
    );

    rerender({ m: [makeAssistantMsg("m1", "narration\n\nQF: dialogue")] });

    // Should play dialogue, not narration
    expect(mockPlayMessage).toHaveBeenCalledWith("autodlg_m1", "dialogue", "qiaofeng");
  });

  it("releases autoReadDone when autoPlay turned off", () => {
    storeState.autoPlay = false;
    renderHook(() => useAutoReadMessage([], chars, false));
    expect(mockSetAutoReadDone).toHaveBeenCalledWith(true);
  });
});
