import { useCallback, useEffect, useRef, useState } from "react";
import type { KnowledgeDocument, Message, StoryPerformanceDefinition } from "@story-game/shared";
import { useGameStore } from "../../../store/gameStore.js";
import { useStoryAssets } from "../contexts/StoryAssetsContext.js";
import { StoryPerformanceOverlay } from "./StoryPerformanceOverlay.js";

interface QueuedPerformance {
  id: string;
  performance: StoryPerformanceDefinition;
}

const VISUAL_RENDERERS = new Set(["video", "layeredCss", "image"]);

export function StoryPerformanceRuntime({ enabled = true, animationEnabled = true }: { enabled?: boolean; animationEnabled?: boolean }) {
  const messages = useGameStore((state) => state.messages);
  const gameState = useGameStore((state) => state.gameState);
  const knowledgeDocuments = useGameStore((state) => state.knowledgeDocuments);
  const sessionId = useGameStore((state) => state.sessionId);
  const editingPackageId = useGameStore((state) => state.editingPackageId);
  const { manifest, getAssetUrl } = useStoryAssets();
  const [queue, setQueue] = useState<QueuedPerformance[]>([]);
  const [active, setActive] = useState<QueuedPerformance | null>(null);
  const hydratedRef = useRef(false);
  const lastMessageIdRef = useRef<string | null>(null);
  const lastStageRef = useRef<string | undefined>(undefined);
  const queuedKeysRef = useRef(new Set<string>());

  useEffect(() => {
    queuedKeysRef.current.clear();
    setQueue([]);
    setActive(null);
    hydratedRef.current = false;
    lastMessageIdRef.current = null;
    lastStageRef.current = undefined;
  }, [sessionId, editingPackageId]);

  useEffect(() => {
    if (!manifest?.performances || !sessionId || !editingPackageId) return;

    const latestMessage = messages.at(-1);
    const currentStage = gameState?.scenario?.currentStage;

    if (!hydratedRef.current) {
      hydratedRef.current = true;
      lastMessageIdRef.current = latestMessage?.id ?? null;
      lastStageRef.current = currentStage;
      return;
    }

    const nextQueue: QueuedPerformance[] = [];
    const hasNewMessage = Boolean(latestMessage && latestMessage.id !== lastMessageIdRef.current);
    const hasNewStage = Boolean(currentStage && currentStage !== lastStageRef.current);

    for (const [id, performance] of Object.entries(manifest.performances)) {
      if (!animationEnabled && VISUAL_RENDERERS.has(performance.renderer)) continue;
      if (hasNewMessage && latestMessage && shouldPlayForMessage(performance, latestMessage, messages, knowledgeDocuments)) {
        nextQueue.push({ id, performance });
      } else if (hasNewStage && shouldPlayForStage(performance, currentStage)) {
        nextQueue.push({ id, performance });
      }
    }

    if (latestMessage) lastMessageIdRef.current = latestMessage.id;
    lastStageRef.current = currentStage;

    const playable = nextQueue.filter((item) => canQueue(item, sessionId, editingPackageId, queuedKeysRef.current));
    if (playable.length) {
      setQueue((items) => [...items, ...playable]);
    }
  }, [editingPackageId, gameState?.scenario?.currentStage, knowledgeDocuments, manifest?.performances, messages, sessionId]);

  useEffect(() => {
    if (active || queue.length === 0) return;
    const [next, ...rest] = queue;
    setActive(next);
    setQueue(rest);
  }, [active, queue]);

  const handleDone = useCallback(() => {
    setActive(null);
  }, []);

  if (!enabled || !active) return null;

  return (
    <StoryPerformanceOverlay
      performanceId={active.id}
      performance={active.performance}
      resolveAssetUrl={getAssetUrl}
      onDone={handleDone}
    />
  );
}

