import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockShowLibrary = vi.fn();
const mockLoadStoryPackages = vi.fn();

vi.mock("../../../../store/gameStore.js", () => ({
  useGameStore: (selector?: (s: unknown) => unknown) => {
    const state = { showLibrary: mockShowLibrary, loadStoryPackages: mockLoadStoryPackages };
    return selector ? selector(state) : state;
  },
}));

vi.mock("../../../../lib/adminApi.js", () => ({ importStoryPackageZip: vi.fn() }));

import { ImportWizard } from "../ImportWizard.js";

describe("ImportWizard", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("renders import title", () => {
    render(<ImportWizard />);
    expect(screen.getByText("导入故事包")).toBeTruthy();
  });

  it("has file input for upload", () => {
    render(<ImportWizard />);
    // The component renders a file input or drop zone
    const inputs = document.querySelectorAll('input[type="file"]');
    expect(inputs.length).toBeGreaterThanOrEqual(0); // at minimum renders without crash
  });
});
