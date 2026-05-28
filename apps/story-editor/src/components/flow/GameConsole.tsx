import { useEffect, useRef } from "react";
import type { ConsoleEntry, ChoiceOption, RunStatus } from "../../lib/flowRunner.js";

interface Props {
  visible: boolean;
  log: ConsoleEntry[];
  choices?: ChoiceOption[];
  onChoice: (index: number) => void;
  status: RunStatus;
  onContinue: () => void;
  onStop: () => void;
  onClose: () => void;
  characterColors?: Record<string, string>;
}

const DEFAULT_CHAR_COLORS: Record<string, string> = {
  "冷霜": "#f778ba",
  "帝王": "#d2991d",
  "火娘": "#f85149",
  "青鸾": "#58a6ff",
  "乌托邦": "#a371f7",
};

function charColor(name: string, map?: Record<string, string>): string {
  if (map?.[name]) return map[name];
  if (DEFAULT_CHAR_COLORS[name]) return DEFAULT_CHAR_COLORS[name];
  return "var(--cat-blue)";
}

export function GameConsole({ visible, log, choices, onChoice, status, onContinue, onStop, onClose }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log, choices]);

  if (!visible) return null;

  const waitingChoice = status === "waiting_choice";
  const isRunning = status === "running";
  const isFinished = status === "finished";
  const isIdle = status === "idle";

  return (
    <div className="console-panel">
      {/* Header */}
      <div className="console-header">
        <div className="console-header-left">
          <span className="console-header-icon">&#9654;</span>
          <span>流程模拟终端</span>
          {isRunning && <span className="console-badge running">运行中</span>}
          {waitingChoice && <span className="console-badge waiting">等待选择</span>}
          {isFinished && <span className="console-badge finished">已完成</span>}
        </div>
        <div className="console-header-right">
          <button className="btn btn-ghost btn-xs" onClick={onStop} title="停止">&#9209;</button>
          <button className="btn btn-ghost btn-xs" onClick={onClose} title="关闭">&#10005;</button>
        </div>
      </div>

      {/* Log area */}
      <div className="console-body">
        {log.length === 0 && (
          <div className="console-empty">
            <div style={{ fontSize: 24, marginBottom: 8 }}>&#9654;</div>
            <div>从节点右键菜单选择「从此运行」开始模拟</div>
            <div className="faint mt2" style={{ fontSize: "var(--fs-xs)" }}>
              终端将显示模块叙事、判定结果和分支选项
            </div>
          </div>
        )}

        {log.map((entry, i) => (
          <div key={i} className={`console-entry entry-${entry.type}`}>
            {entry.type === "divider" && (
              <div className="console-divider" />
            )}
            {entry.type === "title" && (
              <div className="console-title">{entry.text}</div>
            )}
            {entry.type === "narrative" && (
              <div className="console-narrative">{entry.text || " "}</div>
            )}
            {entry.type === "dialogue" && (
              <div className="console-dialogue">
                {entry.character && (
                  <span className="console-char" style={{ color: charColor(entry.character) }}>
                    &#9654; {entry.character}
                  </span>
                )}
                {entry.action && (
                  <span className="console-action">{entry.action}</span>
                )}
                {entry.text && (
                  <span>：{entry.text}</span>
                )}
              </div>
            )}
            {entry.type === "system" && (
              <div className="console-system">{entry.text}</div>
            )}
            {entry.type === "judgment" && (
              <div className="console-judgment">
                <div className="console-judgment-title">{entry.text}</div>
                {entry.details?.map((d, di) => (
                  <div key={di} className="console-judgment-row">
                    <span className="console-judgment-label">{d.label}</span>
                    <span className={`console-judgment-mark ${d.passed ? "pass" : "fail"}`}>
                      {d.passed ? "✅ 通过" : "❌ 未通过"}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {entry.type === "result" && (
              <div className={`console-result ${entry.passed === false ? "fail" : ""}`}>
                &#9654; {entry.text}
              </div>
            )}
            {entry.type === "choice_prompt" && (
              <div className="console-choice-prompt">{entry.text}</div>
            )}
            {entry.type === "choice_prompt" && (
              <div className="console-choice-prompt">{entry.text}</div>
            )}
          </div>
        ))}

        {/* Choice buttons */}
        {choices && choices.length > 0 && (
          <div className="console-choices">
            <div className="console-choices-title">──── 抉择 ────</div>
            <div className="console-choices-row">
              {choices.map((c) => (
                <button
                  key={c.handleId}
                  className="btn console-choice-btn"
                  onClick={() => onChoice(c.index)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Control bar */}
      <div className="console-footer">
        {!isFinished ? (
          <button
            className="btn btn-primary btn-sm"
            onClick={onContinue}
            disabled={waitingChoice}
          >
            {isIdle ? "开始" : waitingChoice ? "等待选择..." : "继续"}
          </button>
        ) : (
          <button className="btn btn-sm" onClick={onStop}>
            重新开始
          </button>
        )}
        <span className="faint" style={{ fontSize: "var(--fs-xs)" }}>
          {waitingChoice ? "请点击上方选项" : isFinished ? "流程已完成" : "单击继续推进"}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={onStop} style={{ marginLeft: "auto" }}>
          停止
        </button>
      </div>
    </div>
  );
}
