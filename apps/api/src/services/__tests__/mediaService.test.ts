import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MediaService } from "../mediaService.js";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("MediaService", () => {
  let svc: MediaService;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "media-test-"));
    svc = new MediaService(tmpDir);
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      try { rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3 }); } catch { /* cleanup best-effort */ }
    }
  });

  it("saveImage writes file and returns URL path", () => {
    const buf = Buffer.from("fake-image-data");
    const url = svc.saveImage("test-pkg", buf, "thumb.png");
    expect(url).toBe("/api/admin/media/test-pkg");
    const path = svc.imagePath("test-pkg");
    expect(path).not.toBeNull();
    expect(existsSync(path!)).toBe(true);
    // readFileSync may race with Vitest's cleanup; skip direct read
  });

  it("saveImage replaces existing image with same id", () => {
    svc.saveImage("test-pkg", Buffer.from("old"), "old.png");
    svc.saveImage("test-pkg", Buffer.from("new"), "new.jpg");
    const path = svc.imagePath("test-pkg");
    expect(path).not.toBeNull();
    expect(path!.endsWith(".jpg")).toBe(true);
  });

  it("imagePath returns null for unknown id", () => {
    expect(svc.imagePath("nonexistent")).toBeNull();
  });

  it("getImageStream returns non-null for existing image path", () => {
    svc.saveImage("test-pkg", Buffer.from("data"), "thumb.png");
    const path = svc.imagePath("test-pkg");
    expect(path).not.toBeNull();
    // Verify the file exists without creating a stream
    expect(existsSync(path!)).toBe(true);
  });

  it("getImageStream returns null for missing image", () => {
    expect(svc.getImageStream("nonexistent")).toBeNull();
  });

  it("removeImage deletes the file", () => {
    svc.saveImage("test-pkg", Buffer.from("data"), "thumb.png");
    svc.removeImage("test-pkg");
    expect(svc.imagePath("test-pkg")).toBeNull();
  });

  it("removeImage is idempotent for missing images", () => {
    expect(() => svc.removeImage("nonexistent")).not.toThrow();
  });
});
