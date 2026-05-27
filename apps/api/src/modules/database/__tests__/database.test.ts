import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("better-sqlite3", () => {
  const mockDb = {
    pragma: vi.fn(),
    exec: vi.fn(),
    prepare: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue({ version: null }),
      run: vi.fn(),
      all: vi.fn().mockReturnValue([]),
    }),
    transaction: vi.fn((fn: () => void) => { fn(); return fn; }),
    close: vi.fn(),
  };
  return { default: function Database() { return mockDb; } };
});

vi.mock("node:fs", () => ({
  existsSync: vi.fn().mockReturnValue(false),
  mkdirSync: vi.fn(),
}));

vi.mock("../migrations.js", () => ({
  runMigrations: vi.fn(),
}));

import { getDatabase, closeDatabase } from "../database.js";

describe("database", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("getDatabase returns instance", () => {
    const db = getDatabase();
    expect(db).toBeDefined();
    expect(typeof db.pragma).toBe("function");
  });

  it("getDatabase is singleton", () => {
    expect(getDatabase()).toBe(getDatabase());
  });

  it("closeDatabase calls close", () => {
    const db = getDatabase();
    closeDatabase();
    expect(db.close).toHaveBeenCalled();
  });

  it("getDatabase works after closeDatabase", () => {
    getDatabase();
    closeDatabase();
    expect(getDatabase()).toBeDefined();
  });
});
