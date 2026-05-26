import { useEffect, useState } from "react";
import { AdminApp } from "./features/admin/AdminApp.js";
import { PlayApp } from "./features/play/PlayApp.js";

export function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const updatePath = () => setPath(window.location.pathname);
    window.addEventListener("popstate", updatePath);
    window.addEventListener("app:navigate", updatePath);
    return () => {
      window.removeEventListener("popstate", updatePath);
      window.removeEventListener("app:navigate", updatePath);
    };
  }, []);

  return path.startsWith("/admin") ? <AdminApp /> : <PlayApp />;
}
