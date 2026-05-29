import type { ReactNode } from "react";
import { FormEvent, useRef, useState } from "react";
import type { Character } from "@story-game/shared";
import { useLabels, useUiConfig } from "../UiConfigContext.js";
import { useStoryAssets } from "../contexts/StoryAssetsContext.js";
import { useGameStore } from "../../../store/gameStore.js";

function isImageAvatar(avatar: string | undefined) {
  return Boolean(avatar?.startsWith("data:image") || avatar?.startsWith("http"));
}

function MentionAvatar({ character }: { character: Character }) {
  const { getPortraitUrl } = useStoryAssets();
  const uiConfig = useUiConfig();
  const avatarStyle = uiConfig?.avatar?.style ?? "gradient";
  const portraitUrl = getPortraitUrl(character.id);

  if (portraitUrl || isImageAvatar(character.avatar)) {
    return (
      <span
        className="mention-avatar-img"
        style={{ backgroundImage: `url(${portraitUrl || character.avatar})` }}
      />
    );
  }
  if (avatarStyle === "emoji") {
    return (
      <span className={`mention-avatar-text avatar-${character.id}`}>
        {character.avatar || character.name.charAt(0)}
      </span>
    );
  }
  return (
    <span className={`mention-avatar-text avatar-${character.id}`}>
      {character.avatar || character.name.charAt(0)}
    </span>
  );
}

export function Composer({ icon }: { icon: ReactNode }) {
  const [text, setText] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionIndex, setMentionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { send, isSending, selectedCharacterId, characters, gameState } = useGameStore();
  const isCompleted = gameState?.status === "completed";
  const labels = useLabels();
  const selected = characters.find((item) => item.id === selectedCharacterId);

  function handleChange(value: string) {
    setText(value);

    const cursorPos = inputRef.current?.selectionStart ?? value.length;
    const beforeCursor = value.slice(0, cursorPos);
    const atIdx = beforeCursor.lastIndexOf("@");

    if (atIdx !== -1) {
      const search = beforeCursor.slice(atIdx + 1);
      if (!search.includes(" ")) {
        setMentionStart(atIdx);
        setMentionSearch(search);
        setMentionOpen(true);
        setMentionIndex(0);
        return;
      }
    }
    setMentionOpen(false);
  }

  function insertMention(character: Character) {
    const before = text.slice(0, mentionStart);
    const afterCursor = inputRef.current?.selectionStart ?? mentionStart;
    const after = text.slice(afterCursor);
    const newText = `${before}@${character.name} ${after}`;
    setText(newText);
    setMentionOpen(false);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const cursorPos = before.length + character.name.length + 2;
      inputRef.current?.setSelectionRange(cursorPos, cursorPos);
    });
  }

  const filteredCharacters = characters.filter((c) =>
    mentionSearch ? c.name.includes(mentionSearch) : true
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!mentionOpen || filteredCharacters.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((prev) => (prev + 1) % filteredCharacters.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex((prev) => (prev - 1 + filteredCharacters.length) % filteredCharacters.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(filteredCharacters[mentionIndex]);
    } else if (e.key === "Escape") {
      setMentionOpen(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (mentionOpen) return;
    if (!text.trim()) {
      // Empty input + Enter = continue story
      const { continueStory, isSending, gameState } = useGameStore.getState();
      if (!isSending && gameState?.status !== "completed") {
        await continueStory();
      }
      return;
    }
    await send(text);
    setText("");
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <div className="composer-row">
        <div className="composer-input-wrap">
          <input
            ref={inputRef}
            id="story-input"
            name="story-input"
            value={text}
            onChange={(event) => handleChange(event.target.value)}
            onKeyDown={handleKeyDown}
            aria-label={selected ? `指定 ${selected.name} 发言` : "输入行动或剧情指令"}
            placeholder={isCompleted ? "故事已结束" : (selected ? `输入给 ${selected.name} 的剧情指令...` : "输入 @角色 或继续剧情...")}
            disabled={isCompleted}
          />
          {mentionOpen && filteredCharacters.length > 0 && (
            <div className="mention-dropdown">
              {filteredCharacters.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  className={`mention-item ${i === mentionIndex ? "mention-active" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertMention(c)}
                  onMouseEnter={() => setMentionIndex(i)}
                >
                  <MentionAvatar character={c} />
                  <span className="mention-name">{c.name}</span>
                  <span className="mention-role">{c.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button disabled={isSending || isCompleted || !text.trim()}>{isCompleted ? "故事已结束" : <>{icon} {labels.send}</>}</button>
      </div>
    </form>
  );
}
