import { useEffect } from "react";
import { AdminSidebar } from "./components/AdminSidebar.js";
import { Breadcrumb } from "./components/Breadcrumb.js";
import { StoryLibrary } from "./components/StoryLibrary.js";
import { StoryEditor } from "./components/StoryEditor.js";
import { LlmConfigPanel } from "./components/LlmConfigPanel.js";
import { ImportWizard } from "./components/ImportWizard.js";
import { AuditLogPage } from "./components/AuditLogPage.js";
import { PlaceholderPage } from "./components/PlaceholderPage.js";
import { useGameStore } from "../../store/gameStore.js";

export function AdminApp() {
  const { loadStoryPackages, loadLlmConfig, error } = useGameStore();
  const pathname = window.location.pathname;
  const storyPackages = useGameStore((s) => s.storyPackages);
  const editingPackageId = useGameStore((s) => s.editingPackageId);

  useEffect(() => {
    void loadStoryPackages();
    void loadLlmConfig();
  }, [loadStoryPackages, loadLlmConfig]);

  // Check if we're on a story package editor page
  const editorMatch = pathname.match(/^\/admin\/story-packages\/([^/]+)$/);
  const isEditor = editorMatch && storyPackages.some((p) => p.id === editorMatch[1]);
  const isImport = pathname === "/admin/story-packages/import";
  const isLibrary = pathname === "/admin/story-packages" || pathname === "/admin";
  const isModelConfig = pathname === "/admin/model-config";

  function renderContent() {
    if (isEditor && editorMatch) {
      const pkgId = editorMatch[1];
      // Sync store if needed
      if (editingPackageId !== pkgId) {
        const pkg = storyPackages.find((p) => p.id === pkgId);
        if (pkg) useGameStore.getState().editStoryPackage(pkgId);
      }
      return <StoryEditor />;
    }
    if (isImport) return <ImportWizard />;
    if (isModelConfig) return <LlmConfigPanel />;
    if (pathname === "/admin/sessions") return <PlaceholderPage title="会话管理" description="查看和管理所有运行中的故事会话。此功能即将推出。" />;
    if (pathname.startsWith("/admin/sessions/")) return <PlaceholderPage title="会话详情" description="查看会话消息历史、运行时状态和调试信息。此功能即将推出。" />;
    if (pathname === "/admin/runtime") return <PlaceholderPage title="运行时总览" description="全局运行时统计、LLM 调用指标和校验监控。此功能即将推出。" />;
    if (pathname === "/admin/audit-log") return <AuditLogPage />;
    // Default: library
    return <StoryLibrary />;
  }

  return (
    <main className="admin-shell">
      <AdminSidebar />
      <section className="admin-main">
        <Breadcrumb />
        {error ? <p className="error-banner">{error}</p> : null}
        <div className="admin-content">
          {renderContent()}
        </div>
      </section>
    </main>
  );
}
