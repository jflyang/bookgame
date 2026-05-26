import { Swords } from "lucide-react";
import type { Character } from "@story-game/shared";
import { useUiConfig } from "../UiConfigContext.js";
import { useGameStore } from "../../../store/gameStore.js";

export function MessageList({ characters }: { characters: Character[] }) {
  const messages = useGameStore((state) => state.messages);
  const streamingContent = useGameStore((state) => state.streamingContent);
  const isStreaming = useGameStore((state) => state.isStreaming);
  const streamingSpeakerId = useGameStore((state) => state.streamingSpeakerId);
  const streamingSpeakerName = useGameStore((state) => state.streamingSpeakerName);
  const skills = useGameStore((state) => state.skills);
  const uiConfig = useUiConfig();
  const scene = uiConfig?.scene;
  const avatarStyle = uiConfig?.avatar?.style ?? "gradient";

  function avatarElement(characterId: string | null | undefined, avatarText: string | undefined) {
    if (avatarStyle === "emoji") {
      return (
        <span className="avatar portrait-avatar" style={{ fontSize: "1.4rem", lineHeight: "52px", textAlign: "center" }}>
          {avatarText ?? "?"}
        </span>
      );
    }
    if (avatarStyle === "url" && avatarText?.startsWith("http")) {
      return (
        <span className="avatar portrait-avatar" style={{
          background: `url(${avatarText}) center/cover`,
          border: "2px solid rgba(255,255,255,0.74)"
        }} />
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

  return (
    <div className="story-scroll">
      <div className="story-flow">
        <div className="scene-heading">
          <span>{scene?.heading ?? "山道暮色 · 枯松岭"}</span>
        </div>

        {messages.length === 0 && !isStreaming ? (
          <>
            <p className="narration-line">{scene?.introNarration ?? "暮色低垂，枯松岭上寒风凛冽。毒雾从谷底翻涌而上，令人心神俱颤。"}</p>
            <div className="empty-story">
              <h2>{scene?.emptyTitle ?? "山道毒雾初起"}</h2>
              <p>{scene?.emptyHint ?? '点击"继续"让角色轮流推动剧情，也可以点选头像或输入 @角色 指定发言。'}</p>
            </div>
          </>
        ) : (
          messages.map((message) => {
            const character = characters.find((item) => item.id === message.speakerId);
            const isUser = message.role === "user";
            const messageSkills = message.usedSkills
              .map((skillId) => skills.find((s) => s.id === skillId))
              .filter(Boolean);
            const hasDelta = Object.keys(message.stateDelta).some((k) => message.stateDelta[k] !== 0);

            return (
              <article key={message.id} className={`story-entry ${message.role}`}>
                {isUser ? (
                  <div className="user-bubble">
                    <p>{message.content}</p>
                  </div>
                ) : (
                  <div className={`dialogue-card speaker-${message.speakerId ?? "unknown"}`}>
                    {avatarElement(character?.id, character?.avatar)}
                    <div className="dialogue-body">
                      <div className="dialogue-name">{character?.name ?? "旁白"}</div>
                      <p>{message.content}</p>
                      {messageSkills.length > 0 && (
                        <div className="message-skills">
                          {messageSkills.map((skill) => skill && (
                            <span key={skill.id} className="skill-badge">
                              <Swords size={12} /> {skill.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {hasDelta && stateDeltaHints(message.stateDelta)}
                    </div>
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
                <p className="streaming-cursor">{streamingContent}</p>
              </div>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
