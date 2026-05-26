import type { ReactNode } from "react";
import { FormEvent, useRef, useState } from "react";
import { useLabels } from "../UiConfigContext.js";
import { useGameStore } from "../../../store/gameStore.js";

export function Composer({ icon }: { icon: ReactNode }) {
  const [text, setText] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { send, isSending, selectedCharacterId, characters } = useGameStore();
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
        return;
      }
    }
    setMentionOpen(false);
  }

  function insertMention(character: typeof characters[number]) {
    const before = text.slice(0, mentionStart);
    const after = text.slice(inputRef.current?.selectionStart ?? mentionStart);
    const newText = `${before}@${character.name} ${after}`;
    setText(newText);
    setMentionOpen(false);
    inputRef.current?.focus();
  }

  const filteredCharacters = characters.filter((c) =>
    mentionSearch ? c.name.includes(mentionSearch) : true
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
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
            aria-label={selected ? `指定 ${selected.name} 发言` : "输入行动或剧情指令"}
            placeholder={selected ? `输入给 ${selected.name} 的剧情指令...` : "输入 @角色 或继续剧情..."}
          />
          {mentionOpen && filteredCharacters.length > 0 && (
            <div className="mention-dropdown">
              {filteredCharacters.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="mention-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertMention(c)}
                >
                  <span className={`avatar-small avatar-${c.id}`}>{c.avatar}</span>
                  <span>{c.name}</span>
                  <span className="mention-role">{c.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button disabled={isSending || !text.trim()}>{icon} {labels.send}</button>
      </div>
    </form>
  );
}
