import { useEffect, useRef } from "react";
import type { StoryPluginManifest } from "@story-game/shared";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export function useCustomCss(
  manifest: StoryPluginManifest | null,
  packageId: string | null
) {
  const linkRef = useRef<HTMLLinkElement | null>(null);

  useEffect(() => {
    if (!manifest?.capabilities?.customCss || !packageId) return;

    const cssUrl = `${API_BASE}/api/story-assets/${encodeURIComponent(packageId)}/theme/custom.css`;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssUrl;
    link.setAttribute("data-story-plugin", packageId);
    document.head.appendChild(link);
    linkRef.current = link;

    return () => {
      if (linkRef.current) {
        document.head.removeChild(linkRef.current);
        linkRef.current = null;
      }
    };
  }, [manifest, packageId]);
}
