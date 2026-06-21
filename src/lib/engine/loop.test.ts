import { describe, it, expect, vi } from "vitest";
import { runAction, interpolate } from "./actions";
import { Action, ExecutionStep } from "../flow-types";
import { runActionSequence } from "./index";
import { prisma } from "../db";

// Mock prisma for runAutomation/resume tests if needed,
// but here we focus on runActionSequence logic which is internal.
// We'll need to export runActionSequence or test it via a public entry point.
// Since it's internal, let's use a trick or export it for testing.

describe("Loop Action & Interpolation", () => {
  const mockCtx: any = {
    data: {
      items: ["a", "b", "c"],
      nested: { list: [{ id: 1, name: "item1" }, { id: 2, name: "item2" }] },
      user: { name: "John" }
    },
    userId: "u1",
    automationId: "a1",
    executionId: "e1",
    getIntegrations: async () => ({}),
  };

  it("should interpolate simple values", () => {
    const result = interpolate("Hello {user.name}", mockCtx);
    expect(result).toBe("Hello John");
  });

  it("should interpolate deep values", () => {
    const result = interpolate("ID: {nested.list.0.id}", mockCtx);
    expect(result).toBe("ID: 1");
  });

  it("should return original object when exactly matching a placeholder", () => {
    const result = interpolate("{nested.list}", mockCtx);
    expect(result).toEqual(mockCtx.data.nested.list);
    expect(Array.isArray(result)).toBe(true);
  });

  it("should validate items parameter in loop action", async () => {
    const action: Action = {
      type: "loop",
      params: { items: "{items}", actions: [] }
    };
    const step = await runAction(action, mockCtx);
    expect(step.status).toBe("success");
    expect(step.output).toMatchObject({ count: 3 });
    expect((step.output as any).items).toEqual(["a", "b", "c"]);
  });

  it("should fail if items is not a list", async () => {
    const action: Action = {
      type: "loop",
      params: { items: "{user.name}", actions: [] }
    };
    const step = await runAction(action, mockCtx);
    expect(step.status).toBe("error");
    expect(step.detail).toContain("deve ser uma lista");
  });

  it("should handle JSON string as items", async () => {
    const action: Action = {
      type: "loop",
      params: { items: "[1, 2, 3]", actions: [] }
    };
    const step = await runAction(action, mockCtx);
    expect(step.status).toBe("success");
    expect(step.output).toMatchObject({ count: 3, items: [1, 2, 3] });
  });

  it("should execute sub-actions in a loop", async () => {
    const steps: ExecutionStep[] = [];
    const action: Action = {
      type: "loop",
      params: {
        items: ["item1", "item2"],
        actions: [
          { type: "log", params: { message: "Iteration {loop_index}: {loop_item}" } }
        ]
      }
    };

    await runActionSequence([action], mockCtx, steps);

    expect(steps.length).toBe(3); // 1 loop start + 2 logs
    expect(steps[1].detail).toBe("Iteration 0: item1");
    expect(steps[2].detail).toBe("Iteration 1: item2");
  });

  it("should support nested loops with correct scoping", async () => {
    const steps: ExecutionStep[] = [];
    const action: Action = {
      type: "loop",
      params: {
        items: ["outer1"],
        actions: [
          {
            type: "loop",
            params: {
              items: ["inner1", "inner2"],
              actions: [
                { type: "log", params: { message: "{loop_item} of {loop_index}" } }
              ]
            }
          },
          { type: "log", params: { message: "Back to {loop_item}" } }
        ]
      }
    };

    await runActionSequence([action], mockCtx, steps);

    // Steps:
    // 0: Loop Outer start
    // 1: Loop Inner start
    // 2: Log "inner1 of 0"
    // 3: Log "inner2 of 1"
    // 4: Log "Back to outer1"
    expect(steps[2].detail).toBe("inner1 of 0");
    expect(steps[3].detail).toBe("inner2 of 1");
    expect(steps[4].detail).toBe("Back to outer1");
  });

  it("should support pausing and resuming from inside a loop", async () => {
    const steps: ExecutionStep[] = [];
    const action: Action = {
      type: "loop",
      params: {
        items: ["a", "b"],
        actions: [
          { type: "wait_for_approval", params: { to: "test@test.com" } },
          { type: "log", params: { message: "Done {loop_item}" } }
        ]
      }
    };

    // First run - should pause at iteration 0
    const result = await runActionSequence([action], mockCtx, steps);
    expect(result.paused).toBe(true);
    expect(result.pausedPath).toBe("0.0.0"); // Action 0, Iteration 0, Sub-action 0
    expect(steps.length).toBe(2); // Loop start + Approval
    expect(steps[1].status).toBe("paused");

    // Resume
    steps[1].status = "success"; // Simulate approval
    const resumeResult = await runActionSequence([action], mockCtx, steps, {
      resumePath: result.pausedPath
    });

    expect(resumeResult.paused).toBe(true);
    expect(resumeResult.pausedPath).toBe("0.1.0"); // Paused again at iteration 1

    expect(steps.length).toBe(4); // + Log "Done a" + Approval for "b"
    expect(steps[2].detail).toBe("Done a");
    expect(steps[3].status).toBe("paused");
  });
});
