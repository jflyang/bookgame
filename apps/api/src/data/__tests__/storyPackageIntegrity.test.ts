import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "../../../../data/task-packages");

/**
 * Integration test: validates all story packages on disk have valid JSON
 * and conform to expected schema structure.
 * Run after any data change to catch broken JSON early.
 */

function getPackageDirs(): string[] {
  if (!existsSync(dataDir)) return [];
  return readdirSync(dataDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => {
      // Only include directories that have an entry file
      const dir = join(dataDir, d.name);
      return existsSync(join(dir, "story.json")) || existsSync(join(dir, "task-package.json"));
    })
    .map((d) => d.name);
}

function tryParseJson(filePath: string): { ok: boolean; data?: unknown; error?: string } {
  if (!existsSync(filePath)) return { ok: true }; // file not existing is fine
  try {
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const packageDirs = getPackageDirs();

describe("Story Package Integrity", () => {
  if (packageDirs.length === 0) {
    it.skip("no packages found", () => {});
    return;
  }

  describe.each(packageDirs)("package: %s", (dirName) => {
    const pkgDir = join(dataDir, dirName);

    it("has a valid entry file (story.json or task-package.json)", () => {
      const storyPath = join(pkgDir, "story.json");
      const taskPath = join(pkgDir, "task-package.json");
      const hasEntry = existsSync(storyPath) || existsSync(taskPath);
      expect(hasEntry).toBe(true);

      const entryPath = existsSync(storyPath) ? storyPath : taskPath;
      const result = tryParseJson(entryPath);
      expect(result.ok, `${dirName}/entry: ${result.error}`).toBe(true);
    });

    it("scenario.json is valid JSON with required fields", () => {
      const filePath = join(pkgDir, "scenario.json");
      const result = tryParseJson(filePath);
      if (!existsSync(filePath)) return; // optional split file
      expect(result.ok, `${dirName}/scenario.json: ${result.error}`).toBe(true);

      const scenario = result.data as Record<string, unknown>;
      expect(scenario).toHaveProperty("id");
      expect(scenario).toHaveProperty("stages");
      expect(Array.isArray(scenario.stages)).toBe(true);
    });

    it("scenario.json stageDetails have valid directive fields (no unescaped quotes)", () => {
      const filePath = join(pkgDir, "scenario.json");
      if (!existsSync(filePath)) return;
      const result = tryParseJson(filePath);
      expect(result.ok, `${dirName}/scenario.json parse failed: ${result.error}`).toBe(true);

      const scenario = result.data as { stageDetails?: Array<{ id: string; directive?: string }> };
      if (!scenario.stageDetails) return;

      for (const stage of scenario.stageDetails) {
        if (stage.directive) {
          // If we got here, the JSON parsed fine — directive is a valid string
          expect(typeof stage.directive).toBe("string");
          expect(stage.directive.length).toBeGreaterThan(0);
        }
      }
    });

    it("characters.json is valid JSON array", () => {
      const filePath = join(pkgDir, "characters.json");
      if (!existsSync(filePath)) return;
      const result = tryParseJson(filePath);
      expect(result.ok, `${dirName}/characters.json: ${result.error}`).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("skills.json is valid JSON array", () => {
      const filePath = join(pkgDir, "skills.json");
      if (!existsSync(filePath)) return;
      const result = tryParseJson(filePath);
      expect(result.ok, `${dirName}/skills.json: ${result.error}`).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("manifest.json is valid JSON", () => {
      const filePath = join(pkgDir, "manifest.json");
      if (!existsSync(filePath)) return;
      const result = tryParseJson(filePath);
      expect(result.ok, `${dirName}/manifest.json: ${result.error}`).toBe(true);
    });

    it("knowledge/documents.json is valid JSON array", () => {
      const filePath = join(pkgDir, "knowledge", "documents.json");
      if (!existsSync(filePath)) return;
      const result = tryParseJson(filePath);
      expect(result.ok, `${dirName}/knowledge/documents.json: ${result.error}`).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("prompts/rules.json is valid JSON array", () => {
      const filePath = join(pkgDir, "prompts", "rules.json");
      if (!existsSync(filePath)) return;
      const result = tryParseJson(filePath);
      expect(result.ok, `${dirName}/prompts/rules.json: ${result.error}`).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("ui/config.json is valid JSON", () => {
      const filePath = join(pkgDir, "ui", "config.json");
      if (!existsSync(filePath)) return;
      const result = tryParseJson(filePath);
      expect(result.ok, `${dirName}/ui/config.json: ${result.error}`).toBe(true);
    });

    it("flow.json is valid JSON (if exists)", () => {
      const filePath = join(pkgDir, "flow.json");
      if (!existsSync(filePath)) return;
      const result = tryParseJson(filePath);
      expect(result.ok, `${dirName}/flow.json: ${result.error}`).toBe(true);
    });

    it("modules.json is valid JSON (if exists)", () => {
      const filePath = join(pkgDir, "modules.json");
      if (!existsSync(filePath)) return;
      const result = tryParseJson(filePath);
      expect(result.ok, `${dirName}/modules.json: ${result.error}`).toBe(true);
    });
  });
});
