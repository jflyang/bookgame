import { useEffect, useRef } from "react";

interface Props {
  x: number;
  y: number;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
  onRunFromHere?: () => void;
}

export function NodeContextMenu({ x, y, onEdit, onDuplicate, onDelete, onClose, onRunFromHere }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    // Delay to avoid immediate close from the right-click event itself
    setTimeout(() => {
      window.addEventListener("click", handleClick);
      window.addEventListener("keydown", handleKey);
    }, 0);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const items = [
    { label: "编辑", action: onEdit, shortcut: "Enter" },
    { label: "复制", action: onDuplicate, shortcut: "Ctrl+D" },
    { label: "删除", action: onDelete, shortcut: "Del", danger: true },
    ...(onRunFromHere ? [{ label: "从此运行", action: onRunFromHere, shortcut: "Ctrl+R", accent: true }] : []),
  ];

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 10000,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        minWidth: 140,
        padding: "var(--s1)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => { item.action(); onClose(); }}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "6px var(--s4)",
            border: "none",
            background: "transparent",
            color: item.danger ? "var(--danger)" : item.accent ? "var(--cat-blue)" : "var(--text2)",
            fontFamily: "var(--font)",
            fontSize: "var(--fs-sm)",
            cursor: "pointer",
            borderRadius: "var(--r-sm)",
            textAlign: "left",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = item.danger ? "var(--danger-bg)" : "var(--accent-bg)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <span>{item.label}</span>
          <span style={{ fontSize: 9, color: "var(--text-faint)", marginLeft: "var(--s5)" }}>{item.shortcut}</span>
        </button>
      ))}
    </div>
  );
}
