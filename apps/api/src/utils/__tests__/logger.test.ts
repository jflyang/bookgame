import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";

describe("logger logDir path", () => {
  it("resolves logDir relative to the source without double-drive-letter", () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    // simulate what logger.ts does
    const logDir = join(__dirname, "../../../logs");
    const resolved = resolve(logDir);

    // must not contain "C:\\C:" or any doubled drive pattern
    expect(resolved).not.toMatch(/[A-Z]:\\[A-Z]:/);
    // must end with "logs"
    expect(resolved.endsWith("logs")).toBe(true);
    // parent exists (the api dir)
    expect(existsSync(resolve(logDir, ".."))).toBe(true);
  });
});
