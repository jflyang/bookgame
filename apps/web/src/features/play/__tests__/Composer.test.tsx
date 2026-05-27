import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockSend = vi.fn();

vi.mock("../../../store/gameStore.js", () => ({
  useGameStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      send: mockSend,
      isSending: false,
      selectedCharacterId: null,
      characters: [
        { id: "qiaofeng", name: "乔峰", role: "主导者", avatar: "乔" },
        { id: "xuzhu", name: "虚竹", role: "主角", avatar: "虚" },
        { id: "duanyu", name: "段誉", role: "辅助", avatar: "段" },
        { id: "dingchunqiu", name: "丁春秋", role: "反派", avatar: "丁" },
      ],
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock("../UiConfigContext.js", () => ({
  useLabels: () => ({
    send: "发送",
    continue: "继续",
    autoPlay: "自动继续",
  }),
  useUiConfig: () => ({}),
}));

import { Composer } from "../components/Composer.js";

describe("Composer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue(undefined);
  });

  it("renders input and send button", () => {
    render(<Composer icon={<span data-testid="send-icon" />} />);
    expect(screen.getByRole("button", { name: /发送/ })).toBeTruthy();
    expect(screen.getByPlaceholderText(/输入/)).toBeTruthy();
  });

  it("disables send button when text is empty", () => {
    render(<Composer icon={<span />} />);
    const btn = screen.getByRole("button");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables send when text has content", () => {
    render(<Composer icon={<span />} />);
    const input = screen.getByPlaceholderText(/输入/);
    fireEvent.change(input, { target: { value: "继续前进" } });
    const btn = screen.getByRole("button");
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("calls send on form submit and clears input", async () => {
    render(<Composer icon={<span />} />);
    const input = screen.getByPlaceholderText(/输入/);
    fireEvent.change(input, { target: { value: "攻击丁春秋" } });
    const form = input.closest("form")!;
    fireEvent.submit(form);
    expect(mockSend).toHaveBeenCalledWith("攻击丁春秋");
  });

  it("shows mention dropdown when @ typed", async () => {
    render(<Composer icon={<span />} />);
    const input = screen.getByPlaceholderText(/输入/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "@" } });
    await waitFor(() => {
      expect(screen.getByText("乔峰")).toBeTruthy();
      expect(screen.getByText("虚竹")).toBeTruthy();
    });
  });

  it("filters mentions by search text", async () => {
    render(<Composer icon={<span />} />);
    const input = screen.getByPlaceholderText(/输入/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "@乔" } });
    await waitFor(() => {
      expect(screen.getByText("乔峰")).toBeTruthy();
      expect(screen.queryByText("虚竹")).toBeNull();
    });
  });
});
