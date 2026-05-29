import { useEffect, useRef } from "react";
import type { Character, Message } from "@story-game/shared";
import { useAudioStore } from "../../../store/audioStore.js";

/**
 * Auto-reads new assistant messages when autoPlay is enabled.
 * Plays narration first (if narrateEnabled), then dialogue.
 * Blocks auto-continue until all audio finishes.
 */
export function useAutoReadMessage(messages: Message[], characters: Character[], isStreaming: boolean) {
  const autoPlay = useAudioStore((s) => s.autoPlay);
  const ttsEnabled = useAudioStore((s) => s.ttsEnabled);
  const serviceConfig = useAudioStore((s) => s.serviceConfig);
  const currentPlayingId = useAudioStore((s) => s.currentPlayingId);
  const playMessage = useAudioStore((s) => s.playMessage);
  const setAutoReadDone = useAudioStore((s) => s.setAutoReadDone);

  const prevCountRef = useRef(messages.length);
  const queueRef = useRef<Array<{ id: string; text: string; characterId: string }>>([]);
  const activeRef = useRef(false); // true while we're in the middle of reading

  // Detect new message arrival
  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = messages.length;

    if (messages.length <= prev) return; // no new message
    if (isStreaming) return; // still streaming
    if (!autoPlay || !ttsEnabled) return;

    const latest = messages[messages.length - 1];
    if (!latest || latest.role !== "assistant" || !latest.speakerId) return;

    // Parse
    const character = characters.find((c) => c.id === latest.speakerId);
    const { narration, dialogue } = splitContent(latest.content, character?.name);
    const narrateEnabled = (serviceConfig as any)?.narrateEnabled;

    // Build queue
    const queue: Array<{ id: string; text: string; characterId: string }> = [];
    if (narration && narrateEnabled) {
      queue.push({ id: `autonarr_${latest.id}`, text: narration, characterId: "__narrator__" });
    }
    if (dialogue && latest.speakerId) {
      queue.push({ id: `autodlg_${latest.id}`, text: dialogue, characterId: latest.speakerId });
    } else if (!dialogue && latest.speakerId) {
      const fallback = latest.content.slice(0, 200).trim();
      if (fallback) {
        queue.push({ id: `autodlg_${latest.id}`, text: fallback, characterId: latest.speakerId });
      }
    }

    if (queue.length === 0) return;

    // Start reading — block auto-continue
    queueRef.current = queue;
    activeRef.current = true;
    setAutoReadDone(false);

    // Play first item
    const first = queueRef.current.shift()!;
    playMessage(first.id, first.text, first.characterId);
  }, [messages.length, isStreaming]); // eslint-disable-line

  // When audio finishes (currentPlayingId → null), play next or release
  useEffect(() => {
    if (!activeRef.current) return;
    if (currentPlayingId !== null) return; // still playing, wait

    // Audio finished — play next in queue or mark done
    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      const timer = setTimeout(() => {
        playMessage(next.id, next.text, next.characterId);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      activeRef.current = false;
      setAutoReadDone(true);
    }
  }, [currentPlayingId]); // eslint-disable-line

  // If autoPlay or ttsEnabled is turned off, abort immediately
  useEffect(() => {
    if (!autoPlay || !ttsEnabled) {
      queueRef.current = [];
      activeRef.current = false;
      setAutoReadDone(true);
    }
  }, [autoPlay, ttsEnabled, setAutoReadDone]);
}

function splitContent(content: string, speakerName?: string): { narration: string | null; dialogue: string | null } {
  if (!speakerName) return { narration: null, dialogue: content };
  const combatIdx = content.search(/\n\n(?:⚔|\[)/);
  const text = combatIdx > -1 ? content.slice(0, combatIdx) : content;

  const pattern = new RegExp(
    `^([\\s\\S]*?)\\n\\n${esc(speakerName)}[：:]\\s*["「"']([\\s\\S]*?)["」"']\\s*$`
  );
  const m = text.match(pattern);
  if (m) return { narration: m[1].trim() || null, dialogue: m[2].trim() || null };

  const idx = text.indexOf("\n\n");
  if (idx > 0 && idx < text.length - 2) {
    const first = text.slice(0, idx).trim();
    const second = text.slice(idx + 2).trim();
    const re = new RegExp(`^${esc(speakerName)}[：:]\\s*["「"']?`);
    if (re.test(second)) {
      return { narration: first, dialogue: second.replace(re, "").replace(/["」"']$/, "").trim() || null };
    }
    return { narration: first, dialogue: second };
  }
  return { narration: null, dialogue: text };
}

function esc(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
