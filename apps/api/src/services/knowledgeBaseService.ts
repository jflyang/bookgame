import type { CharacterId, KnowledgeDocument } from "@story-game/shared";

export interface KnowledgeHit {
  documentId: string;
  title: string;
  content: string;
  score: number;
}

export class KnowledgeBaseService {
  constructor(private readonly documents: KnowledgeDocument[]) {}

  list() {
    return this.documents;
  }

  replaceAll(next: KnowledgeDocument[]) {
    this.documents.splice(0, this.documents.length, ...next);
  }

  retrieve(characterId: CharacterId, documentIds: string[], query: string, limit = 4): KnowledgeHit[] {
    const queryTokens = tokenize(query);
    return this.documents
      .filter((document) => documentIds.includes(document.id) && (!document.ownerId || document.ownerId === characterId))
      .flatMap((document) => splitMarkdown(document.content).map((chunk) => ({
        documentId: document.id,
        title: document.title,
        content: chunk,
        score: scoreChunk(chunk, queryTokens)
      })))
      .filter((hit) => hit.score > 0 || queryTokens.length === 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }
}

function splitMarkdown(content: string) {
  const chunks = content
    .split(/\n(?=#{1,3}\s+)/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  return chunks.length ? chunks : [content.trim()].filter(Boolean);
}

function tokenize(input: string) {
  return Array.from(new Set(input.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []));
}

function scoreChunk(chunk: string, tokens: string[]) {
  if (tokens.length === 0) return 1;
  const normalized = chunk.toLowerCase();
  return tokens.reduce((score, token) => score + (normalized.includes(token) ? 1 : 0), 0);
}
