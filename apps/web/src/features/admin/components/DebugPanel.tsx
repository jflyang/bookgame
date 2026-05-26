import { Bug } from "lucide-react";
import { useGameStore } from "../../../store/gameStore.js";

export function DebugPanel() {
  const debug = useGameStore((state) => state.debug);
  const characters = useGameStore((state) => state.characters);
  const skills = useGameStore((state) => state.skills);

  if (!debug || Object.keys(debug).length === 0) {
    return (
      <section className="panel debug-panel">
        <h2><Bug size={16} /> 调试面板</h2>
        <pre>{JSON.stringify({ status: "等待首轮生成" }, null, 2)}</pre>
      </section>
    );
  }

  const speaker = typeof debug.selectedSpeakerId === "string"
    ? characters.find((c) => c.id === debug.selectedSpeakerId)
    : null;
  const skill = typeof debug.usedSkill === "string"
    ? skills.find((s) => s.id === debug.usedSkill)
    : null;
  const promptLayers = Array.isArray(debug.promptLayers) ? debug.promptLayers as string[] : [];
  const validation = typeof debug.validation === "string" ? debug.validation : "未知";

  return (
    <section className="panel debug-panel">
      <h2><Bug size={16} /> 调试面板</h2>

      <div className="field-grid">
        <div>
          <span className="field-title">选中发言角色</span>
          <p>{speaker ? `${speaker.name}（${speaker.role}）` : "-"}</p>
        </div>
        <div>
          <span className="field-title">使用技能</span>
          <p>{skill ? `${skill.name}` : "未使用技能"}</p>
        </div>
        <div>
          <span className="field-title">校验状态</span>
          <p style={{ color: validation === "passed" ? "#166534" : "#991b1b" }}>{validation}</p>
        </div>
        <div>
          <span className="field-title">Prompt 注入层</span>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {promptLayers.map((layer, i) => (
              <li key={i}>{layer}</li>
            ))}
          </ul>
        </div>
      </div>

      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: "pointer", color: "#7a746b", fontSize: "0.85rem" }}>原始数据</summary>
        <pre style={{ fontSize: "0.75rem", marginTop: 8 }}>{JSON.stringify(debug, null, 2)}</pre>
      </details>
    </section>
  );
}

