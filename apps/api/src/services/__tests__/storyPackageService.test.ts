import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { StoryPackageService } from "../storyPackageService.js";
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Character, Skill, Scenario } from "@story-game/shared";
import AdmZip from "adm-zip";

const mockChar: Character = {
  id: "qiaofeng", name: "乔峰", role: "主导者", avatar: "乔",
  personaPrompt: "You are QF", rules: [], skillIds: [], knowledgeBaseIds: []
};

const mockSkill: Skill = {
  id: "s1", name: "Punch", ownerId: "qiaofeng", cost: { mp: 10 },
  effect: "Hurts", description: "A punch"
};

const mockScenario: Scenario = {
  id: "sc1", title: "Test Story", premise: "A test",
  currentStage: "start", stages: ["start", "end"],
  stageDetails: [],
  currentGoal: "Win", rules: [], initialStates: []
};

describe("StoryPackageService", () => {
  let svc: StoryPackageService;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "story-pkg-test-"));
    svc = new StoryPackageService(tmpDir, {
      characters: [structuredClone(mockChar)],
      skills: [structuredClone(mockSkill)],
      scenarios: [structuredClone(mockScenario)],
      knowledgeDocuments: []
    });
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("initializes with one default package", () => {
    expect(svc.list()).toHaveLength(1);
  });

  it("gets package by id", () => {
    const pkg = svc.get(svc.list()[0].id);
    expect(pkg).toBeDefined();
  });

  it("creates new package from source", () => {
    const src = svc.list()[0];
    const pkg = svc.create("New Package", src.id);
    expect(pkg.title).toBe("New Package");
    expect(pkg.characters.length).toBe(src.characters.length);
    expect(svc.list()).toHaveLength(2);
  });

  it("delete removes package", () => {
    const pkg = svc.create("To Delete", svc.list()[0].id);
    svc.delete(pkg.id);
    expect(svc.list()).toHaveLength(1);
  });

  it("delete last package throws", () => {
    expect(() => svc.delete(svc.list()[0].id)).toThrow();
  });

  it("upsert updates existing", () => {
    const pkg = structuredClone(svc.list()[0]);
    pkg.title = "Updated";
    svc.upsert(pkg);
    expect(svc.get(pkg.id).title).toBe("Updated");
  });

  it("stores task packages as self-contained directories", () => {
    const pkg = svc.list()[0];
    expect(svc.getFilePath(pkg.id)).toBe(join(tmpDir, pkg.id, "task-package.json"));
    expect(existsSync(svc.getFilePath(pkg.id))).toBe(true);
    expect(existsSync(join(tmpDir, pkg.id, "manifest.json"))).toBe(true);
    expect(existsSync(join(tmpDir, pkg.id, "scenario.json"))).toBe(true);
    expect(existsSync(join(tmpDir, pkg.id, "characters.json"))).toBe(true);
    expect(existsSync(join(tmpDir, pkg.id, "prompts", "story-setting.md"))).toBe(true);
  });

  it("rejects unsafe package ids", () => {
    expect(() => svc.get("../outside")).toThrow();
    expect(() => svc.upsert({ ...structuredClone(svc.list()[0]), id: "../outside" })).toThrow();
  });

  it("migrates legacy flat packages into task package directories", () => {
    const legacyDir = mkdtempSync(join(tmpdir(), "legacy-story-pkg-"));
    const dataDir = mkdtempSync(join(tmpdir(), "task-pkg-data-"));
    try {
      const pkg = structuredClone(svc.list()[0]);
      mkdirSync(join(legacyDir, "media"), { recursive: true });
      writeFileSync(join(legacyDir, `${pkg.id}.story-package.json`), JSON.stringify(pkg), "utf-8");
      writeFileSync(join(legacyDir, "media", `${pkg.id}.jpg`), "image");

      const migrated = new StoryPackageService(dataDir, undefined, { legacyDir });
      expect(migrated.list()).toHaveLength(1);
      expect(existsSync(join(dataDir, pkg.id, "task-package.json"))).toBe(true);
      expect(existsSync(join(dataDir, pkg.id, "manifest.json"))).toBe(true);
      expect(existsSync(join(dataDir, pkg.id, "media", "thumbnail.jpg"))).toBe(true);
    } finally {
      rmSync(legacyDir, { recursive: true, force: true });
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("rejects zip entries outside the task package contract", () => {
    const pkg = structuredClone(svc.list()[0]);
    const zip = new AdmZip();
    zip.addFile("task-package.json", Buffer.from(JSON.stringify(pkg), "utf-8"));
    zip.addFile("scripts/run.js", Buffer.from("alert(1)", "utf-8"));

    expect(() => svc.importZip(zip.toBuffer())).toThrow(/不被允许/);
  });
});
