import { createContext, useContext, type ReactNode } from "react";
import type { StoryPluginManifest } from "@story-game/shared";

interface StoryAssetsContextValue {
  getPortraitUrl(characterId: string): string | null;
  getBackgroundUrl(backgroundId?: string): string | null;
  getAssetUrl(relativePath: string): string;
  manifest: StoryPluginManifest | null;
}

const StoryAssetsCtx = createContext<StoryAssetsContextValue>({
  getPortraitUrl: () => null,
  getBackgroundUrl: () => null,
  getAssetUrl: () => "",
  manifest: null,
});

export function useStoryAssets() {
  return useContext(StoryAssetsCtx);
}

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export function StoryAssetsProvider({
  packageId,
  manifest,
  children,
}: {
  packageId: string | null;
  manifest: StoryPluginManifest | null;
  children: ReactNode;
}) {
  function getAssetUrl(relativePath: string): string {
    if (!packageId) return "";
    return `${API_BASE}/api/story-assets/${encodeURIComponent(packageId)}/${relativePath}`;
  }

  function getPortraitUrl(characterId: string): string | null {
    if (!manifest?.images?.portraits || !packageId) return null;
    const relPath = manifest.images.portraits[characterId];
    if (!relPath) return null;
    return getAssetUrl(relPath);
  }

  function getBackgroundUrl(backgroundId?: string): string | null {
    if (!manifest?.images?.backgrounds || !packageId) return null;
    const key = backgroundId ?? "default";
    const relPath = manifest.images.backgrounds[key];
    if (!relPath) return null;
    return getAssetUrl(relPath);
  }

  return (
    <StoryAssetsCtx.Provider value={{ getPortraitUrl, getBackgroundUrl, getAssetUrl, manifest }}>
      {children}
    </StoryAssetsCtx.Provider>
  );
}
