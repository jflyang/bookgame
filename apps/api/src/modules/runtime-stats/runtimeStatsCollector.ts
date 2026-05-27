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

  clear(): void {
    this.repo.deleteAll();
    this.records = [];
  }

  get count(): number {
    return this.repo.count();
  }
}
