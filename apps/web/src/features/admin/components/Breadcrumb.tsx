import { useGameStore } from "../../../store/gameStore.js";

const LABELS: Record<string, string> = {
  "story-packages": "故事包",
  "import": "导入",
  "sessions": "会话",
  "runtime": "运行时",
  "model-config": "模型配置",
  "audit-log": "审计日志",
};

export function Breadcrumb() {
  const storyPackages = useGameStore((s) => s.storyPackages);
  const editingPackageId = useGameStore((s) => s.editingPackageId);
  const pathname = window.location.pathname;
  const segments = pathname.replace("/admin/", "").split("/").filter(Boolean);

  const storyPackage = editingPackageId
    ? storyPackages.find((p) => p.id === editingPackageId)
    : undefined;
  const displaySegments = segments.map((seg, i) => {
    const isLast = i === segments.length - 1;
    if (seg === editingPackageId && storyPackage) {
      return { label: storyPackage.title, href: null, isLast };
    }
    return { label: LABELS[seg] ?? seg, href: null, isLast };
  });

  if (displaySegments.length === 0) return null;

  return (
    <nav className="breadcrumb" aria-label="面包屑">
      {displaySegments.map((seg, i) => (
        <span key={i}>
          {i > 0 && <span className="breadcrumb-sep"> / </span>}
          {seg.isLast ? (
            <span className="breadcrumb-current">{seg.label}</span>
          ) : (
            <span>{seg.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
