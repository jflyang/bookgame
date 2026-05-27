import { describe, it, expect, beforeEach } from "vitest";
import { KnowledgeBaseService } from "../knowledgeBaseService.js";
import type { KnowledgeDocument } from "@story-game/shared";

const doc1: KnowledgeDocument = {
  id: "k1",
  title: "Qiao Feng's History",
  ownerId: "qiaofeng",
  content: "# Early Life\nQiao Feng was raised by farmers.\n# Battles\nHe fought many battles.",
  sourceType: "markdown",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const doc2: KnowledgeDocument = {
  id: "k2",
  title: "Xu Zhu's Background",
  ownerId: "xuzhu",
  content: "# Origin\nXu Zhu was a Shaolin monk.\n# Skills\nHe mastered the Tianshan Plum Blossom Hand.",
  sourceType: "markdown",
  createdAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const doc3: KnowledgeDocument = {
  id: "k3",
  title: "General Knowledge",
  ownerId: null,
  content: "# World\nThis is the world of martial arts.",
  sourceType: "markdown",
  createdAt: "2026-01-03T00:00:00.000Z",
  updatedAt: "2026-01-03T00:00:00.000Z",
};

describe("KnowledgeBaseService", () => {
  let svc: KnowledgeBaseService;

  beforeEach(() => {
    svc = new KnowledgeBaseService(structuredClone([doc1, doc2, doc3]));
  });

  it("list returns all documents", () => {
    expect(svc.list()).toHaveLength(3);
  });

  it("replaceAll replaces the documents array", () => {
    svc.replaceAll([structuredClone(doc1)]);
    expect(svc.list()).toHaveLength(1);
    expect(svc.list()[0].id).toBe("k1");
  });

  it("retrieve returns matching chunks sorted by score", () => {
    const hits = svc.retrieve("qiaofeng", ["k1", "k3"], "battles");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].score).toBeGreaterThanOrEqual(1);
    expect(hits.every((h) => ["k1", "k3"].includes(h.documentId))).toBe(true);
  });

  it("retrieve filters by ownerId (excludes other owners)", () => {
    const hits = svc.retrieve("qiaofeng", ["k1", "k2"], "monk");
    expect(hits.every((h) => h.documentId !== "k2")).toBe(true);
  });

  it("retrieve includes documents with null ownerId for any character", () => {
    const hits = svc.retrieve("qiaofeng", ["k3"], "world");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].documentId).toBe("k3");
  });

  it("retrieve limits results", () => {
    // Multiple chunks from doc1 should be returned, limit to 1
    const hits = svc.retrieve("qiaofeng", ["k1", "k3"], "", 1);
    expect(hits.length).toBeLessThanOrEqual(1);
  });

  it("retrieve with empty query returns all chunks with score 1", () => {
    const hits = svc.retrieve("qiaofeng", ["k1"], "");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.score === 1)).toBe(true);
  });

  it("retrieve returns empty array when no documents match the ids", () => {
    const hits = svc.retrieve("qiaofeng", ["nonexistent"], "anything");
    expect(hits).toEqual([]);
  });

  it("retrieve splits markdown content at heading boundaries", () => {
    const hits = svc.retrieve("qiaofeng", ["k1"], "");
    // doc1 has 2 headings, so we should get 2 chunks
    const k1Hits = hits.filter((h) => h.documentId === "k1");
    expect(k1Hits.length).toBe(2);
    expect(k1Hits[0].title).toBe("Qiao Feng's History");
    expect(k1Hits[1].title).toBe("Qiao Feng's History");
  });

  it("retrieve tokenizes query and scores accordingly", () => {
    const hits = svc.retrieve("qiaofeng", ["k1"], "farmers");
    // Chunks containing "farmers" should have score >= 1
    expect(hits.filter((h) => h.score >= 1).length).toBeGreaterThan(0);
    expect(hits.every((h) => h.score === 0 || h.score === 1)).toBe(true);
  });
});
