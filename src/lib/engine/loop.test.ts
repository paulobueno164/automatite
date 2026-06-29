import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAutomation, resumeAutomation } from "./index";
import { prisma } from "../db";

vi.mock("../db", () => ({
  prisma: {
    automation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    execution: {
      count: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "exec-1" }),
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

vi.mock("../anthropic", () => ({
  resolveApiKey: vi.fn(),
}));

describe("Loop Action - runAutomation", () => {
  const mockAutomation = {
    id: "auto-1",
    userId: "user-1",
    active: true,
    triggerJson: JSON.stringify({ type: "webhook" }),
    user: {
      id: "user-1",
      tier: "pro",
      anthropicKey: null,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.automation.findUnique as any).mockResolvedValue(mockAutomation);
    (prisma.execution.count as any).mockResolvedValue(0);
  });

  it("should iterate over a list of items and execute sub-actions", async () => {
    const automationWithLoop = {
      ...mockAutomation,
      actionsJson: JSON.stringify([
        {
          type: "loop",
          params: {
            items: "A, B, C",
            actions: [
              { type: "log", params: { message: "Item: {loop_item} Index: {loop_index}" } }
            ]
          }
        }
      ]),
    };
    (prisma.automation.findUnique as any).mockResolvedValue(automationWithLoop);

    const result = await runAutomation("auto-1", {});

    expect(result.status).toBe("success");
    // 1 loop action + 3 log actions = 4 steps
    expect(result.steps).toHaveLength(4);
    expect(result.steps[1].detail).toBe("Item: A Index: 0");
    expect(result.steps[2].detail).toBe("Item: B Index: 1");
    expect(result.steps[3].detail).toBe("Item: C Index: 2");
  });

  it("should support JSON arrays for items", async () => {
    const automationWithLoop = {
      ...mockAutomation,
      actionsJson: JSON.stringify([
        {
          type: "loop",
          params: {
            items: "[{\"n\": 1}, {\"n\": 2}]",
            actions: [
              { type: "log", params: { message: "Value: {loop_item.n}" } }
            ]
          }
        }
      ]),
    };
    (prisma.automation.findUnique as any).mockResolvedValue(automationWithLoop);

    const result = await runAutomation("auto-1", {});

    expect(result.status).toBe("success");
    expect(result.steps).toHaveLength(3);
    expect(result.steps[1].detail).toBe("Value: 1");
    expect(result.steps[2].detail).toBe("Value: 2");
  });

  it("should handle pausing and resuming within a loop", async () => {
    const automationWithLoop = {
      ...mockAutomation,
      actionsJson: JSON.stringify([
        {
          type: "loop",
          params: {
            items: "1, 2",
            actions: [
              { type: "log", params: { message: "Step 1: {loop_item}" } },
              { type: "wait_for_approval", params: { to: "boss@corp.com" } },
              { type: "log", params: { message: "Step 2: {loop_item}" } }
            ]
          }
        }
      ]),
    };
    (prisma.automation.findUnique as any).mockResolvedValue(automationWithLoop);

    // 1. Initial run: should pause at index 0, step 1 (wait_for_approval)
    const result1 = await runAutomation("auto-1", {});
    expect(result1.status).toBe("waiting");
    // Steps: Loop, Log(1), Wait(paused)
    expect(result1.steps).toHaveLength(3);
    expect(result1.steps[2].status).toBe("paused");
    // Path: 0 (loop action) . 0 (first iteration) . 1 (wait_for_approval)
    expect((prisma.execution.update as any).mock.calls[0][0].data.pausedPath).toBe("0.0.1");

    const resumeToken = (prisma.execution.update as any).mock.calls[0][0].data.resumeToken;

    // 2. Resume
    (prisma.execution.findUnique as any).mockResolvedValue({
      id: "exec-1",
      status: "waiting",
      resumeToken,
      pausedPath: "0.0.1",
      inputJson: "{}",
      logJson: JSON.stringify(result1.steps),
      automation: automationWithLoop
    });

    const result2 = await resumeAutomation("exec-1", resumeToken);

    // Total steps expected:
    // Iteration 0:
    // [0] Loop
    // [1] Log "Step 1: 1"
    // [2] Wait (manual approval - marked as success by resumeAutomation)
    // [3] Log "Step 2: 1"
    // Iteration 1:
    // [4] Log "Step 1: 2"
    // [5] Wait (paused again!)

    expect(result2.status).toBe("waiting");
    expect(result2.steps).toHaveLength(6);
    expect(result2.steps[3].detail).toBe("Step 2: 1");
    expect(result2.steps[4].detail).toBe("Step 1: 2");
    expect(result2.steps[5].status).toBe("paused");
    expect((prisma.execution.update as any).mock.calls[1][0].data.pausedPath).toBe("0.1.1");
  });
});
