import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { AuditLogPage } from "../AuditLogPage.js";

const mockEntries = [
  {
    id: "entry_1",
    timestamp: "2026-05-27T08:00:00Z",
    type: "llm_request",
    sessionId: "sess_001",
    speakerId: "qiaofeng",
    summary: "发送 LLM 请求",
  },
  {
    id: "entry_2",
    timestamp: "2026-05-27T08:00:05Z",
    type: "llm_response",
    sessionId: "sess_001",
    speakerId: "qiaofeng",
    summary: "收到 LLM 响应",
  },
  {
    id: "entry_3",
    timestamp: "2026-05-27T08:01:00Z",
    type: "validation_failed",
    sessionId: "sess_001",
    summary: "校验失败：输出格式不符合要求",
  },
  {
    id: "entry_4",
    timestamp: "2026-05-27T08:02:00Z",
    type: "state_change",
    sessionId: "sess_001",
    summary: "状态变更：乔峰 hp -10",
    details: { hp: -10 },
  },
  {
    id: "entry_5",
    timestamp: "2026-05-27T07:00:00Z",
    type: "session_created",
    summary: "创建会话",
  },
  {
    id: "entry_6",
    timestamp: "2026-05-27T09:00:00Z",
    type: "session_completed",
    sessionId: "sess_001",
    summary: "会话完成",
  },
];

describe("AuditLogPage", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("loads and displays audit entries", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entries: mockEntries }),
    } as Response);

    render(<AuditLogPage />);

    await waitFor(() => {
      expect(screen.getByText("发送 LLM 请求")).toBeTruthy();
      expect(screen.getByText("收到 LLM 响应")).toBeTruthy();
      expect(screen.getByText("校验失败：输出格式不符合要求")).toBeTruthy();
    });

    expect(screen.getByText("状态变更：乔峰 hp -10")).toBeTruthy();
    expect(screen.getByText("创建会话")).toBeTruthy();
    const completedBadges = screen.getAllByText("会话完成");
    expect(completedBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty state when there are no entries", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entries: [] }),
    } as Response);

    render(<AuditLogPage />);

    await waitFor(() => {
      expect(screen.getByText("暂无审计记录")).toBeTruthy();
    });
  });

  it("shows loading state initially", () => {
    vi.mocked(globalThis.fetch).mockReturnValue(new Promise(() => {}));

    render(<AuditLogPage />);

    expect(screen.getByText("加载中...")).toBeTruthy();
  });

  it("shows error banner on fetch failure", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      text: async () => "Internal server error",
    } as Response);

    render(<AuditLogPage />);

    await waitFor(() => {
      expect(screen.getByText("Internal server error")).toBeTruthy();
    });
  });

  it("shows error banner when fetch throws", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error("Network error"));

    render(<AuditLogPage />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeTruthy();
    });
  });

  it("refresh button reloads entries", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entries: mockEntries }),
    } as Response);

    render(<AuditLogPage />);

    await waitFor(() => {
      expect(screen.getByText("发送 LLM 请求")).toBeTruthy();
    });

    // Second fetch for refresh
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entries: [mockEntries[0]] }),
    } as Response);

    fireEvent.click(screen.getByText("刷新"));

    await waitFor(() => {
      expect(screen.getByText("发送 LLM 请求")).toBeTruthy();
    });

    // Should have been called twice (initial load + refresh)
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
  });

  it("truncates long session IDs in display", async () => {
    const longSessionEntry = {
      ...mockEntries[0],
      sessionId: "sess_very_long_session_id_123456",
    };
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entries: [longSessionEntry] }),
    } as Response);

    render(<AuditLogPage />);

    await waitFor(() => {
      expect(screen.getByText("发送 LLM 请求")).toBeTruthy();
    });
    // Session ID should be truncated with ...
    expect(screen.getByText(/sess_very/)).toBeTruthy();
  });

  it("handles entries without sessionId gracefully", async () => {
    const entryNoSession = {
      id: "entry_no_session",
      timestamp: "2026-05-27T08:00:00Z",
      type: "session_created",
      summary: "创建会话",
    };
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entries: [entryNoSession] }),
    } as Response);

    render(<AuditLogPage />);

    await waitFor(() => {
      expect(screen.getByText("创建会话")).toBeTruthy();
    });
    // Should show "-" for entries without sessionId
    expect(screen.getByText("-")).toBeTruthy();
  });
});
