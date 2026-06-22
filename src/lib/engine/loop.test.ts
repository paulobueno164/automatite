import { describe, it, expect, vi } from "vitest";
import { Action, ExecutionStep } from "../flow-types";
import { runAction, EngineContext, interpolate } from "./actions";

describe("Interpolation and Deep Access", () => {
  const ctx: EngineContext = {
    data: {
      user: { name: "Alice", age: 30 },
      items: ["a", "b", "c"],
      nested: { list: [1, 2, 3] }
    },
    userId: "u1",
    automationId: "a1",
    executionId: "e1",
    getIntegrations: async () => ({})
  };

  it("should interpolate simple values", () => {
    expect(interpolate("Hello {user.name}", ctx)).toBe("Hello Alice");
  });

  it("should preserve types for exact matches", () => {
    const result = interpolate("{items}", ctx);
    expect(result).toEqual(["a", "b", "c"]);
    expect(Array.isArray(result)).toBe(true);
  });

  it("should handle deep list access", () => {
    expect(interpolate("First: {nested.list.0}", ctx)).toBe("First: 1");
  });
});

// Since runActionSequence depends on Prisma and other complex setups,
// we will test the logic by mocking or focusing on the parts we can.
// For a full engine test, we would need a more involved setup.
