import { nanoid } from "nanoid";
import type { RuntimeTurnRecord, RuntimeStatsAggregate } from "@story-game/shared";
import { RuntimeStatsRepository } from "../database/runtimeStatsRepository.js";

export class RuntimeStatsCollector {
  private records: RuntimeTurnRecord[] = [];
  private readonly maxRecords = 1000;
  private readonly repo = new RuntimeStatsRepository();

  constructor() {
    this.records = this.repo.listRecent(this.maxRecords);
  }

  recordCompleteTurn(data: Omit<RuntimeTurnRecord, "id">): void {
    const record: RuntimeTurnRecord = {
      ...data,
      id: `rt_${nanoid(10)}`,
    };
    this.repo.insert(record);
    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }
  }

  listRecent(limit = 50, sessionId?: string): RuntimeTurnRecord[] {
    return this.repo.listRecent(limit, sessionId);
  }

  findBySession(sessionId: string): RuntimeTurnRecord[] {
    return this.repo.findBySession(sessionId);
  }

  getAggregates(sessionId?: string): RuntimeStatsAggregate {
    return this.repo.getAggregates(sessionId);
  }

  listSessionSummaries() {
    return this.repo.listSessionSummaries();
  }

  /** Get per-session token usage + budget status. */
  getSessionTokenUsage(sessionId: string) {
    const agg = this.repo.getAggregates(sessionId);
    const TOKEN_BUDGET_WARN = 150_000;
    return {
      sessionId,
      totalPromptTokens: agg.totalPromptTokens,
      totalCompletionTokens: agg.totalCompletionTokens,
      totalTokens: agg.totalPromptTokens + agg.totalCompletionTokens,
      turnCount: agg.totalTurns,
      avgPromptTokens: agg.avgPromptTokens,
      avgCompletionTokens: agg.avgCompletionTokens,
      budgetWarnThreshold: TOKEN_BUDGET_WARN,
      budgetExceeded: (agg.totalPromptTokens + agg.totalCompletionTokens) >= TOKEN_BUDGET_WARN,
    };
  }

  clear(): void {
    this.repo.deleteAll();
    this.records = [];
  }

  get count(): number {
    return this.repo.count();
  }
}
