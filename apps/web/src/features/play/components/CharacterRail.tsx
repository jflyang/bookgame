import type { Character, CharacterId, CharacterState, InitialCharacterState } from "@story-game/shared";
import { useLabels, useUiConfig } from "../UiConfigContext.js";
import { useStoryAssets } from "../contexts/StoryAssetsContext.js";
import { useGameStore } from "../../../store/gameStore.js";

interface Props {
  characters: Character[];
  states: CharacterState[];
  lastSpeakerId: CharacterId | null;
  initialStates?: InitialCharacterState[];
}

export function CharacterRail({ characters, states, lastSpeakerId, initialStates }: Props) {
  const { selectedCharacterId, selectCharacter, gameState } = useGameStore();
  const labels = useLabels();
  const uiConfig = useUiConfig();
  const { getPortraitUrl } = useStoryAssets();
  const avatarStyle = uiConfig?.avatar?.style ?? "gradient";

  const defaultSpeakerId = gameState?.scenario?.defaultSpeakerId;
  const sorted = defaultSpeakerId
    ? [...characters].sort((a, b) => (a.id === defaultSpeakerId ? -1 : b.id === defaultSpeakerId ? 1 : 0))
    : characters;

  function isImageAvatar(avatar: string | undefined) {
    return Boolean(avatar?.startsWith("data:image") || avatar?.startsWith("http"));
  }

  function avatarElement(character: Character) {
    const portraitUrl = getPortraitUrl(character.id);
    if (portraitUrl) {
      return (
        <span
          className="avatar portrait-avatar image-avatar"
          style={{ backgroundImage: `url(${portraitUrl})` }}
        />
      );
    }
    if (isImageAvatar(character.avatar)) {
      return (
        <span
          className="avatar portrait-avatar image-avatar"
          style={{ backgroundImage: `url(${character.avatar})` }}
        />
      );
    }
    if (avatarStyle === "emoji") {
      return (
        <span className="avatar portrait-avatar text-avatar">
          {character.avatar || character.name.charAt(0)}
        </span>
      );
    }
    return <span className={`avatar portrait-avatar avatar-${character.id}`}>{character.avatar}</span>;
  }

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
        {sorted.map((character) => {
          const state = states.find((item) => item.characterId === character.id);
          const selected = selectedCharacterId === character.id;
          const isLastSpeaker = lastSpeakerId === character.id;
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
                {avatarElement(character)}
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

            </button>
          );
        })}
      </div>
    </aside>
  );
}
