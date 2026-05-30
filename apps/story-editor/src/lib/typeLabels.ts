/** Display-friendly labels and colors for module/stage types. */
export const TYPE_LABELS: Record<string, string> = {
  training:    "主线",
  serving:     "场景",
  punishment:  "考验",
  daily:       "日常",
  finale:      "终章",
  choice:      "抉择",
  event:       "事件",
  combat:      "战斗",
};

export const TYPE_COLORS: Record<string, string> = {
  training:    "#58a6ff",
  serving:     "#7c3aed",
  punishment:  "#f59e0b",
  daily:       "#6e7681",
  finale:      "#10b981",
  choice:      "#d2991d",
  event:       "#f85149",
  combat:      "#ef4444",
};

/** CSS color map for ReactFlow node colorKey styling. */
export const TYPE_CSS_COLORS: Record<string, string> = {
  training:    "var(--cat-blue)",
  serving:     "var(--cat-purple)",
  punishment:  "var(--cat-orange)",
  daily:       "var(--cat-gray)",
  finale:      "var(--cat-green)",
  choice:      "var(--cat-yellow)",
  event:       "var(--cat-red)",
  combat:      "var(--cat-red)",
};

/** Node background colors for ModuleNode component. */
export const TYPE_NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  training:    { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  serving:     { bg: "#ede9fe", border: "#7c3aed", text: "#4c1d95" },
  punishment:  { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
  daily:       { bg: "#f3f4f6", border: "#6b7280", text: "#374151" },
  finale:      { bg: "#d1fae5", border: "#10b981", text: "#065f46" },
  choice:      { bg: "#fef9c3", border: "#eab308", text: "#854d0e" },
  event:       { bg: "#fee2e2", border: "#ef4444", text: "#991b1b" },
  combat:      { bg: "#fee2e2", border: "#ef4444", text: "#991b1b" },
};
