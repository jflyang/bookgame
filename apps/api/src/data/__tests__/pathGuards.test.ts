import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { assertSafeId, resolveInside } from "../pathGuards.js";

describe("pathGuards", () => {
  describe("assertSafeId", () => {
    it("rejects empty string", () => {
      expect(() => assertSafeId("")).toThrow("Invalid id");
    });

    it("rejects ../ path traversal", () => {
      expect(() => assertSafeId("../")).toThrow("Invalid id");
    });

    it("rejects ..\\ path traversal", () => {
      expect(() => assertSafeId("..\\")).toThrow("Invalid id");
    });

    it("rejects strings longer than 64 characters", () => {
      expect(() => assertSafeId("a".repeat(65))).toThrow("Invalid id");
    });

    it("rejects strings starting with special characters", () => {
      expect(() => assertSafeId("-abc")).toThrow("Invalid id");
    });

    it("accepts valid simple alphanumeric IDs", () => {
      expect(assertSafeId("abc123")).toBe("abc123");
    });

    it("accepts IDs with underscores and hyphens", () => {
      expect(assertSafeId("test_pkg_123")).toBe("test_pkg_123");
      expect(assertSafeId("my-package-v2")).toBe("my-package-v2");
    });

    it("accepts exactly 64 character ID", () => {
      const id = "a" + "b".repeat(63);
      expect(assertSafeId(id)).toBe(id);
    });
  });

  describe("resolveInside", () => {
    it("resolves valid nested paths", () => {
      const result = resolveInside("/root", "subdir", "file.txt");
      expect(result).toBe(resolve("/root", "subdir", "file.txt"));
    });

    it("rejects path traversal with ..", () => {
      expect(() => resolveInside("/root", "..", "secret.txt")).toThrow(
        "Path escapes data directory"
      );
    });
  });
});