export function shouldPlayForMessage(
  performance: StoryPerformanceDefinition,
  latestMessage: Message,
  allMessages: Message[],
  knowledgeDocuments: KnowledgeDocument[] = []
) {
  const trigger = performance.trigger;
  if (latestMessage.role !== "assistant") return false;

  if (trigger.type === "firstAppearance") {
    if (!trigger.characterId || latestMessage.speakerId !== trigger.characterId) return false;
    return allMessages
      .filter((message) => message.id !== latestMessage.id)
      .every((message) => message.role !== "assistant" || message.speakerId !== trigger.characterId);
  }

  if (trigger.type === "skillUse") {
    return Boolean(trigger.skillId && latestMessage.usedSkills.includes(trigger.skillId));
  }

  if (trigger.type === "messageEvent") {
    return Boolean(trigger.eventId && latestMessage.usedSkills.includes(trigger.eventId));
  }

  if (trigger.type === "knowledgeUse") {
    return shouldPlayForKnowledgeUse(performance, latestMessage, knowledgeDocuments);
  }

  return false;
}

function shouldPlayForKnowledgeUse(
  performance: StoryPerformanceDefinition,
  latestMessage: Message,
  knowledgeDocuments: KnowledgeDocument[]
) {
  const trigger = performance.trigger;

  const candidates = trigger.matchBoldOnly === false
    ? [latestMessage.content]
    : extractBoldSegments(latestMessage.content);
  if (candidates.length === 0) return false;

  const triggerKeywords = normalizeTerms([
    trigger.knowledgeTitle,
    ...(trigger.keywords ?? []),
  ]);
  const ownerDocs = knowledgeDocuments.filter((doc) => !trigger.characterId || doc.ownerId === trigger.characterId);
  const knowledgeKeywords = normalizeTerms([
    ...ownerDocs.flatMap((doc) => extractKnowledgeTerms(doc.content, performance.name)),
  ]);
  const terms = triggerKeywords.length > 0 ? triggerKeywords : knowledgeKeywords;
  if (terms.length === 0) return false;

  return candidates.some((segment) => {
    const normalizedSegment = normalizeTerm(segment);
    return terms.some((term) => normalizedSegment.includes(term) || term.includes(normalizedSegment));
  });
}

export function extractBoldSegments(content: string) {
  return Array.from(content.matchAll(/\*\*([^*]+)\*\*/g))
    .map((match) => match[1]?.trim())
    .filter((segment): segment is string => Boolean(segment));
}

function extractKnowledgeTerms(content: string, performanceName: string) {
  const terms: string[] = [];
  const sections = content.split(/\n(?=#{1,3}\s+)/);
  for (const section of sections) {
    if (!section.includes(`表演: ${performanceName}`) && !section.includes(`表演：${performanceName}`)) continue;
    const heading = section.match(/^#{1,3}\s+(.+)$/m)?.[1];
    if (heading) terms.push(cleanKnowledgeTitle(heading));
    for (const line of section.split(/\r?\n/)) {
      const triggerMatch = line.match(/^\s*-?\s*触发词[：:]\s*(.+)$/);
      if (triggerMatch?.[1]) terms.push(...triggerMatch[1].split(/[，,、]/));
    }
  }
  return terms;
}

function cleanKnowledgeTitle(title: string) {
  return title.replace(/^技能卡[：:]\s*/, "").replace(/^招式[：:]\s*/, "").trim();
}

function normalizeTerms(terms: Array<string | undefined>) {
  return Array.from(new Set(terms.map(normalizeTerm).filter(Boolean)));
}

function normalizeTerm(term?: string) {
  return (term ?? "").replace(/[《》「」“”"'`*·\s]/g, "").toLowerCase();
}

function shouldPlayForStage(performance: StoryPerformanceDefinition, currentStage?: string) {
  const trigger = performance.trigger;
  return trigger.type === "stageEnter" && Boolean(currentStage && trigger.stageId === currentStage);
}

function canQueue(
  item: QueuedPerformance,
  sessionId: string,
  storyPackageId: string,
  queuedKeys: Set<string>
) {
  const key = playbackKey(item, sessionId, storyPackageId);
  if (!key) return true;
  if (queuedKeys.has(key)) return false;
  if (item.performance.playOnce === "story") {
    if (window.localStorage.getItem(key)) return false;
    window.localStorage.setItem(key, "1");
  } else {
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, "1");
  }
  queuedKeys.add(key);
  return true;
}

function playbackKey(item: QueuedPerformance, sessionId: string, storyPackageId: string) {
  if (item.performance.playOnce === "never") return null;
  if (item.performance.playOnce === "story") return `story-performance:${storyPackageId}:${item.id}`;
  return `story-performance:${sessionId}:${item.id}`;
}
