import type { StageBranch } from "@story-game/shared";

interface ChoiceCardsProps {
  choices: StageBranch[];
  onChoose: (index: number) => void;
  disabled?: boolean;
}

export function ChoiceCards({ choices, onChoose, disabled }: ChoiceCardsProps) {
  if (!choices.length) return null;

  return (
    <div className="choice-cards">
      {choices.map((branch, index) => (
        <button
          key={index}
          className="choice-card"
          disabled={disabled}
          onClick={() => onChoose(index)}
        >
          <span className="choice-index">{index + 1}</span>
          <span className="choice-body">
            <span className="choice-text">{branch.choiceText || branch.description || branch.targetStage}</span>
            {branch.description && branch.choiceText && (
              <span className="choice-desc">{branch.description}</span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
