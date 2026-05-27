import { useState } from "react";
import { Download, Trash2, Upload, X } from "lucide-react";
import type { StoryPackage } from "@story-game/shared";
import type { SaveSlot } from "../../../lib/gameApi.js";

interface SaveLoadOverlayProps {
  mode: "save" | "load";
  title: string;
  saveSlots: SaveSlot[];
  storyPackage?: StoryPackage;
  stageName: string;
  gameRound: number;
  messageCount: number;
  onSave?: (slot: number) => void;
  onLoadBySlot?: (slot: number) => void;
  onDelete?: (saveId: string, slot: number) => void;
  onClose: () => void;
}

export function SaveLoadOverlay({
  mode,
  title,
  saveSlots,
  storyPackage,
  stageName,
  gameRound,
  messageCount,
  onSave,
  onLoadBySlot,
  onDelete,
  onClose,
}: SaveLoadOverlayProps) {
  const [confirmSlot, setConfirmSlot] = useState<number | null>(null);
  const thumbnailUrl = storyPackage?.thumbnail ?? "";

  function formatTime(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  }

  function stageDisplayFromSave(save: SaveSlot["save"]) {
    if (!save) return "";
    return save.label.replace(/^.*?\d{1,2}:\d{2}:\d{2}\s*/, "").trim() || "未知阶段";
  }

  function handleSlotClick(slot: SaveSlot) {
    if (mode === "save") {
      if (slot.save) {
        setConfirmSlot(slot.slot);
      } else {
        onSave?.(slot.slot);
      }
    } else {
      if (slot.save) {
        onLoadBySlot?.(slot.slot);
      }
    }
  }

  function handleConfirmOverwrite() {
    if (confirmSlot !== null) {
      onSave?.(confirmSlot);
      setConfirmSlot(null);
    }
  }

  return (
    <div className="rules-overlay" onClick={onClose}>
      <div className="save-load-panel" onClick={(e) => e.stopPropagation()}>
        <div className="save-load-header">
          <h2>{title}</h2>
          <button className="paper-icon" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </div>

        {mode === "save" && sessionStorage.getItem("auto-save-packageId") && (
          <p className="muted" style={{ margin: "0 0 12px 0", fontSize: "0.85rem" }}>
            当前：{storyPackage?.title ?? "未知"} · 第 {gameRound} 回合 · {stageName || "未知阶段"} · {messageCount} 条消息
          </p>
        )}

        <div className="save-slot-grid">
          {[1, 2, 3].map((slotNum) => {
            const slotData = saveSlots.find((s) => s.slot === slotNum);
            const save = slotData?.save ?? null;
            const isEmpty = !save;

            return (
              <div
                key={slotNum}
                className={`save-slot-card ${isEmpty ? "empty" : "filled"} ${mode === "save" && isEmpty ? "save-target" : ""}`}
                onClick={() => handleSlotClick({ slot: slotNum, save })}
              >
                <div className="save-slot-number">存档位 {slotNum}</div>

                {isEmpty ? (
                  <div className="save-slot-empty">
                    <div className="save-slot-thumb placeholder">
                      {mode === "save" ? <Download size={28} /> : <span className="empty-icon">—</span>}
                    </div>
                    <p className="save-slot-hint">
                      {mode === "save" ? "点击保存到此位置" : "空"}
                    </p>
                  </div>
                ) : (
                  <div className="save-slot-content">
                    <div className="save-slot-thumb-wrap">
                      {thumbnailUrl ? (
                        <img
                          className="save-slot-thumb"
                          src={`${thumbnailUrl}?t=${save.updatedAt}`}
                          alt=""
                        />
                      ) : (
                        <div className="save-slot-thumb placeholder">
                          {storyPackage?.title?.charAt(0) ?? "?"}
                        </div>
                      )}
                    </div>
                    <div className="save-slot-info">
                      <p className="save-slot-title">{storyPackage?.title ?? "未知故事"}</p>
                      <p className="save-slot-stage">{stageDisplayFromSave(save)}</p>
                      <p className="save-slot-meta">
                        第 {save.round} 回合 · {save.messageCount} 条消息
                      </p>
                      <p className="save-slot-time">{formatTime(save.updatedAt)}</p>
                      {save.status === "completed" && (
                        <span className="save-slot-badge completed">已完结</span>
                      )}
                    </div>
                    {mode === "load" && (
                      <div className="save-slot-actions">
                        <button
                          className="save-slot-action-btn load"
                          onClick={(e) => {
                            e.stopPropagation();
                            onLoadBySlot?.(slotNum);
                          }}
                        >
                          <Upload size={15} />
                          载入
                        </button>
                        <button
                          className="save-slot-action-btn delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete?.(save.sessionId, slotNum);
                          }}
                        >
                          <Trash2 size={15} />
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="save-load-footer">
          {mode === "save" && (
            <p className="muted" style={{ fontSize: "0.8rem" }}>
              点击空存档位保存，点击已占用存档位可覆盖
            </p>
          )}
          <button className="ghost-button" onClick={onClose}>关闭</button>
        </div>

        {confirmSlot !== null && (
          <div className="save-confirm-overlay" onClick={() => setConfirmSlot(null)}>
            <div className="save-confirm-dialog" onClick={(e) => e.stopPropagation()}>
              <p>存档位 {confirmSlot} 已有存档，确定覆盖吗？</p>
              <div className="save-confirm-actions">
                <button className="danger-button" onClick={handleConfirmOverwrite}>覆盖</button>
                <button className="ghost-button" onClick={() => setConfirmSlot(null)}>取消</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
