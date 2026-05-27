import Database from "better-sqlite3";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync } from "node:fs";
import { runMigrations } from "./migrations.js";

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // Resolve to apps/api/ (API app root), not apps/ (monorepo root)
    const apiRoot = resolve(__dirname, "../../..");
    const dataDir = join(apiRoot, "data");
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    const dbPath = join(dataDir, "runtime-stats.db");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    runMigrations(db);
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
