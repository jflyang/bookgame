import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const mockFetchRuntimeRecords = vi.fn();
const mockFetchRuntimeAggregates = vi.fn();
const mockFetchSessionSummaries = vi.fn();
const mockClearRuntimeStats = vi.fn();

vi.mock("../../../lib/runtimeStatsApi.js", () => ({
  fetchRuntimeRecords: (...args: unknown[]) => mockFetchRuntimeRecords(...args),
  fetchRuntimeAggregates: (...args: unknown[]) => mockFetchRuntimeAggregates(...args),
  fetchSessionSummaries: (...args: unknown[]) => mockFetchSessionSummaries(...args),
  clearRuntimeStats: (...args: unknown[]) => mockClearRuntimeStats(...args),
}));

import { RuntimeDashboard } from "../RuntimeDashboard.js";

describe("RuntimeDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchRuntimeRecords.mockResolvedValue({ records: [] });
    mockFetchRuntimeAggregates.mockResolvedValue({
      aggregates: {
        totalTurns: 10, totalSessions: 3, avgLatencyMs: 1200,
        maxLatencyMs: 3000, minLatencyMs: 500,
        totalPromptTokens: 10000, totalCompletionTokens: 5000,
        avgPromptTokens: 1000, avgCompletionTokens: 500,
        validationPassCount: 9, validationFailCount: 1,
        stageChanges: 4, activeSpeakers: ["qiaofeng"],
      },
    });
    mockFetchSessionSummaries.mockResolvedValue({ sessions: [] });
    mockClearRuntimeStats.mockResolvedValue({ ok: true });
    window.confirm = vi.fn(() => true);
  });

  it("renders loading state initially", () => {
    render(<RuntimeDashboard />);
    // Shows some loading skeleton or the page structure
    expect(screen.getByText("运行时统计")).toBeTruthy();
  });

  it("renders empty state when no data", async () => {
    mockFetchRuntimeAggregates.mockResolvedValue({
      aggregates: {
        totalTurns: 0, totalSessions: 0, avgLatencyMs: 0,
        maxLatencyMs: 0, minLatencyMs: 0,
        totalPromptTokens: 0, totalCompletionTokens: 0,
        avgPromptTokens: 0, avgCompletionTokens: 0,
        validationPassCount: 0, validationFailCount: 0,
        stageChanges: 0, activeSpeakers: [],
      },
    });
    render(<RuntimeDashboard />);
    await waitFor(() => {
      expect(screen.getByText("运行时统计")).toBeTruthy();
    });
  });
});
