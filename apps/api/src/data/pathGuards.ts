import { mkdirSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

export const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export function assertSafeId(value: string, label = "id") {
  if (!safeIdPattern.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return value;
}

export function resolveInside(root: string, ...segments: string[]) {
  const resolvedRoot = resolve(root);
  const resolvedPath = resolve(resolvedRoot, ...segments);
  const rel = relative(resolvedRoot, resolvedPath);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Path escapes data directory: ${segments.join("/")}`);
  }
  return resolvedPath;
}

export function ensureDir(path: string) {
  mkdirSync(path, { recursive: true });
  return path;
}
