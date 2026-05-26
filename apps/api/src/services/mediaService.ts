import { createReadStream, existsSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { extname } from "node:path";
import { createModuleLogger } from "../utils/logger.js";
import { assertSafeId, resolveInside } from "../data/pathGuards.js";
import { TaskPackageRepository } from "../data/taskPackageRepository.js";

const logger = createModuleLogger("media");

export class MediaService {
  private readonly repository: TaskPackageRepository;

  constructor(storage: string | TaskPackageRepository) {
    this.repository = typeof storage === "string" ? new TaskPackageRepository(storage) : storage;
  }

  /** Save an image and return the URL path to access it */
  saveImage(id: string, buffer: Buffer, originalName: string): string {
    const safeId = assertSafeId(id);
    const ext = normalizeImageExtension(originalName);
    const mediaDir = this.mediaDir(safeId);
    // remove any existing images with this id prefix
    const oldFiles = readdirSync(mediaDir).filter((f) => f.startsWith("thumbnail."));
    for (const old of oldFiles) unlinkSync(resolveInside(mediaDir, old));
    const filename = `thumbnail${ext}`;
    writeFileSync(resolveInside(mediaDir, filename), buffer);
    logger.info({ id: safeId, filename }, "image saved");
    return `/api/admin/media/${safeId}`;
  }

  /** Get a readable stream for an image, or null if not found */
  getImageStream(id: string) {
    const path = this.imagePath(id);
    if (!path) return null;
    return createReadStream(path);
  }

  /** Delete all images matching the given id prefix */
  removeImage(id: string) {
    const safeId = assertSafeId(id);
    const mediaDir = this.mediaDir(safeId);
    if (!existsSync(mediaDir)) return;
    const files = readdirSync(mediaDir).filter((f) => f.startsWith("thumbnail."));
    for (const file of files) unlinkSync(resolveInside(mediaDir, file));
    if (files.length > 0) logger.info({ id: safeId }, "image removed");
  }

  /** Find the file path for an image, or null if not found */
  imagePath(id: string): string | null {
    const safeId = assertSafeId(id);
    const mediaDir = this.mediaDir(safeId);
    if (!existsSync(mediaDir)) return null;
    const files = readdirSync(mediaDir).filter((f) => f.startsWith("thumbnail."));
    return files.length > 0 ? resolveInside(mediaDir, files[0]) : null;
  }

  private mediaDir(id: string) {
    return this.repository.mediaDir(id);
  }
}

function normalizeImageExtension(originalName: string) {
  const ext = extname(originalName).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) return ext;
  return ".png";
}
