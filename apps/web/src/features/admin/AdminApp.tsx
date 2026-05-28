import { useEffect } from "react";
import { AdminSidebar } from "./components/AdminSidebar.js";
import { Breadcrumb } from "./components/Breadcrumb.js";
import { StoryLibrary } from "./components/StoryLibrary.js";
import { StoryEditor } from "./components/StoryEditor.js";
import { LlmConfigPanel } from "./components/LlmConfigPanel.js";
import { ImportWizard } from "./components/ImportWizard.js";
import { AuditLogPage } from "./components/AuditLogPage.js";
import { RuntimeDashboard } from "./components/RuntimeDashboard.js";
import { SessionList } from "./components/SessionList.js";
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
  const editorPkgId = editorMatch?.[1] ? decodeURIComponent(editorMatch[1]) : undefined;
  const isEditor = editorPkgId && storyPackages.some((p) => p.id === editorPkgId);
  const isImport = pathname === "/admin/story-packages/import";
  const isLibrary = pathname === "/admin/story-packages" || pathname === "/admin";
  const isModelConfig = pathname === "/admin/model-config";

  // Sync editor state in effect, not during render
  useEffect(() => {
    if (editorPkgId && editingPackageId !== editorPkgId) {
      const pkg = storyPackages.find((p) => p.id === editorPkgId);
      if (pkg) useGameStore.getState().editStoryPackage(editorPkgId);
    }
  }, [editorPkgId, editingPackageId, storyPackages]);

  function renderContent() {
    if (isEditor) {
      return <StoryEditor />;
    }
    if (isImport) return <ImportWizard />;
    if (isModelConfig) return <LlmConfigPanel />;
    if (pathname === "/admin/sessions" || pathname.startsWith("/admin/sessions/")) return <SessionList />;
    if (pathname === "/admin/runtime") return <RuntimeDashboard />;
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
