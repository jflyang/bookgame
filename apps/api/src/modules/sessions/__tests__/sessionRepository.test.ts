import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../../database/migrations.js";
import { SessionRepository, type SessionUpsertInput } from "../sessionRepository.js";

function makeInput(overrides: Partial<SessionUpsertInput> = {}): SessionUpsertInput {
  return {
    id: "sess_test_001",
    storyPackageId: "xuzhu_vs_dingchunqiu",
    storyPackageTitle: "虚竹除害星宿老怪",
    round: 5,
    status: "active",
    currentStage: "origin",
    characterStates: [
      { name: "乔峰", hp: 700, maxHp: 700, mp: 780, maxMp: 800 },
      { name: "虚竹", hp: 320, maxHp: 360, mp: 1800, maxMp: 2000 },
    ],
    messageCount: 12,
    ...overrides,
  };
}

vi.mock("../../database/database.js", () => {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return { getDatabase: () => db, closeDatabase: () => db.close() };
});

describe("SessionRepository", () => {
  let repo: SessionRepository;

  beforeEach(() => {
    repo = new SessionRepository();
    repo.deleteAll();
  });

  it("upsert inserts a new session", () => {
    repo.upsert(makeInput());
    const all = repo.listAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("sess_test_001");
    expect(all[0].storyPackageTitle).toBe("虚竹除害星宿老怪");
    expect(all[0].status).toBe("active");
    expect(all[0].round).toBe(5);
    expect(all[0].messageCount).toBe(12);
  });

  it("upsert updates an existing session", () => {
    repo.upsert(makeInput());
    repo.upsert(makeInput({ round: 8, status: "completed", messageCount: 20 }));
    const all = repo.listAll();
    expect(all).toHaveLength(1);
    expect(all[0].round).toBe(8);
    expect(all[0].status).toBe("completed");
    expect(all[0].messageCount).toBe(20);
  });

  it("preserves characterStates as JSON round-trip", () => {
    repo.upsert(makeInput());
    const all = repo.listAll();
    expect(all[0].characterStates).toHaveLength(2);
    expect(all[0].characterStates[0].name).toBe("乔峰");
    expect(all[0].characterStates[0].hp).toBe(700);
    expect(all[0].characterStates[0].maxHp).toBe(700);
  });

  it("listAll returns both sessions", () => {
    repo.upsert(makeInput({ id: "sess_a" }));
    repo.upsert(makeInput({ id: "sess_b" }));
    const all = repo.listAll();
    expect(all).toHaveLength(2);
    expect(all.map(s => s.id).sort()).toEqual(["sess_a", "sess_b"]);
  });

  it("findByPackage filters by story package", () => {
    repo.upsert(makeInput({ id: "sess_1", storyPackageId: "pkg_a", storyPackageTitle: "A" }));
    repo.upsert(makeInput({ id: "sess_2", storyPackageId: "pkg_b", storyPackageTitle: "B" }));
    const filtered = repo.findByPackage("pkg_a");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("sess_1");
  });

  it("findByStatus filters by status", () => {
    repo.upsert(makeInput({ id: "sess_1", status: "active" }));
    repo.upsert(makeInput({ id: "sess_2", status: "completed" }));
    repo.upsert(makeInput({ id: "sess_3", status: "idle" }));
    expect(repo.findByStatus("active")).toHaveLength(1);
    expect(repo.findByStatus("completed")).toHaveLength(1);
    expect(repo.findByStatus("idle")).toHaveLength(1);
  });

  it("getById returns the session or null", () => {
    repo.upsert(makeInput({ id: "sess_x" }));
    expect(repo.getById("sess_x")?.round).toBe(5);
    expect(repo.getById("nonexistent")).toBeNull();
  });

  it("deleteById removes a single session", () => {
    repo.upsert(makeInput({ id: "sess_1" }));
    repo.upsert(makeInput({ id: "sess_2" }));
    repo.deleteById("sess_1");
    expect(repo.listAll()).toHaveLength(1);
    expect(repo.listAll()[0].id).toBe("sess_2");
  });

  it("deleteAll clears the table", () => {
    repo.upsert(makeInput({ id: "sess_1" }));
    repo.upsert(makeInput({ id: "sess_2" }));
    repo.deleteAll();
    expect(repo.listAll()).toHaveLength(0);
  });

  it("count returns correct number", () => {
    expect(repo.count()).toBe(0);
    repo.upsert(makeInput());
    expect(repo.count()).toBe(1);
    repo.upsert(makeInput({ id: "sess_2" }));
    expect(repo.count()).toBe(2);
  });

  it("handles idle session with zero round", () => {
    repo.upsert(makeInput({ id: "sess_idle", round: 0, status: "idle", messageCount: 0, characterStates: [] }));
    const s = repo.getById("sess_idle");
    expect(s).not.toBeNull();
    expect(s!.round).toBe(0);
    expect(s!.status).toBe("idle");
    expect(s!.characterStates).toHaveLength(0);
  });
});
