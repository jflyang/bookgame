import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import type { StoryPluginManifest } from "@story-game/shared";
import { buildPluginIndex } from "../pluginPackageIndex.js";
import { ensureDir } from "../pathGuards.js";

function makeManifest(overrides: Partial<StoryPluginManifest> = {}): StoryPluginManifest {
  return {
    id: "test-pkg",
    type: "story-plugin",
    schemaVersion: "2",
    title: "Test Package",
    description: "",
    version: "1.0.0",
    author: "",
    capabilities: { audio: false, customFonts: false, customCss: false, characterPortraits: false, backgroundImages: false, performances: false },
    audio: { bgm: { default: undefined, scenes: {} }, sfx: {} },
    images: { portraits: {}, backgrounds: {} },
    fonts: {},
    performances: {},
    entry: "story.json",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("buildPluginIndex", () => {
  let packageDir: string;

  beforeEach(() => {
    packageDir = mkdtempSync(join(tmpdir(), "plugin-index-"));
  });

  afterEach(() => {
    try { rmSync(packageDir, { recursive: true, force: true }); } catch { /* cleanup */ }
  });

  it("builds empty index for minimal manifest", () => {
    const manifest = makeManifest();
    const index = buildPluginIndex(packageDir, manifest);
    expect(index.packageId).toBe("test-pkg");
    expect(index.bgm.size).toBe(0);
    expect(index.sfx.size).toBe(0);
    expect(index.portraits.size).toBe(0);
    expect(index.backgrounds.size).toBe(0);
    expect(index.performances.size).toBe(0);
    expect(index.customCssPath).toBeNull();
  });

  it("indexes BGM files declared in manifest", () => {
    ensureDir(join(packageDir, "assets", "audio", "bgm"));
    writeFileSync(join(packageDir, "assets", "audio", "bgm", "intro.mp3"), "fake-mp3");
    writeFileSync(join(packageDir, "assets", "audio", "bgm", "battle.ogg"), "fake-ogg");

    const manifest = makeManifest({
      capabilities: { audio: true, customFonts: false, customCss: false, characterPortraits: false, backgroundImages: false, performances: false },
      audio: {
        bgm: {
          default: "assets/audio/bgm/intro.mp3",
          scenes: { battle: "assets/audio/bgm/battle.ogg" },
        },
        sfx: {},
      },
    });

    const index = buildPluginIndex(packageDir, manifest);
    expect(index.bgm.get("default")).toBe("assets/audio/bgm/intro.mp3");
    expect(index.bgm.get("battle")).toBe("assets/audio/bgm/battle.ogg");
  });

  it("indexes SFX files declared in manifest", () => {
    ensureDir(join(packageDir, "assets", "audio", "sfx"));
    writeFileSync(join(packageDir, "assets", "audio", "sfx", "sword.mp3"), "fake");

    const manifest = makeManifest({
      capabilities: { audio: true, customFonts: false, customCss: false, characterPortraits: false, backgroundImages: false, performances: false },
      audio: {
        bgm: { default: undefined, scenes: {} },
        sfx: { skill_use: "assets/audio/sfx/sword.mp3" },
      },
    });

    const index = buildPluginIndex(packageDir, manifest);
    expect(index.sfx.get("skill_use")).toBe("assets/audio/sfx/sword.mp3");
  });

  it("indexes portrait and background images", () => {
    ensureDir(join(packageDir, "assets", "images", "portraits"));
    ensureDir(join(packageDir, "assets", "images", "backgrounds"));
    writeFileSync(join(packageDir, "assets", "images", "portraits", "qiaofeng.png"), "fake");
    writeFileSync(join(packageDir, "assets", "images", "backgrounds", "mountain.jpg"), "fake");

    const manifest = makeManifest({
      capabilities: { audio: false, customFonts: false, customCss: false, characterPortraits: true, backgroundImages: true, performances: false },
      images: {
        portraits: { qiaofeng: "assets/images/portraits/qiaofeng.png" },
        backgrounds: { default: "assets/images/backgrounds/mountain.jpg" },
      },
    });

    const index = buildPluginIndex(packageDir, manifest);
    expect(index.portraits.get("qiaofeng")).toBe("assets/images/portraits/qiaofeng.png");
    expect(index.backgrounds.get("default")).toBe("assets/images/backgrounds/mountain.jpg");
  });

  it("indexes fonts", () => {
    ensureDir(join(packageDir, "assets", "fonts"));
    writeFileSync(join(packageDir, "assets", "fonts", "kungfu.woff2"), "fake");

    const manifest = makeManifest({
      capabilities: { audio: false, customFonts: true, customCss: false, characterPortraits: false, backgroundImages: false, performances: false },
      fonts: { heading: "assets/fonts/kungfu.woff2" },
    });

    const index = buildPluginIndex(packageDir, manifest);
    expect(index.fonts.heading).toBe("assets/fonts/kungfu.woff2");
  });

  it("detects custom.css when capability is enabled", () => {
    ensureDir(join(packageDir, "theme"));
    writeFileSync(join(packageDir, "theme", "custom.css"), "body { color: red; }");

    const manifest = makeManifest({
      capabilities: { audio: false, customFonts: false, customCss: true, characterPortraits: false, backgroundImages: false, performances: false },
    });

    const index = buildPluginIndex(packageDir, manifest);
    expect(index.customCssPath).toBe("theme/custom.css");
  });

  it("returns null customCssPath when file is missing", () => {
    const manifest = makeManifest({
      capabilities: { audio: false, customFonts: false, customCss: true, characterPortraits: false, backgroundImages: false, performances: false },
    });

    const index = buildPluginIndex(packageDir, manifest);
    expect(index.customCssPath).toBeNull();
  });

  it("throws when manifest references missing BGM file", () => {
    const manifest = makeManifest({
      capabilities: { audio: true, customFonts: false, customCss: false, characterPortraits: false, backgroundImages: false, performances: false },
      audio: {
        bgm: { default: "assets/audio/bgm/nonexistent.mp3", scenes: {} },
        sfx: {},
      },
    });

    expect(() => buildPluginIndex(packageDir, manifest)).toThrow(/BGM default/);
  });

  it("throws when manifest references missing portrait", () => {
    const manifest = makeManifest({
      capabilities: { audio: false, customFonts: false, customCss: false, characterPortraits: true, backgroundImages: false, performances: false },
      images: {
        portraits: { qiaofeng: "assets/images/portraits/missing.png" },
        backgrounds: {},
      },
    });

    expect(() => buildPluginIndex(packageDir, manifest)).toThrow(/portrait qiaofeng/);
  });

  it("throws when manifest references missing font", () => {
    const manifest = makeManifest({
      capabilities: { audio: false, customFonts: true, customCss: false, characterPortraits: false, backgroundImages: false, performances: false },
      fonts: { heading: "assets/fonts/missing.woff2" },
    });

    expect(() => buildPluginIndex(packageDir, manifest)).toThrow(/font heading/);
  });

  it("indexes performance assets declared in manifest", () => {
    ensureDir(join(packageDir, "assets", "performances", "qiaofeng", "video"));
    ensureDir(join(packageDir, "assets", "performances", "qiaofeng", "audio"));
    ensureDir(join(packageDir, "assets", "performances", "qiaofeng", "images"));
    writeFileSync(join(packageDir, "assets", "performances", "qiaofeng", "video", "entrance.webm"), "fake-video");
    writeFileSync(join(packageDir, "assets", "performances", "qiaofeng", "audio", "entrance.mp3"), "fake-audio");
    writeFileSync(join(packageDir, "assets", "performances", "qiaofeng", "images", "poster.jpg"), "fake-image");

    const manifest = makeManifest({
      capabilities: { audio: true, customFonts: false, customCss: false, characterPortraits: false, backgroundImages: false, performances: true },
      performances: {
        qiaofeng_entrance: {
          name: "乔峰登场",
          renderer: "video",
          durationMs: 4200,
          trigger: { type: "firstAppearance", characterId: "qiaofeng" },
          playOnce: "session",
          video: {
            webm: "assets/performances/qiaofeng/video/entrance.webm",
            poster: "assets/performances/qiaofeng/images/poster.jpg",
            containsAudio: true,
          },
          layers: {},
          audio: { fallback: "assets/performances/qiaofeng/audio/entrance.mp3" },
        },
      },
    });

    const index = buildPluginIndex(packageDir, manifest);
    expect(index.performances.get("qiaofeng_entrance")).toEqual([
      "assets/performances/qiaofeng/video/entrance.webm",
      "assets/performances/qiaofeng/images/poster.jpg",
      "assets/performances/qiaofeng/audio/entrance.mp3",
    ]);
  });
});
