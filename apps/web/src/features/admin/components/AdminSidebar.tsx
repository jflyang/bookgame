import { Package, List, Activity, SlidersHorizontal, FileText, ArrowLeft } from "lucide-react";
import { useGameStore } from "../../../store/gameStore.js";

export function AdminSidebar() {
  const { showLibrary, showSessions, showRuntime, showModelConfig, showAuditLog } = useGameStore();
  const pathname = window.location.pathname;

  function isActive(path: string) {
    return pathname.startsWith(path);
  }

  return (
    <aside className="admin-nav" aria-label="管理导航">
      <div className="window-dots" aria-hidden="true"><span /><span /><span /></div>
      <div className="nav-stack">
        <button aria-label="故事包" title="故事包" className={isActive("/admin/story-packages") ? "active" : ""} onClick={() => showLibrary()}>
          <Package size={24} />
        </button>
        <button aria-label="会话" title="会话" className={isActive("/admin/sessions") ? "active" : ""} onClick={() => showSessions()}>
          <List size={24} />
        </button>
        <button aria-label="运行时" title="运行时" className={isActive("/admin/runtime") ? "active" : ""} onClick={() => showRuntime()}>
          <Activity size={24} />
        </button>
        <button aria-label="模型配置" title="模型配置" className={isActive("/admin/model-config") ? "active" : ""} onClick={() => showModelConfig()}>
          <SlidersHorizontal size={24} />
        </button>
        <button aria-label="审计日志" title="审计日志" className={isActive("/admin/audit-log") ? "active" : ""} onClick={() => showAuditLog()}>
          <FileText size={24} />
        </button>
      </div>
      <div className="nav-stack nav-bottom">
        <a href="/" aria-label="返回游戏" title="返回游戏"><ArrowLeft size={24} /></a>
      </div>
    </aside>
  );
}
