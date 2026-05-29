import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { StoryPackage } from "@story-game/shared";
import { TaskPackageRepository } from "../taskPackageRepository.js";

const pkg: StoryPackage = {
  id: "task_test",
  title: "Task Test",
  description: "A self-contained task package",
  hidden: false,
  storySettingPrompt: "# Setting",
  scenario: { id: "scenario_test", title: "S", premise: "P", currentStage: "start", stages: ["start"], stageDetails: [], currentGoal: "G", rules: [], initialStates: [] },
  characters: [],
  skills: [],
  knowledgeDocuments: [],
  promptRules: [],
  debugConfig: { showPromptLayers: true, showRawOutput: false, showValidation: true },
  pluginManifest: {
    id: "task_test",
    type: "story-plugin",
    schemaVersion: "2",
    title: "Task Test",
    description: "Test",
    version: "1.0.0",
    capabilities: { audio: false, customFonts: false, customCss: false, characterPortraits: false, backgroundImages: false, performances: false },
    audio: { bgm: { scenes: {} }, sfx: {} },
    images: { portraits: {}, backgrounds: {} },
    fonts: {},
    performances: {},
    entry: "story.json",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as any,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

describe("TaskPackageRepository", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "task-repo-test-"));
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes manifest, aggregate, and split task files", () => {
    const repo = new TaskPackageRepository(tmpDir);
    repo.save(pkg);

    expect(existsSync(join(tmpDir, pkg.id, "manifest.json"))).toBe(true);
    expect(existsSync(join(tmpDir, pkg.id, "story.json"))).toBe(true);
    expect(existsSync(join(tmpDir, pkg.id, "scenario.json"))).toBe(true);
    expect(existsSync(join(tmpDir, pkg.id, "characters.json"))).toBe(true);
    expect(existsSync(join(tmpDir, pkg.id, "knowledge", "documents.json"))).toBe(true);
    expect(existsSync(join(tmpDir, pkg.id, "prompts", "story-setting.md"))).toBe(true);
    expect(existsSync(join(tmpDir, pkg.id, "ui", "config.json"))).toBe(true);
  });

  it("rejects unsafe package ids before resolving paths", () => {
    const repo = new TaskPackageRepository(tmpDir);
    expect(() => repo.taskFile("../outside")).toThrow();
    expect(() => repo.save({ ...pkg, id: "../outside" })).toThrow();
  });
});
