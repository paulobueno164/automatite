import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAutomation, resumeAutomation } from "./index";
import { prisma } from "../db";
import * as actions from "./actions";

vi.mock("../db", () => ({
  prisma: {
    automation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    execution: {
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../integrations", () => ({
  loadUserIntegrations: vi.fn().mockResolvedValue({}),
}));

vi.mock("../capture-form-crm", () => ({
  captureFormToCrm: vi.fn().mockResolvedValue({}),
}));

// We want to test the real runAction for loop, but maybe mock others or just let it run
const originalRunAction = actions.runAction;
vi.spyOn(actions, "runAction").mockImplementation(async (action, ctx) => {
  if (action.type === "wait_for_approval") {
     return {
          action: "wait_for_approval",
          label: action.label || action.type,
          status: "paused",
          detail: "Aguardando",
          output: action.params,
        };
  }
  return originalRunAction(action, ctx);
});

describe("Loop Action Engine", () => {
  const mockUser = { id: "user-1", tier: "free", anthropicKey: null };
  const mockAutomation = {
    id: "auto-1",
    userId: "user-1",
    active: true,
    triggerJson: JSON.stringify({ type: "webhook" }),
    user: mockUser,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.automation.findUnique as any).mockResolvedValue(mockAutomation);
    (prisma.execution.create as any).mockResolvedValue({ id: "exec-1" });
  });

  it("should iterate over a list of items and execute sub-actions", async () => {
    const actionsJson = JSON.stringify([
      {
        type: "loop",
        params: {
          items: "a, b, c",
          actions: [
            { type: "log", params: { message: "Item: {loop_item} at {loop_index}" } }
          ]
        }
      }
    ]);
    (prisma.automation.findUnique as any).mockResolvedValue({ ...mockAutomation, actionsJson });

    const result = await runAutomation("auto-1", {});

    expect(result.status).toBe("success");
    // Steps: 1 (loop start) + 3 (log iterations) = 4
    expect(result.steps).toHaveLength(4);
    expect(result.steps[1].detail).toBe("Item: a at 0");
    expect(result.steps[2].detail).toBe("Item: b at 1");
    expect(result.steps[3].detail).toBe("Item: c at 2");
  });

  it("should support nested loops with context isolation", async () => {
    const actionsJson = JSON.stringify([
      {
        type: "loop",
        params: {
          items: ["outer1", "outer2"],
          actions: [
            {
              type: "loop",
              params: {
                items: "inner1, inner2",
                actions: [
                  { type: "log", params: { message: "{loop_item} of {outer_item}" } }
                ]
              }
            }
          ]
        }
      }
    ]);
    // Note: To make {outer_item} work, we need to set it in the outer loop
    const actionsJsonWithContext = JSON.stringify([
      {
        type: "loop",
        params: {
          items: ["outer1", "outer2"],
          actions: [
            { type: "transform", label: "Set Outer", params: { instruction: "just return {loop_item}" } }, // Mocked below
            {
              type: "loop",
              params: {
                items: ["inner1"],
                actions: [
                  { type: "log", params: { message: "{loop_item} of {transformed_output}" } }
                ]
              }
            }
          ]
        }
      }
    ]);

    // Mock transform to just set transformed_output in ctx.data
    vi.spyOn(actions, "runAction").mockImplementation(async (action, ctx) => {
      if (action.type === "transform") {
        const val = actions.interpolate("{loop_item}", ctx);
        ctx.data.transformed_output = val;
        return { action: "transform", status: "success", label: "Set Outer", detail: "ok" };
      }
      return originalRunAction(action, ctx);
    });

    (prisma.automation.findUnique as any).mockResolvedValue({ ...mockAutomation, actionsJson: actionsJsonWithContext });

    const result = await runAutomation("auto-1", {});
    expect(result.status).toBe("success");
    // Outer loop (1)
    //   Iteration 0: Set Outer (1), Inner Loop (1), Log (1) = 3
    //   Iteration 1: Set Outer (1), Inner Loop (1), Log (1) = 3
    // Total = 7
    expect(result.steps).toHaveLength(7);
    expect(result.steps[3].detail).toBe("inner1 of outer1");
    expect(result.steps[6].detail).toBe("inner1 of outer2");
  });

  it("should support pausing and resuming inside a loop", async () => {
     const actionsJson = JSON.stringify([
      {
        type: "loop",
        params: {
          items: ["item1", "item2"],
          actions: [
            { type: "log", params: { message: "Doing {loop_item}" } },
            { type: "wait_for_approval", params: { to: "boss@test.com" } },
            { type: "log", params: { message: "Done {loop_item}" } }
          ]
        }
      }
    ]);
    (prisma.automation.findUnique as any).mockResolvedValue({ ...mockAutomation, actionsJson });

    // 1. Initial Run
    const result1 = await runAutomation("auto-1", {});
    expect(result1.status).toBe("waiting");
    // Steps: 1 (loop start), 1 (log item1), 1 (paused wait_for_approval) = 3
    expect(result1.steps).toHaveLength(3);
    expect(result1.steps[1].detail).toBe("Doing item1");
    expect(result1.steps[2].status).toBe("paused");

    // Formato do pausedPath: "0.0.1" (action 0, iteration 0, sub-action 1)
    const pausedPath = "0.0.1";
    const resumeToken = "tok-123";

    (prisma.execution.findUnique as any).mockResolvedValue({
        id: "exec-1",
        status: "waiting",
        resumeToken,
        pausedPath,
        inputJson: "{}",
        logJson: JSON.stringify(result1.steps),
        automation: { ...mockAutomation, actionsJson }
    });

    // 2. Resume
    const result2 = await resumeAutomation("exec-1", resumeToken);
    expect(result2.status).toBe("waiting"); // Pauses again in the second iteration

    // Steps after first resume:
    // Original (3)
    // + Done item1 (1)
    // + Doing item2 (1)
    // + wait_for_approval item2 (1)
    // = 6
    expect(result2.steps).toHaveLength(6);
    expect(result2.steps[2].status).toBe("success"); // Approved
    expect(result2.steps[3].detail).toBe("Done item1");
    expect(result2.steps[4].detail).toBe("Doing item2");
    expect(result2.steps[5].status).toBe("paused");

    // Resume again
    (prisma.execution.findUnique as any).mockResolvedValue({
        id: "exec-1",
        status: "waiting",
        resumeToken: "tok-456",
        pausedPath: "0.1.1",
        inputJson: "{}",
        logJson: JSON.stringify(result2.steps),
        automation: { ...mockAutomation, actionsJson }
    });

    const result3 = await resumeAutomation("exec-1", "tok-456");
    expect(result3.status).toBe("success");
    expect(result3.steps).toHaveLength(7);
    expect(result3.steps[6].detail).toBe("Done item2");
  });

  it("should support nested dot-notation in interpolation", async () => {
     const actionsJson = JSON.stringify([
      { type: "log", params: { message: "City: {user.address.city}" } }
    ]);
    (prisma.automation.findUnique as any).mockResolvedValue({ ...mockAutomation, actionsJson });

    const payload = {
        user: {
            address: {
                city: "San Francisco"
            }
        }
    };

    const result = await runAutomation("auto-1", payload);
    expect(result.steps[0].detail).toBe("City: San Francisco");
  });

  it("should support dynamic items from previous step output", async () => {
    const actionsJson = JSON.stringify([
      { type: "transform", params: { instruction: "return list" } }, // Will set transformed_output
      {
        type: "loop",
        params: {
          items: "{transformed_output}",
          actions: [
            { type: "log", params: { message: "Value: {loop_item}" } }
          ]
        }
      }
    ]);

    vi.spyOn(actions, "runAction").mockImplementation(async (action, ctx) => {
      if (action.type === "transform") {
        ctx.data.transformed_output = ["val1", "val2"];
        return { action: "transform", status: "success", label: "Transform", detail: "ok" };
      }
      return originalRunAction(action, ctx);
    });

    (prisma.automation.findUnique as any).mockResolvedValue({ ...mockAutomation, actionsJson });

    const result = await runAutomation("auto-1", {});
    expect(result.status).toBe("success");
    // Steps: 1 (transform), 1 (loop start), 2 (log iterations) = 4
    expect(result.steps).toHaveLength(4);
    expect(result.steps[2].detail).toBe("Value: val1");
    expect(result.steps[3].detail).toBe("Value: val2");
  });
});
