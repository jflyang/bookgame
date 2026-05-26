import type { Character, CharacterId, CharacterState, InitialCharacterState } from "@story-game/shared";
import { useLabels, useUiConfig } from "../UiConfigContext.js";
import { useGameStore } from "../../../store/gameStore.js";

interface Props {
  characters: Character[];
  states: CharacterState[];
  lastSpeakerId: CharacterId | null;
  initialStates?: InitialCharacterState[];
}

export function CharacterRail({ characters, states, lastSpeakerId, initialStates }: Props) {
  const { selectedCharacterId, selectCharacter, skills } = useGameStore();
  const labels = useLabels();
  const uiConfig = useUiConfig();
  const avatarStyle = uiConfig?.avatar?.style ?? "gradient";

  function getMaxHp(characterId: CharacterId) {
    return initialStates?.find((s) => s.characterId === characterId)?.hp ?? 100;
  }

  function getMaxMp(characterId: CharacterId) {
    return initialStates?.find((s) => s.characterId === characterId)?.mp ?? 100;
  }

  return (
    <aside className="character-panel">
      <h2>{labels.characters}</h2>
      <div className="character-list">
        {characters.map((character) => {
          const state = states.find((item) => item.characterId === character.id);
          const selected = selectedCharacterId === character.id;
          const isLastSpeaker = lastSpeakerId === character.id;
          const characterSkills = skills.filter((s) => s.ownerId === character.id);
          const maxHp = getMaxHp(character.id);
          const maxMp = getMaxMp(character.id);
          const hpPct = maxHp > 0 ? Math.min(100, Math.round(((state?.hp ?? 0) / maxHp) * 100)) : 0;
          const mpPct = maxMp > 0 ? Math.min(100, Math.round(((state?.mp ?? 0) / maxMp) * 100)) : 0;

          return (
            <button
              key={character.id}
              className={`character-card ${selected ? "selected" : ""} ${isLastSpeaker ? "last-speaker" : ""}`}
              onClick={() => selectCharacter(selected ? null : character.id)}
            >
              <div className="character-card-header">
                {avatarStyle === "emoji" ? (
                  <span className="avatar portrait-avatar" style={{ fontSize: "1.3rem", lineHeight: "44px", textAlign: "center" }}>
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
                <div className="character-card-info">
                  <span className="character-name">{character.name}</span>
                  <span className="character-role">{character.role}{isLastSpeaker ? ` · ${labels.lastSpeaker}` : ""}</span>
                </div>
              </div>

              <div className="character-card-stats">
                <div className="stat-line">
                  <span className="stat-label">{labels.hp}</span>
                  <div className="stat-bar-track">
                    <div className="stat-bar-fill hp" style={{ width: `${hpPct}%` }} />
                  </div>
                  <span className="stat-value">{state?.hp ?? 0}/{maxHp}</span>
                </div>
                <div className="stat-line">
                  <span className="stat-label">{labels.mp}</span>
                  <div className="stat-bar-track">
                    <div className="stat-bar-fill mp" style={{ width: `${mpPct}%` }} />
                  </div>
                  <span className="stat-value">{state?.mp ?? 0}/{maxMp}</span>
                </div>
              </div>

              {state?.conditions && state.conditions.length > 0 && (
                <div className="condition-tags">
                  {state.conditions.map((cond, i) => (
                    <span key={i} className="condition-tag">{cond}</span>
                  ))}
                </div>
              )}

              {characterSkills.length > 0 && (
                <div className="skill-tags">
                  {characterSkills.map((skill) => (
                    <span key={skill.id} className="skill-tag">{skill.name}</span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <button className="character-manage">{labels.manageCharacters}</button>
    </aside>
  );
}
