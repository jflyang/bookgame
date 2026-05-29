import { existsSync } from "node:fs";
import { resolveInside } from "./pathGuards.js";
import type { StoryPluginManifest } from "@story-game/shared";

export interface PluginAssetIndex {
  packageId: string;
  bgm: Map<string, string>;
  sfx: Map<string, string>;
  portraits: Map<string, string>;
  backgrounds: Map<string, string>;
  performances: Map<string, string[]>;
  fonts: { heading?: string; body?: string; ui?: string };
  customCssPath: string | null;
}

export function buildPluginIndex(
  packageDir: string,
  manifest: StoryPluginManifest
): PluginAssetIndex {
  const index: PluginAssetIndex = {
    packageId: manifest.id,
    bgm: new Map(),
    sfx: new Map(),
    portraits: new Map(),
    backgrounds: new Map(),
    performances: new Map(),
    fonts: { ...manifest.fonts },
    customCssPath: null,
  };

  // BGM
  if (manifest.audio.bgm.default) {
    const path = resolveInside(packageDir, manifest.audio.bgm.default);
    if (existsSync(path)) index.bgm.set("default", manifest.audio.bgm.default);
  }
  for (const [stage, relPath] of Object.entries(manifest.audio.bgm.scenes)) {
    const path = resolveInside(packageDir, relPath);
    if (existsSync(path)) index.bgm.set(stage, relPath);
  }

  // SFX
  for (const [event, relPath] of Object.entries(manifest.audio.sfx)) {
    const path = resolveInside(packageDir, relPath);
    if (existsSync(path)) index.sfx.set(event, relPath);
  }

  // Portraits
  for (const [charId, relPath] of Object.entries(manifest.images.portraits)) {
    const path = resolveInside(packageDir, relPath);
    if (existsSync(path)) index.portraits.set(charId, relPath);
  }

  // Backgrounds
  for (const [bgId, relPath] of Object.entries(manifest.images.backgrounds)) {
    const path = resolveInside(packageDir, relPath);
    if (existsSync(path)) index.backgrounds.set(bgId, relPath);
  }

  // Performance assets
  for (const [performanceId, performance] of Object.entries(manifest.performances)) {
    const referencedPaths = new Set<string>();
    if (performance.video) {
      for (const [role, relPath] of Object.entries(performance.video)) {
        if (typeof relPath !== "string" || !relPath) continue;
        const path = resolveInside(packageDir, relPath);
        if (existsSync(path)) referencedPaths.add(relPath);
      }
    }
    for (const [role, relPath] of Object.entries(performance.layers)) {
      const path = resolveInside(packageDir, relPath);
      if (existsSync(path)) referencedPaths.add(relPath);
    }
    for (const [role, relPath] of Object.entries(performance.audio)) {
      const pathList = Array.isArray(relPath) ? relPath : [relPath];
      for (const singlePath of pathList) {
        if (typeof singlePath !== "string") continue;
        const path = resolveInside(packageDir, singlePath);
        if (existsSync(path)) referencedPaths.add(singlePath);
      }
    }
    index.performances.set(performanceId, [...referencedPaths]);
  }

  // Fonts
  for (const [role, relPath] of Object.entries(manifest.fonts)) {
    if (!relPath) continue;
    const path = resolveInside(packageDir, relPath as string);
    if (!existsSync(path)) continue;
  }

  // Custom CSS
  if (manifest.capabilities.customCss) {
    const cssPath = resolveInside(packageDir, "theme", "custom.css");
    if (existsSync(cssPath)) {
      index.customCssPath = "theme/custom.css";
    }
  }

  return index;
}

function throwMissing(label: string, path: string): void {
  console.warn(`[plugin-index] Missing asset (skipped): ${label} → ${path}`);
}
