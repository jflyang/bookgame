import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockSessions = [
  {
    id: "sess_active_001",
    storyPackageId: "xuzhu_vs_dingchunqiu",
    storyPackageTitle: "虚竹除害星宿老怪",
    round: 12,
    status: "active" as const,
    currentStage: "origin",
    characterStates: [
      { name: "乔峰", hp: 700, maxHp: 700, mp: 780, maxMp: 800 },
      { name: "虚竹", hp: 320, maxHp: 360, mp: 1800, maxMp: 2000 },
    ],
    messageCount: 35,
    createdAt: "2026-05-27T08:00:00Z",
    updatedAt: "2026-05-27T09:30:00Z",
  },
  {
    id: "sess_completed_002",
    storyPackageId: "xuzhu_vs_dingchunqiu",
    storyPackageTitle: "虚竹除害星宿老怪",
    round: 8,
    status: "completed" as const,
    currentStage: "resolution",
    characterStates: [
      { name: "乔峰", hp: 700, maxHp: 700, mp: 600, maxMp: 800 },
    ],
    messageCount: 24,
    createdAt: "2026-05-27T07:00:00Z",
    updatedAt: "2026-05-27T08:15:00Z",
  },
  {
    id: "sess_idle_003",
    storyPackageId: "new_story",
    storyPackageTitle: "新的故事",
    round: 0,
    status: "idle" as const,
    currentStage: "",
    characterStates: [],
    messageCount: 0,
    createdAt: "2026-05-27T09:45:00Z",
    updatedAt: "2026-05-27T09:45:00Z",
  },
];

const mockFetchSessions = vi.fn();
const mockFetchSessionDetail = vi.fn();
const mockClearSessions = vi.fn();

vi.mock("../../../../lib/sessionApi.js", () => ({
  fetchSessions: (...args: unknown[]) => mockFetchSessions(...args),
  fetchSessionDetail: (...args: unknown[]) => mockFetchSessionDetail(...args),
  clearSessions: (...args: unknown[]) => mockClearSessions(...args),
}));

vi.mock("../../../../store/gameStore.js", () => ({
  useGameStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      storyPackages: [
        { id: "xuzhu_vs_dingchunqiu", title: "虚竹除害星宿老怪" },
        { id: "new_story", title: "新的故事" },
      ],
    };
    return selector ? selector(state) : state;
  },
}));

import { SessionList } from "../SessionList.js";

describe("SessionList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchSessions.mockResolvedValue({ sessions: mockSessions });
    mockFetchSessionDetail.mockResolvedValue({
      session: mockSessions[0],
      gameState: null,
      messages: null,
    });
    mockClearSessions.mockResolvedValue({ ok: true });
    window.confirm = vi.fn(() => true);
  });

  it("renders summary cards with session counts", async () => {
    render(<SessionList />);
    await waitFor(() => {
      const cards = screen.getAllByText("总会话");
      expect(cards.length).toBeGreaterThan(0);
    });
    expect(screen.getByText("平均回合")).toBeTruthy();
    expect(screen.getByText("总消息")).toBeTruthy();
    // card values
    const cards = document.querySelectorAll(".runtime-card-value");
    expect(cards[0].textContent).toBe("3"); // total sessions
  });

  it("renders session rows as clickable buttons", async () => {
    render(<SessionList />);
    await waitFor(() => {
      const titles = document.querySelectorAll(".session-row-title");
      expect(titles.length).toBeGreaterThanOrEqual(2);
    });
    const statusBadges = document.querySelectorAll(".session-row-status");
    const statusTexts = Array.from(statusBadges).map(b => b.textContent);
    expect(statusTexts).toContain("进行中");
    expect(statusTexts).toContain("已结束");
    expect(statusTexts).toContain("空闲");
  });

  it("shows round and message counts per session", async () => {
    render(<SessionList />);
    await waitFor(() => {
      const metas = document.querySelectorAll(".session-row-meta");
      const metaTexts = Array.from(metas).map(m => m.textContent);
      expect(metaTexts.some(t => t?.includes("12 回合"))).toBe(true);
      expect(metaTexts.some(t => t?.includes("35 条消息"))).toBe(true);
    });
  });

  it("expands session row on click and shows detail tabs", async () => {
    render(<SessionList />);
    await waitFor(() => {
      const rows = document.querySelectorAll(".session-row-main");
      expect(rows.length).toBeGreaterThan(0);
    });

    const rows = document.querySelectorAll(".session-row-main");
    fireEvent.click(rows[0]);

    await waitFor(() => {
      expect(screen.getByText("基本信息")).toBeTruthy();
      expect(screen.getByText("消息历史")).toBeTruthy();
      expect(screen.getByText("LLM 调用记录")).toBeTruthy();
    });
  });

  it("collapses expanded row on second click", async () => {
    render(<SessionList />);
    await waitFor(() => {
      const rows = document.querySelectorAll(".session-row-main");
      expect(rows.length).toBeGreaterThan(0);
    });

    const rows = document.querySelectorAll(".session-row-main");
    fireEvent.click(rows[0]);
    await waitFor(() => {
      expect(screen.getByText("基本信息")).toBeTruthy();
    });

    fireEvent.click(rows[0]);
    await waitFor(() => {
      expect(screen.queryByText("基本信息")).toBeNull();
    });
  });

  it("shows empty state when no sessions", async () => {
    mockFetchSessions.mockResolvedValue({ sessions: [] });
    render(<SessionList />);
    await waitFor(() => {
      expect(screen.getByText("暂无会话记录")).toBeTruthy();
    });
  });

  it("shows error banner on fetch failure", async () => {
    mockFetchSessions.mockRejectedValue(new Error("Network error"));
    render(<SessionList />);
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeTruthy();
    });
  });

  it("calls clearSessions with confirm dialog", async () => {
    render(<SessionList />);
    await waitFor(() => {
      expect(screen.getByText("总会话")).toBeTruthy();
    });

    const clearBtn = screen.getByText("清空");
    fireEvent.click(clearBtn);
    expect(window.confirm).toHaveBeenCalled();
    expect(mockClearSessions).toHaveBeenCalled();
  });

  it("switches to messages tab in expanded panel", async () => {
    render(<SessionList />);
    await waitFor(() => {
      const rows = document.querySelectorAll(".session-row-main");
      expect(rows.length).toBeGreaterThan(0);
    });

    fireEvent.click(document.querySelectorAll(".session-row-main")[0]);

    await waitFor(() => {
      expect(screen.getByText("基本信息")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("消息历史"));
    await waitFor(() => {
      expect(screen.getByText("暂无消息（会话可能已过期或服务已重启）")).toBeTruthy();
    });
  });
});
