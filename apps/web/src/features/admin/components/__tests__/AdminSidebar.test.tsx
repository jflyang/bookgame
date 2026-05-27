import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockShowLibrary = vi.fn();
const mockShowSessions = vi.fn();
const mockShowRuntime = vi.fn();
const mockShowModelConfig = vi.fn();
const mockShowAuditLog = vi.fn();

// Track current pathname for active-state testing
let currentPathname = "/admin/story-packages";

Object.defineProperty(window, "location", {
  value: { pathname: currentPathname },
  writable: true,
});

vi.mock("../../../../store/gameStore.js", () => ({
  useGameStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      showLibrary: mockShowLibrary,
      showSessions: mockShowSessions,
      showRuntime: mockShowRuntime,
      showModelConfig: mockShowModelConfig,
      showAuditLog: mockShowAuditLog,
    };
    return selector ? selector(state) : state;
  },
}));

import { AdminSidebar } from "../AdminSidebar.js";

describe("AdminSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentPathname = "/admin/story-packages";
    window.location.pathname = currentPathname;
  });

  it("renders all nav buttons", () => {
    render(<AdminSidebar />);

    const buttons = screen.getAllByRole("button");
    // 5 nav buttons + 0 game-back button (it's an <a> not a button)
    expect(buttons.length).toBe(5);
  });

  it("renders a back-to-game link", () => {
    render(<AdminSidebar />);

    const backLink = screen.getByTitle("返回游戏");
    expect(backLink).toBeTruthy();
    expect(backLink.getAttribute("href")).toBe("/");
  });

  it("highlights active nav button based on current route — story-packages", () => {
    render(<AdminSidebar />);

    const buttons = screen.getAllByRole("button");
    const activeButtons = buttons.filter((b) => b.className.includes("active"));
    expect(activeButtons.length).toBe(1);
    expect(activeButtons[0].getAttribute("aria-label")).toBe("故事包");
  });

  it("highlights active nav button for sessions route", () => {
    window.location.pathname = "/admin/sessions";

    render(<AdminSidebar />);

    const buttons = screen.getAllByRole("button");
    const activeButtons = buttons.filter((b) => b.className.includes("active"));
    expect(activeButtons.length).toBe(1);
    expect(activeButtons[0].getAttribute("aria-label")).toBe("会话");
  });

  it("highlights active nav button for runtime route", () => {
    window.location.pathname = "/admin/runtime";

    render(<AdminSidebar />);

    const buttons = screen.getAllByRole("button");
    const activeButtons = buttons.filter((b) => b.className.includes("active"));
    expect(activeButtons.length).toBe(1);
    expect(activeButtons[0].getAttribute("aria-label")).toBe("运行时");
  });

  it("highlights active nav button for model-config route", () => {
    window.location.pathname = "/admin/model-config";

    render(<AdminSidebar />);

    const buttons = screen.getAllByRole("button");
    const activeButtons = buttons.filter((b) => b.className.includes("active"));
    expect(activeButtons.length).toBe(1);
    expect(activeButtons[0].getAttribute("aria-label")).toBe("模型配置");
  });

  it("highlights active nav button for audit-log route", () => {
    window.location.pathname = "/admin/audit-log";

    render(<AdminSidebar />);

    const buttons = screen.getAllByRole("button");
    const activeButtons = buttons.filter((b) => b.className.includes("active"));
    expect(activeButtons.length).toBe(1);
    expect(activeButtons[0].getAttribute("aria-label")).toBe("审计日志");
  });

  it("clicking story-packages button calls showLibrary", () => {
    render(<AdminSidebar />);

    const btn = screen.getByLabelText("故事包");
    fireEvent.click(btn);
    expect(mockShowLibrary).toHaveBeenCalledOnce();
  });

  it("clicking sessions button calls showSessions", () => {
    render(<AdminSidebar />);

    const btn = screen.getByLabelText("会话");
    fireEvent.click(btn);
    expect(mockShowSessions).toHaveBeenCalledOnce();
  });

  it("clicking runtime button calls showRuntime", () => {
    render(<AdminSidebar />);

    const btn = screen.getByLabelText("运行时");
    fireEvent.click(btn);
    expect(mockShowRuntime).toHaveBeenCalledOnce();
  });

  it("clicking model-config button calls showModelConfig", () => {
    render(<AdminSidebar />);

    const btn = screen.getByLabelText("模型配置");
    fireEvent.click(btn);
    expect(mockShowModelConfig).toHaveBeenCalledOnce();
  });

  it("clicking audit-log button calls showAuditLog", () => {
    render(<AdminSidebar />);

    const btn = screen.getByLabelText("审计日志");
    fireEvent.click(btn);
    expect(mockShowAuditLog).toHaveBeenCalledOnce();
  });
});
