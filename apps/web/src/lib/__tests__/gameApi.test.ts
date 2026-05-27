import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { createSession, sendMessage, listSaves, saveSession, loadSession, loadSessionBySlot, deleteSave } from "../gameApi.js";

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
    it("fetches 3 save slots for a story package", async () => {
      mockFetch.mockResolvedValue(mockResponse({
        slots: [
          { slot: 1, save: { sessionId: "s1", label: "存档1", round: 5, status: "active", messageCount: 12, createdAt: "t", updatedAt: "t" } },
          { slot: 2, save: null },
          { slot: 3, save: null },
        ]
      }));
      const slots = await listSaves("pkg_1");
      expect(slots).toHaveLength(3);
      expect(slots[0].save?.label).toBe("存档1");
      expect(slots[1].save).toBeNull();
    });
  });

  describe("saveSession", () => {
    it("posts save data with slot", async () => {
      mockFetch.mockResolvedValue(mockResponse({ save: { sessionId: "s1", label: "Q" }, slot: 2 }));
      await saveSession("pkg_1", "sess_x", "快速存档", 2);
      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body).toEqual({ sessionId: "sess_x", label: "快速存档", slot: 2 });
    });
  });

  describe("loadSession", () => {
    it("restores session by saveId", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(mockSessionPayload));
      const result = await loadSession("pkg_1", "save_1");
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.sessionId).toBe("sess_001");
    });
  });

  describe("loadSessionBySlot", () => {
    it("restores session by slot number", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(mockSessionPayload));
      const result = await loadSessionBySlot("pkg_1", 2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body).toEqual({ storyPackageId: "pkg_1", slot: 2 });
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
