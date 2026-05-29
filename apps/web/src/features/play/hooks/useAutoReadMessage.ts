import { useEffect, useRef } from "react";
import type { Character, Message } from "@story-game/shared";
import { useAudioStore } from "../../../store/audioStore.js";

/**
 * Auto-reads new assistant messages when autoPlay is enabled.
 * Plays narration first (if narrateEnabled), then dialogue.
 * Shows a pulsing green dot on the message being read.
 */
export function useAutoReadMessage(messages: Message[], characters: Character[], isStreaming: boolean) {
  const autoPlay = useAudioStore((s) => s.autoPlay);
  const ttsEnabled = useAudioStore((s) => s.ttsEnabled);
  const serviceConfig = useAudioStore((s) => s.serviceConfig);
  const playMessage = useAudioStore((s) => s.playMessage);
  const setAutoReadDone = useAudioStore((s) => s.setAutoReadDone);
  const currentPlayingId = useAudioStore((s) => s.currentPlayingId);

  const prevMessageCountRef = useRef(messages.length);
  const queueRef = useRef<Array<{ id: string; text: string; characterId: string }>>([]);
  const processingRef = useRef(false);

  // Detect NEW messages (count increased and not streaming)
  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    // Only trigger when messages increase (new message arrived) and streaming just finished
    if (messages.length <= prevCount) return;
    if (isStreaming) return;
    if (!autoPlay || !ttsEnabled) return;

    const latest = messages[messages.length - 1];
    if (!latest || latest.role !== "assistant" || !latest.speakerId) return;

    // Parse content
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
      // Fallback: use first 200 chars
      const fallback = latest.content.slice(0, 200);
      if (fallback.trim()) {
        queue.push({ id: `autodlg_${latest.id}`, text: fallback, characterId: latest.speakerId });
      }
    }

    if (queue.length === 0) {
      setAutoReadDone(true);
      return;
    }

    queueRef.current = queue;
    processingRef.current = true;
    setAutoReadDone(false);
    playNextInQueue();
  }, [messages.length, isStreaming]); // eslint-disable-line

  // When current audio finishes, play next in queue
  useEffect(() => {
    if (!processingRef.current) return;
    if (currentPlayingId !== null) return; // still playing

    // Current item finished — play next or mark done
    const timer = setTimeout(() => {
      if (queueRef.current.length > 0) {
        playNextInQueue();
      } else {
        processingRef.current = false;
        setAutoReadDone(true);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [currentPlayingId]); // eslint-disable-line

  // Safety: if autoPlay is turned off, clear queue and release
  useEffect(() => {
    if (!autoPlay || !ttsEnabled) {
      queueRef.current = [];
      processingRef.current = false;
      setAutoReadDone(true);
    }
  }, [autoPlay, ttsEnabled]); // eslint-disable-line

  function playNextInQueue() {
    const next = queueRef.current.shift();
    if (!next) {
      processingRef.current = false;
      setAutoReadDone(true);
      return;
    }
    playMessage(next.id, next.text, next.characterId);
  }
}

function splitContent(content: string, speakerName?: string): { narration: string | null; dialogue: string | null } {
  if (!speakerName) return { narration: null, dialogue: content };

  // Remove combat line
  const combatIdx = content.search(/\n\n(?:⚔|\[)/);
  const text = combatIdx > -1 ? content.slice(0, combatIdx) : content;

  // Try "narration\n\nName："dialogue"" pattern
  const pattern = new RegExp(
    `^([\\s\\S]*?)\\n\\n${escapeRegex(speakerName)}[：:]\\s*["「"']([\\s\\S]*?)["」"']\\s*$`
  );
  const match = text.match(pattern);
  if (match) {
    return { narration: match[1].trim() || null, dialogue: match[2].trim() || null };
  }

  // Fallback: split at first double newline
  const idx = text.indexOf("\n\n");
  if (idx > 0 && idx < text.length - 2) {
    const first = text.slice(0, idx).trim();
    const second = text.slice(idx + 2).trim();
    const speakerRe = new RegExp(`^${escapeRegex(speakerName)}[：:]\\s*["「"']?`);
    if (speakerRe.test(second)) {
      return { narration: first, dialogue: second.replace(speakerRe, "").replace(/["」"']$/, "").trim() || null };
    }
    return { narration: first, dialogue: second };
  }

  return { narration: null, dialogue: text };
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
