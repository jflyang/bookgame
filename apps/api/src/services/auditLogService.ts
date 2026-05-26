import { nanoid } from "nanoid";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  type: "llm_request" | "llm_response" | "validation_failed" | "state_change" | "session_created" | "session_completed";
  sessionId?: string;
  speakerId?: string;
  summary: string;
  details?: Record<string, unknown>;
}

export class AuditLogService {
  private entries: AuditLogEntry[] = [];

  append(entry: Omit<AuditLogEntry, "id" | "timestamp">) {
    this.entries.push({
      ...entry,
      id: `audit_${nanoid(10)}`,
      timestamp: new Date().toISOString()
    });
  }

  list(filter?: { type?: AuditLogEntry["type"]; sessionId?: string; limit?: number }) {
    let result = [...this.entries];
    if (filter?.type) result = result.filter((e) => e.type === filter.type);
    if (filter?.sessionId) result = result.filter((e) => e.sessionId === filter.sessionId);
    result.reverse();
    if (filter?.limit) result = result.slice(0, filter.limit);
    return result;
  }

  findBySession(sessionId: string) {
    return this.entries.filter((e) => e.sessionId === sessionId).reverse();
  }
}
