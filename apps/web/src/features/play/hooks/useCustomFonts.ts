import { useEffect, useRef } from "react";
import type { StoryPluginManifest } from "@story-game/shared";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export function useCustomFonts(
  manifest: StoryPluginManifest | null,
  packageId: string | null
) {
  const styleRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    if (!manifest?.capabilities?.customFonts || !packageId) return;

    const fonts = manifest.fonts;
    const rules: string[] = [];

    function addFont(role: string, relPath: string | undefined) {
      if (!relPath) return;
      const family = `story-font-${role}-${packageId}`;
      const url = `${API_BASE}/api/story-assets/${encodeURIComponent(packageId!)}/${relPath}`;
      rules.push(`@font-face { font-family: "${family}"; src: url("${url}"); font-display: swap; }`);
      if (role === "heading") {
        document.documentElement.style.setProperty("--font-heading", `"${family}", var(--font-heading-fallback, "STKaiti", "KaiTi", serif)`);
        document.documentElement.style.setProperty("--font-narrator", `"${family}", var(--font-narrator-fallback, "STKaiti", "KaiTi", serif)`);
      } else if (role === "body") {
        document.documentElement.style.setProperty("--font-body", `"${family}", var(--font-body-fallback, "Inter", sans-serif)`);
      }
    }

    addFont("heading", fonts.heading);
    addFont("body", fonts.body);
    addFont("ui", fonts.ui);

    if (rules.length > 0) {
      const style = document.createElement("style");
      style.textContent = rules.join("\n");
      document.head.appendChild(style);
      styleRef.current = style;
    }

    return () => {
      if (styleRef.current) {
        document.head.removeChild(styleRef.current);
        styleRef.current = null;
      }
      document.documentElement.style.removeProperty("--font-heading");
      document.documentElement.style.removeProperty("--font-narrator");
      document.documentElement.style.removeProperty("--font-body");
    };
  }, [manifest, packageId]);
}
