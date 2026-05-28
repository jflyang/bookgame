import { useState } from "react";
import { useEditorStore } from "../store/editorStore.js";

export function UIConfigEditor() {
  const { storyPackage } = useEditorStore();
  const uiConfig = (storyPackage as any)?.uiConfig || {};
  const [raw, setRaw] = useState(JSON.stringify(uiConfig, null, 2));
  const [error, setError] = useState("");
  const keys = Object.keys(uiConfig);
  const hasData = keys.length > 0;

  function handleSave() {
    try {
      const parsed = JSON.parse(raw);
      const pkg = useEditorStore.getState().storyPackage;
      if (pkg) {
        useEditorStore.setState({
          storyPackage: { ...pkg, uiConfig: parsed } as any,
          dirty: true,
        });
        setError("");
      }
    } catch {
      setError("JSON 格式错误");
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>UI 配置</h2>
          <span className="faint">ui/config.json</span>
        </div>
        <div className="flex-center gap2">
          {error && <span className="tag tag-red">{error}</span>}
          <button className="btn btn-primary btn-sm" onClick={handleSave}>保存</button>
        </div>
      </div>

      {!hasData ? (
        <div className="empty-state">
          <p>当前无 UI 配置数据</p>
          <span className="hint">在下方 JSON 编辑器中创建配置，或使用 AI 助手生成。<br />
            参考字段：scene、panels、colors</span>
        </div>
      ) : (
        <div className="form-grid cols-4 mb3">
          {keys.map((k) => (
            <div key={k} className="card">
              <div style={{ fontWeight: 600, fontSize: "var(--fs-sm)", color: "var(--accent-hover)" }}>{k}</div>
              <div className="faint truncate">
                {typeof uiConfig[k] === "object" ? JSON.stringify(uiConfig[k]).slice(0, 40) + "..." : String(uiConfig[k]).slice(0, 40)}
              </div>
            </div>
          ))}
        </div>
      )}

      <label className="field">
        <span>JSON 编辑器</span>
        <textarea
          className="input mono"
          rows={14}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
      </label>
    </div>
  );
}
