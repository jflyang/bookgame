import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { createSession, sendMessage, listSaves, saveSession, loadSession, deleteSave } from "../gameApi.js";

function mockResponse(data: unknown, ok = true) {
  return {
    ok,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    body: null,
  };
}

const mockSessionPayload = {
  sessionId: "sess_001",
  gameState: { sessionId: "sess_001", round: 0, status: "active" },
  characters: [{ id: "c1", name: "乔峰" }],
  skills: [],
  knowledgeDocuments: [],
  messages: [],
};

describe("gameApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createSession", () => {
    it("posts to /api/game/sessions", async () => {
      mockFetch.mockResolvedValue(mockResponse(mockSessionPayload));
      const result = await createSession("xuzhu_vs_dingchunqiu");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/game/sessions"),
        expect.objectContaining({ method: "POST" })
      );
      expect(result.sessionId).toBe("sess_001");
    });

    it("sends storyPackageId in body", async () => {
      mockFetch.mockResolvedValue(mockResponse(mockSessionPayload));
      await createSession("pkg_123");
      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.storyPackageId).toBe("pkg_123");
    });

    it("sends empty body when no storyPackageId", async () => {
      mockFetch.mockResolvedValue(mockResponse(mockSessionPayload));
      await createSession();
      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.storyPackageId).toBeUndefined();
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValue(mockResponse("Server error", false));
      await expect(createSession("pkg")).rejects.toThrow();
    });
  });

  describe("sendMessage", () => {
    it("posts to session messages endpoint", async () => {
      mockFetch.mockResolvedValue(mockResponse({ message: {}, gameState: {}, debug: {} }));
      await sendMessage("sess_1", { text: "hello", targetCharacterId: "c1" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/game/sessions/sess_1/messages"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("listSaves", () => {
    it("fetches saves for a story package", async () => {
      mockFetch.mockResolvedValue(mockResponse({ saves: [{ sessionId: "s1", label: "存档1", round: 5, status: "active", messageCount: 12, createdAt: "t", updatedAt: "t" }] }));
      const saves = await listSaves("pkg_1");
      expect(saves).toHaveLength(1);
      expect(saves[0].label).toBe("存档1");
    });
  });

  describe("saveSession", () => {
    it("posts save data", async () => {
      mockFetch.mockResolvedValue(mockResponse({ save: { sessionId: "s1", label: "Q" } }));
      await saveSession("pkg_1", "sess_x", "快速存档");
      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body).toEqual({ sessionId: "sess_x", label: "快速存档" });
    });
  });

  describe("loadSession", () => {
    it("fetches save then restores", async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse({ save: { sessionId: "s1", label: "Q" } }))
        .mockResolvedValueOnce(mockResponse(mockSessionPayload));
      const result = await loadSession("pkg_1", "save_1");
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.sessionId).toBe("sess_001");
    });
  });

  describe("deleteSave", () => {
    it("deletes a save", async () => {
      mockFetch.mockResolvedValue(mockResponse({ ok: true }));
      const result = await deleteSave("pkg_1", "save_1");
      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/saves/save_1"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });
});
