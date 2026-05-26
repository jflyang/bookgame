import type { Character, CharacterId, CharacterState } from "@story-game/shared";
import { useLabels, useUiConfig } from "../UiConfigContext.js";
import { useGameStore } from "../../../store/gameStore.js";

interface Props {
  characters: Character[];
  states: CharacterState[];
  lastSpeakerId: CharacterId | null;
}

export function CharacterRail({ characters, states, lastSpeakerId }: Props) {
  const { selectedCharacterId, selectCharacter, skills } = useGameStore();
  const labels = useLabels();
  const uiConfig = useUiConfig();
  const avatarStyle = uiConfig?.avatar?.style ?? "gradient";

  return (
    <aside className="character-panel">
      <h2>{labels.characters}</h2>
      <div className="character-list">
        {characters.map((character) => {
          const state = states.find((item) => item.characterId === character.id);
          const selected = selectedCharacterId === character.id;
          const characterSkills = skills.filter((s) => s.ownerId === character.id);
          return (
            <button
              key={character.id}
              className={`character-row ${selected ? "selected" : ""}`}
              onClick={() => selectCharacter(selected ? null : character.id)}
            >
              {avatarStyle === "emoji" ? (
                <span className="avatar portrait-avatar" style={{ fontSize: "1.6rem", lineHeight: "58px", textAlign: "center" }}>
                  {character.avatar}
                </span>
              ) : avatarStyle === "url" && character.avatar.startsWith("http") ? (
                <span className="avatar portrait-avatar" style={{
                  background: `url(${character.avatar}) center/cover`,
                  border: "2px solid rgba(255,255,255,0.74)"
                }} />
              ) : (
                <span className={`avatar portrait-avatar avatar-${character.id}`}>{character.avatar}</span>
              )}
              <span className="character-main">
                <span className="character-name">{character.name}</span>
                <span className="character-role">{character.role}{lastSpeakerId === character.id ? ` · ${labels.lastSpeaker}` : ""}</span>
                <span className="meters">
                  <span>{labels.hp} {state?.hp ?? 0}</span>
                  <span>{labels.mp} {state?.mp ?? 0}</span>
                </span>
                {state?.conditions && state.conditions.length > 0 && (
                  <span className="condition-tags">
                    {state.conditions.map((cond, i) => (
                      <span key={i} className="condition-tag">{cond}</span>
                    ))}
                  </span>
                )}
                {characterSkills.length > 0 && (
                  <span className="skill-tags">
                    {characterSkills.map((skill) => (
                      <span key={skill.id} className="skill-tag">{skill.name}</span>
                    ))}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <button className="character-manage">{labels.manageCharacters}</button>
    </aside>
  );
}

