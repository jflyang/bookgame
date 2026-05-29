import { useState } from "react";
import { X } from "lucide-react";
import type { GameState } from "@story-game/shared";

interface Props {
  gameState: GameState;
  onJump: (stageId: string) => void;
  onClose: () => void;
}

export function StageJumpModal({ gameState, onJump, onClose }: Props) {
  const [selected, setSelected] = useState(gameState.scenario.currentStage);
  const stages = gameState.scenario.stages;
  const stageDetails = gameState.scenario.stageDetails ?? [];
  const currentStage = gameState.scenario.currentStage;

  return (
    <div className="rules-overlay" onClick={onClose}>
      <div className="rules-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, border: "none", padding: 0 }}>跳转阶段</h2>
          <button className="paper-icon" onClick={onClose} aria-label="关闭"><X size={20} /></button>
        </div>

        <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "var(--color-text-muted, #666)" }}>
          当前回合 {gameState.round} · 阶段「{stageDetails.find((s) => s.id === currentStage)?.title || currentStage}」
        </p>

        <div style={{ maxHeight: "50vh", overflowY: "auto", border: "1px solid var(--color-border-light, #ded1bf)", borderRadius: 8, marginBottom: 16 }}>
          {stages.map((stageId, idx) => {
            const detail = stageDetails.find((s) => s.id === stageId);
            const isCurrent = stageId === currentStage;
            const isSelected = stageId === selected;
            return (
              <div
                key={stageId}
                onClick={() => setSelected(stageId)}
                style={{
                  padding: "10px 14px",
                  cursor: "pointer",
                  background: isSelected
                    ? "var(--color-accent, #2b987a)"
                    : isCurrent
                      ? "rgba(217, 119, 6, 0.1)"
                      : idx % 2 === 0
                        ? "transparent"
                        : "rgba(0,0,0,0.02)",
                  color: isSelected ? "#fff" : "inherit",
                  borderBottom: "1px solid var(--color-border-light, #f1f5f9)",
                  transition: "background 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {isCurrent && <span style={{ fontSize: "0.7rem", color: isSelected ? "#fff" : "#d97706" }}>●</span>}
                  <span style={{ fontWeight: isSelected || isCurrent ? 600 : 400, fontSize: "0.88rem" }}>
                    {detail?.title || stageId}
                  </span>
                </div>
                {detail?.description && (
                  <div style={{
                    fontSize: "0.75rem",
                    color: isSelected ? "rgba(255,255,255,0.8)" : "var(--color-text-muted, #64748b)",
                    marginTop: 3,
                    paddingLeft: isCurrent ? 18 : 0,
                  }}>
                    {detail.description.length > 80 ? detail.description.slice(0, 80) + "…" : detail.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="paper-button" onClick={onClose}>取消</button>
          <button
            className="paper-button"
            style={{
              background: selected !== currentStage ? "var(--color-accent, #2b987a)" : "#ccc",
              color: selected !== currentStage ? "#fff" : "#888",
              cursor: selected !== currentStage ? "pointer" : "not-allowed",
            }}
            disabled={selected === currentStage}
            onClick={() => onJump(selected)}
          >
            跳转到此阶段
          </button>
        </div>
      </div>
    </div>
  );
}
