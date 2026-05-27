import { describe, it, expect, vi } from "vitest";

vi.mock("better-sqlite3", () => {
  const mockDb = {
    pragma: vi.fn(), exec: vi.fn(),
    prepare: vi.fn().mockReturnValue({ get: vi.fn().mockReturnValue(undefined), run: vi.fn(), all: vi.fn().mockReturnValue([]) }),
    transaction: vi.fn((fn) => { fn(); return fn; }),
    close: vi.fn(),
  };
  return { default: function Database() { return mockDb; } };
});

vi.mock("node:fs", () => ({
  existsSync: vi.fn().mockReturnValue(false), mkdirSync: vi.fn(), readdirSync: vi.fn().mockReturnValue([]),
  writeFileSync: vi.fn(), copyFileSync: vi.fn(), unlinkSync: vi.fn(), rmSync: vi.fn(), statSync: vi.fn(), createReadStream: vi.fn(),
}));

vi.mock("nanoid", () => ({ nanoid: vi.fn().mockReturnValue("test_id") }));

import { dialogueEngine, adminApplicationService, gameApplicationService, storyPackageService, taskPackageRepository, sessionSaveService, mediaService, memoryService, gameStateService, llmConfigService, runtimeStatsCollector, sessionRepository, sessionCollector, auditLogService } from "../container.js";

describe("container", () => {
  it("exports core services", () => {
    expect(dialogueEngine).toBeDefined();
    expect(adminApplicationService).toBeDefined();
    expect(gameApplicationService).toBeDefined();
    expect(storyPackageService).toBeDefined();
    expect(taskPackageRepository).toBeDefined();
  });
  it("exports supporting services", () => {
    expect(sessionSaveService).toBeDefined();
    expect(mediaService).toBeDefined();
    expect(memoryService).toBeDefined();
    expect(gameStateService).toBeDefined();
    expect(llmConfigService).toBeDefined();
    expect(auditLogService).toBeDefined();
  });
  it("exports monitoring layer", () => {
    expect(runtimeStatsCollector).toBeDefined();
    expect(sessionRepository).toBeDefined();
    expect(sessionCollector).toBeDefined();
  });
});
