/** Unique ID generation for stages and modules. */

const ID_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Generate a globally unique stage ID: stage_ + 10 random chars. */
export function generateStageId(): string {
  let id = "stage_";
  for (let i = 0; i < 10; i++) id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return id;
}

/** Generate a globally unique module ID: mod_ + 10 random chars. */
export function generateModuleId(): string {
  let id = "mod_";
  for (let i = 0; i < 10; i++) id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return id;
}

/** Throw if a stage ID already exists. */
export function assertUniqueStageId(newId: string, existingIds: Set<string>): void {
  if (existingIds.has(newId)) {
    throw new Error(`Stage ID conflict: "${newId}" already exists.`);
  }
}

/** Throw if a module ID already exists. */
export function assertUniqueModuleId(newId: string, existingIds: Set<string>): void {
  if (existingIds.has(newId)) {
    throw new Error(`Module ID conflict: "${newId}" already exists.`);
  }
}
