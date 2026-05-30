import { useState, type FC, type DragEvent } from "react";
import { useFlowStore } from "../../store/flowStore.js";
import { useEditorStore } from "../../store/editorStore.js";

interface ToolItem { type: string; label: string; color: string }

const TOOL_GROUPS: { label: string; items: ToolItem[] }[] = [
  {
    label: "基础节点",
    items: [
      { type: "module", label: "故事模块", color: "var(--cat-blue)" },
      { type: "choice", label: "多分支抉择", color: "var(--cat-purple)" },
      { type: "judgment", label: "判断节点", color: "var(--cat-orange)" },
    ],
  },
  {
    label: "事件节点",
    items: [
      { type: "eventTrigger", label: "事件触发", color: "var(--cat-orange)" },
      { type: "randomEvent", label: "随机事件", color: "var(--cat-pink)" },
      { type: "randomJudgment", label: "随机判断", color: "var(--cat-purple)" },
    ],
  },
  {
    label: "控制流",
    items: [
      { type: "loop", label: "循环入口", color: "var(--cat-blue)" },
      { type: "dailyTrigger", label: "日常触发", color: "var(--cat-gray)" },
    ],
  },
  {
    label: "端点",
    items: [
      { type: "start", label: "开始", color: "var(--cat-green)" },
      { type: "end", label: "结束", color: "var(--cat-red)" },
    ],
  },
];

export const FlowToolbar: FC<{ onRelayout: () => void; onValidate: () => void }> = ({ onRelayout, onValidate }) => {
  const store = useFlowStore();
  const editorStore = useEditorStore();
  const [saving, setSaving] = useState(false);

  const onDragStart = (event: DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow-type", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await editorStore.save();
    } catch (err) {
      alert("保存失败：" + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      width: 170, background: "var(--bg2)", borderRight: "1px solid var(--border)",
      padding: "var(--s3) var(--s4)", display: "flex", flexDirection: "column", gap: "var(--s1)",
      overflowY: "auto", flexShrink: 0,
    }}>
      <div className="section-title" style={{ padding: 0 }}>节点工具箱</div>
      <span className="faint">拖拽到画布创建节点</span>

      {TOOL_GROUPS.map((group) => (
        <div key={group.label} style={{ marginTop: "var(--s2)" }}>
          <div style={{
            fontSize: 9, fontWeight: 600, color: "var(--text-faint)",
            textTransform: "uppercase", letterSpacing: "0.05em",
            marginBottom: "var(--s1)", paddingLeft: 2,
          }}>
            {group.label}
          </div>
          {group.items.map((item) => (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => onDragStart(e, item.type)}
              style={{
                background: "var(--surface)", border: "1px solid var(--border-light)",
                borderRadius: "var(--r-md)", padding: "6px 10px", cursor: "grab",
                display: "flex", alignItems: "center", gap: "var(--s2)",
                fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--text2)",
                userSelect: "none", transition: "background 0.1s, border-color 0.1s",
                marginBottom: 2,
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.background = "var(--surface2)";
                el.style.borderColor = item.color;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.background = "var(--surface)";
                el.style.borderColor = "var(--border-light)";
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background: item.color,
              }} />
              {item.label}
            </div>
          ))}
        </div>
      ))}

      <div style={{ borderTop: "1px solid var(--border)", marginTop: "var(--s3)", paddingTop: "var(--s3)", display: "flex", flexDirection: "column", gap: "var(--s1)" }}>
        <button
          className="btn btn-success"
          style={{ width: "100%", fontSize: "var(--fs-sm)" }}
          onClick={handleSave}
          disabled={saving || !store.initialized}
        >
          {saving ? "保存中..." : "💾 统一保存"}
        </button>
        <button
          className="btn"
          style={{ width: "100%", fontSize: "var(--fs-sm)" }}
          onClick={onRelayout}
        >
          自动布局
        </button>
        <button
          className="btn"
          style={{ width: "100%", fontSize: "var(--fs-sm)" }}
          onClick={onValidate}
        >
          流程校验
        </button>
      </div>

      <div className="faint mt3" style={{ lineHeight: 1.7 }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>操作提示</div>
        <div>拖拽节点到画布</div>
        <div>拖拽端口连线</div>
        <div>双击节点编辑内容</div>
        <div>右键节点复制/删除</div>
        <div>Delete 键删除选中</div>
        <div>单击边改名</div>
      </div>
    </div>
  );
};
