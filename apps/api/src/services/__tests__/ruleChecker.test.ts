import { describe, it, expect } from "vitest";
import { RuleChecker } from "../ruleChecker.js";

const valid = {
  speakerId: "qiaofeng" as const,
  narration: "He strikes",
  dialogue: "Take this!",
  action: { type: "skill" as const, skillId: "some_skill", targetIds: ["dingchunqiu" as const] }
};

describe("RuleChecker", () => {
  const checker = new RuleChecker();

  it("accepts valid output", () => {
    expect(() => checker.validateOutput("qiaofeng", valid)).not.toThrow();
  });

  it("throws on speaker mismatch", () => {
    expect(() => checker.validateOutput("xuzhu", valid)).toThrow(/speaker mismatch/i);
  });

  it("throws on missing narration", () => {
    const v = { ...valid };
    delete (v as any).narration;
    expect(() => checker.validateOutput("qiaofeng", v)).toThrow();
  });

  it("throws on empty dialogue", () => {
    expect(() => checker.validateOutput("qiaofeng", { ...valid, dialogue: "" })).toThrow();
  });

  it("returns parsed output", () => {
    const result = checker.validateOutput("qiaofeng", valid);
    expect(result.speakerId).toBe("qiaofeng");
  });

  it("accepts observe action without skillId", () => {
    const v = { ...valid, action: { type: "observe" as const, targetIds: [] } };
    const result = checker.validateOutput("qiaofeng", v);
    expect(result.action.type).toBe("observe");
  });

  it("accepts command action with null skillId", () => {
    const v = { ...valid, action: { type: "command" as const, skillId: null, targetIds: ["xuzhu"] } };
    const result = checker.validateOutput("qiaofeng", v);
    expect(result.action.skillId).toBeNull();
  });

  it("accepts escape action without skillId", () => {
    const v = { ...valid, action: { type: "escape" as const, targetIds: [] } };
    const result = checker.validateOutput("qiaofeng", v);
    expect(result.action.type).toBe("escape");
  });
});
