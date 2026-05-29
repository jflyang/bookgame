import { useEffect, useRef } from "react";
import type { Character } from "@story-game/shared";
import { useUiConfig } from "../UiConfigContext.js";
import { useStoryAssets } from "../contexts/StoryAssetsContext.js";
import { useGameStore } from "../../../store/gameStore.js";
import { ChoiceCards } from "./ChoiceCards.js";
import { MessageAudioButton } from "./MessageAudioButton.js";
import { NarrationAudioButton } from "./NarrationAudioButton.js";
import { useAutoReadMessage } from "../hooks/useAutoReadMessage.js";

export function MessageList({ characters }: { characters: Character[] }) {
  const messages = useGameStore((state) => state.messages);
  const streamingContent = useGameStore((state) => state.streamingContent);
  const isStreaming = useGameStore((state) => state.isStreaming);
  const streamingSpeakerId = useGameStore((state) => state.streamingSpeakerId);
  const streamingSpeakerName = useGameStore((state) => state.streamingSpeakerName);

  // Auto-read new messages when autoPlay is enabled
  useAutoReadMessage(messages, characters, isStreaming);
  const pendingChoices = useGameStore((state) => state.pendingChoices);
  const chooseBranch = useGameStore((state) => state.chooseBranch);
  const isSending = useGameStore((state) => state.isSending);
  const uiConfig = useUiConfig();
  const { getPortraitUrl } = useStoryAssets();
  const scene = uiConfig?.scene;
  const avatarStyle = uiConfig?.avatar?.style ?? "gradient";
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamingContent]);

  function isImageAvatar(avatar: string | undefined) {
    return Boolean(avatar?.startsWith("data:image") || avatar?.startsWith("http"));
  }

  function avatarElement(characterId: string | null | undefined, avatarText: string | undefined) {
    const portraitUrl = characterId ? getPortraitUrl(characterId) : null;
    if (portraitUrl) {
      return (
        <span className="avatar portrait-avatar image-avatar">
          <img src={portraitUrl} alt="" className="avatar-img" />
        </span>
      );
    }
    if (isImageAvatar(avatarText)) {
      return (
        <span className="avatar portrait-avatar image-avatar">
          <img src={avatarText} alt="" className="avatar-img" />
        </span>
      );
    }
    if (avatarStyle === "emoji") {
      return (
        <span className="avatar portrait-avatar text-avatar">
          {avatarText ?? "?"}
        </span>
      );
    }
    return (
      <span className={`avatar portrait-avatar avatar-${characterId ?? "unknown"}`}>
        {avatarText ?? "?"}
      </span>
    );
  }

  function stateDeltaHints(delta: Record<string, number>) {
    const entries = Object.entries(delta).filter(([, v]) => v !== 0);
    if (entries.length === 0) return null;
    return (
      <div className="state-delta-hints">
        {entries.map(([key, value]) => {
          const isHp = key.toLowerCase().includes("hp");
          const isMp = key.toLowerCase().includes("mp");
          const sign = value > 0 ? "+" : "";
          return (
            <span key={key} className={`delta-tag ${isHp ? "hp-delta" : isMp ? "mp-delta" : ""}`}>
              {isHp ? "气血" : isMp ? "内力" : key} {sign}{value}
            </span>
          );
        })}
      </div>
    );
  }

  function splitCombatLine(content: string): { text: string; combat: string | null } {
    const idx = content.search(/\n\n(?:⚔|\[)/);
    if (idx === -1) return { text: content, combat: null };
    return {
      text: content.slice(0, idx),
      combat: content.slice(idx + 2),
    };
  }

  function splitNarrationDialogue(content: string, speakerName?: string): { narration: string | null; dialogue: string | null; combat: string | null } {
    // Content format: "{narration}\n\n{speakerName}："{dialogue}"{combatLine}"
    // Or just plain text without the pattern
    const { text, combat } = splitCombatLine(content);

    if (!speakerName) return { narration: null, dialogue: text, combat };

    // Try to split at "角色名："对话"" pattern
    const dialoguePattern = new RegExp(`^([\\s\\S]*?)\\n\\n${escapeRegex(speakerName)}[：:]\\s*["「"']([\\s\\S]*?)["」"']\\s*$`);
    const match = text.match(dialoguePattern);
    if (match) {
      return {
        narration: match[1].trim() || null,
        dialogue: match[2].trim() || null,
        combat,
      };
    }

    // Fallback: try splitting at double newline — first part is narration, rest is dialogue
    const doubleNewline = text.indexOf("\n\n");
    if (doubleNewline > 0 && doubleNewline < text.length - 2) {
      const firstPart = text.slice(0, doubleNewline).trim();
      const secondPart = text.slice(doubleNewline + 2).trim();
      // Check if second part starts with speaker name pattern
      const speakerPrefix = new RegExp(`^${escapeRegex(speakerName)}[：:]\\s*["「"']?`);
      if (speakerPrefix.test(secondPart)) {
        const dialogueText = secondPart.replace(speakerPrefix, "").replace(/["」"']$/, "").trim();
        return { narration: firstPart, dialogue: dialogueText || null, combat };
      }
      // Otherwise treat first part as narration, second as dialogue
      return { narration: firstPart, dialogue: secondPart, combat };
    }

    return { narration: null, dialogue: text, combat };
  }

  function escapeRegex(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  return (
    <div className="story-scroll" ref={scrollRef}>
      <div className="story-flow">
        <div className="scene-heading">
          <span>{scene?.heading ?? ""}</span>
        </div>

        {scene?.introNarration && (
          <p className="narration-line">{scene.introNarration}</p>
        )}

        {messages.length === 0 && !isStreaming ? (
          <div className="empty-story">
            <h2>{scene?.emptyTitle ?? ""}</h2>
            <p>{scene?.emptyHint ?? ""}</p>
          </div>
        ) : (
          messages.map((message) => {
            const character = characters.find((item) => item.id === message.speakerId);
            const isUser = message.role === "user";
            const isContinue = message.content.trim() === "继续";
            if (isContinue) return null;

            if (isUser) {
              return (
                <article key={message.id} className="story-entry user">
                  <p className="user-text">{message.content}</p>
                </article>
              );
            }

            const { narration, dialogue, combat } = splitNarrationDialogue(message.content, character?.name);

            return (
              <article key={message.id} className={`story-entry ${message.role}`}>
                {narration && (
                  <div style={{ position: "relative" }}>
                    <p className="narration-line">{renderInlineMarkdown(narration)}</p>
                    <NarrationAudioButton messageId={message.id} text={narration} characterId={message.speakerId ?? undefined} />
                  </div>
                )}
                {dialogue && (
                  <div className={`dialogue-card speaker-${message.speakerId ?? "unknown"}`}>
                    {avatarElement(character?.id, character?.avatar)}
                    <div className="dialogue-body">
                      <div className="dialogue-name">{character?.name ?? "旁白"}</div>
                      <p>{renderInlineMarkdown(dialogue)}</p>
                      {combat && (
                        <div className="combat-bar">
                          <span>{combat}</span>
                        </div>
                      )}
                    </div>
                    {message.speakerId && (
                      <MessageAudioButton
                        messageId={message.id}
                        text={dialogue}
                        characterId={message.speakerId}
                      />
                    )}
                  </div>
                )}
                {!dialogue && narration && !combat && null}
                {!dialogue && combat && (
                  <div className="combat-bar">
                    <span>{combat}</span>
                  </div>
                )}
              </article>
            );
          })
        )}

        {isStreaming && streamingContent !== null && (
          <article className="story-entry assistant">
            <div className={`dialogue-card speaker-${streamingSpeakerId ?? "unknown"}`}>
              {avatarElement(streamingSpeakerId, characters.find((c) => c.id === streamingSpeakerId)?.avatar)}
              <div className="dialogue-body">
                <div className="dialogue-name">{streamingSpeakerName ?? "thinking..."}</div>
                <p className="streaming-cursor">{renderInlineMarkdown(streamingContent)}</p>
              </div>
            </div>
          </article>
        )}

        {pendingChoices && !isStreaming && (
          <article className="story-entry system">
            <ChoiceCards
              choices={pendingChoices}
              disabled={isSending}
              onChoose={(index) => chooseBranch(index)}
            />
          </article>
        )}
      </div>
    </div>
  );
}

function renderInlineMarkdown(content: string) {
  return content.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (!bold) return part;
    return <strong key={`${bold[1]}-${index}`}>{bold[1]}</strong>;
  });
}
