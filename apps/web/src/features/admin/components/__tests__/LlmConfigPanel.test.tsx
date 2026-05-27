import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { LlmConfigView } from "@story-game/shared";

const mockLoadLlmConfig = vi.fn();
const mockSaveLlmConfig = vi.fn();
let mockLlmConfig: LlmConfigView | null = null;

vi.mock("../../../../store/gameStore.js", () => ({
  useGameStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      llmConfig: mockLlmConfig,
      loadLlmConfig: mockLoadLlmConfig,
      saveLlmConfig: (...args: unknown[]) => mockSaveLlmConfig(...args),
    };
    return selector ? selector(state) : state;
  },
}));

const mockTestLlmConnection = vi.fn();

vi.mock("../../../../lib/adminApi.js", () => ({
  testLlmConnection: (...args: unknown[]) => mockTestLlmConnection(...args),
}));

import { LlmConfigPanel } from "../LlmConfigPanel.js";

describe("LlmConfigPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLlmConfig = null;
    mockLoadLlmConfig.mockResolvedValue(undefined);
    mockSaveLlmConfig.mockResolvedValue(undefined);
    mockTestLlmConnection.mockResolvedValue({ ok: true, latency: 200 });
  });

  it("renders form fields", () => {
    mockLlmConfig = {
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      temperature: 0.8,
      maxTokens: 800,
      hasApiKey: true,
    };

    render(<LlmConfigPanel />);

    expect(screen.getByText("大模型配置")).toBeTruthy();
    expect(screen.getByText("Provider")).toBeTruthy();
    expect(screen.getByText("Base URL")).toBeTruthy();
    expect(screen.getByText("Model")).toBeTruthy();
    expect(screen.getByText("Temperature")).toBeTruthy();
    expect(screen.getByText("Max Tokens")).toBeTruthy();
    expect(screen.getByText("DeepSeek API Key")).toBeTruthy();
  });

  it("updates provider/model when llmConfig loads", async () => {
    mockLlmConfig = {
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      temperature: 0.8,
      maxTokens: 800,
      hasApiKey: true,
    };

    render(<LlmConfigPanel />);

    // After the useEffect fires, the draft state should match llmConfig
    await waitFor(() => {
      const modelInput = screen.getByDisplayValue("deepseek-v4-flash");
      expect(modelInput).toBeTruthy();
    });

    const selects = document.querySelectorAll("select");
    expect(selects[0]).toBeTruthy();
  });

  it('shows "已配置" for API key status when hasApiKey is true', async () => {
    mockLlmConfig = {
      provider: "mock",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      temperature: 0.8,
      maxTokens: 800,
      hasApiKey: true,
    };

    render(<LlmConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText(/已配置/)).toBeTruthy();
    });
  });

  it('shows "未配置" for API key status when hasApiKey is false', async () => {
    mockLlmConfig = {
      provider: "mock",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      temperature: 0.8,
      maxTokens: 800,
      hasApiKey: false,
    };

    render(<LlmConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText(/未配置/)).toBeTruthy();
    });
  });

  it("test button calls testLlmConnection and shows success result", async () => {
    mockLlmConfig = {
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      temperature: 0.8,
      maxTokens: 800,
      hasApiKey: true,
    };
    mockTestLlmConnection.mockResolvedValue({ ok: true, latency: 200 });

    render(<LlmConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText("测试连接")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("测试连接"));

    await waitFor(() => {
      expect(mockTestLlmConnection).toHaveBeenCalled();
      expect(screen.getByText(/连接成功/)).toBeTruthy();
    });
  });

  it("test button shows fail result on error", async () => {
    mockLlmConfig = {
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      temperature: 0.8,
      maxTokens: 800,
      hasApiKey: true,
    };
    mockTestLlmConnection.mockResolvedValue({ ok: false, error: "Connection refused" });

    render(<LlmConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText("测试连接")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("测试连接"));

    await waitFor(() => {
      expect(screen.getByText("Connection refused")).toBeTruthy();
    });
  });

  it("save button calls saveLlmConfig with the current config", async () => {
    mockLlmConfig = {
      provider: "mock",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      temperature: 0.8,
      maxTokens: 800,
      hasApiKey: false,
    };

    render(<LlmConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText("保存大模型配置")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("保存大模型配置"));

    await waitFor(() => {
      expect(mockSaveLlmConfig).toHaveBeenCalled();
    });
  });

  it("shows loading state on test button while testing", async () => {
    mockLlmConfig = {
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      temperature: 0.8,
      maxTokens: 800,
      hasApiKey: true,
    };
    // Keep pending
    mockTestLlmConnection.mockReturnValue(new Promise(() => {}));

    render(<LlmConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText("测试连接")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("测试连接"));

    await waitFor(() => {
      expect(screen.getByText("测试中...")).toBeTruthy();
    });
  });
});
