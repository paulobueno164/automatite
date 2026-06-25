import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAutomation, resumeAutomation } from "./index";
import { prisma } from "../db";
import { loadUserIntegrations } from "../integrations";

vi.mock("../db", () => ({
  prisma: {
    automation: {
      findUnique: vi.fn(),
    },
    execution: {
      count: vi.fn(),
      create: vi.fn().mockImplementation((args) => Promise.resolve({ id: "exec-1", ...args.data })),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../integrations", () => ({
  loadUserIntegrations: vi.fn(),
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
    (loadUserIntegrations as any).mockResolvedValue({});
  });

  it("should iterate over a JSON array and interpolate values", async () => {
    const automationWithLoop = {
      ...mockAutomation,
      actionsJson: JSON.stringify([
        {
          type: "loop",
          params: {
            items: ["A", "B"],
            actions: [
              { type: "log", params: { message: "Item: {loop_item}, Index: {loop_index}" } }
            ]
          }
        }
      ]),
    };
    (prisma.automation.findUnique as any).mockResolvedValue(automationWithLoop);

    const result = await runAutomation("auto-1", {});

    expect(result.status).toBe("success");
    // Steps: 1 (loop start) + 2 (log A) + 2 (log B) = 3 steps?
    // Actually: loop action itself is one step, and then sub-actions are added to the steps array.
    // So: Step 0: loop start, Step 1: log A, Step 2: log B.
    expect(result.steps).toHaveLength(3);
    expect(result.steps[1].detail).toBe("Item: A, Index: 0");
    expect(result.steps[2].detail).toBe("Item: B, Index: 1");
  });

  it("should iterate over a comma-separated string", async () => {
    const automationWithLoop = {
      ...mockAutomation,
      actionsJson: JSON.stringify([
        {
          type: "loop",
          params: {
            items: "X, Y, Z",
            actions: [
              { type: "log", params: { message: "{loop_item}" } }
            ]
          }
        }
      ]),
    };
    (prisma.automation.findUnique as any).mockResolvedValue(automationWithLoop);

    const result = await runAutomation("auto-1", {});

    expect(result.status).toBe("success");
    expect(result.steps).toHaveLength(4); // loop + 3 logs
    expect(result.steps[1].detail).toBe("X");
    expect(result.steps[2].detail).toBe("Y");
    expect(result.steps[3].detail).toBe("Z");
  });

  it("should handle nested loops", async () => {
    const automationWithLoop = {
      ...mockAutomation,
      actionsJson: JSON.stringify([
        {
          type: "loop",
          params: {
            items: ["1", "2"],
            actions: [
              {
                type: "loop",
                params: {
                  items: ["a", "b"],
                  actions: [
                    { type: "log", params: { message: "{loop_index}:{loop_item}" } }
                  ]
                }
              }
            ]
          }
        }
      ]),
    };
    (prisma.automation.findUnique as any).mockResolvedValue(automationWithLoop);

    const result = await runAutomation("auto-1", {});

    expect(result.status).toBe("success");
    // Loop1
    //   Iteration 0:
    //     Loop2
    //       Iteration 0: Log 0:a
    //       Iteration 1: Log 1:b
    //   Iteration 1:
    //     Loop2
    //       Iteration 0: Log 0:a
    //       Iteration 1: Log 1:b
    // Steps: Loop1, Loop2, Log, Log, Loop2, Log, Log = 7 steps
    expect(result.steps).toHaveLength(7);
    expect(result.steps[2].detail).toBe("0:a");
    expect(result.steps[3].detail).toBe("1:b");
    expect(result.steps[5].detail).toBe("0:a");
    expect(result.steps[6].detail).toBe("1:b");
  });

  it("should pause and resume a loop", async () => {
    const automationWithPause = {
      ...mockAutomation,
      actionsJson: JSON.stringify([
        {
          type: "loop",
          params: {
            items: ["A", "B"],
            actions: [
              { type: "wait_for_approval", params: { to: "admin@test.com" } },
              { type: "log", params: { message: "Processed {loop_item}" } }
            ]
          }
        }
      ]),
    };
    (prisma.automation.findUnique as any).mockResolvedValue(automationWithPause);

    // 1. Initial run
    const result1 = await runAutomation("auto-1", {});
    expect(result1.status).toBe("waiting");
    expect(result1.steps).toHaveLength(2); // loop start, wait_for_approval
    expect(result1.steps[1].status).toBe("paused");

    const executionData = (prisma.execution.update as any).mock.calls[0][0].data;
    expect(executionData.status).toBe("waiting");
    expect(executionData.pausedPath).toBe("0.0.0"); // Action 0, Iteration 0, Sub-action 0

    // 2. Resume
    const mockExecution = {
      id: "exec-1",
      automationId: "auto-1",
      status: "waiting",
      inputJson: JSON.stringify({}),
      logJson: JSON.stringify(result1.steps),
      pausedPath: "0.0.0",
      resumeToken: "token-123",
      automation: automationWithPause,
    };
    (prisma.execution.findUnique as any).mockResolvedValue(mockExecution);

    const result2 = await resumeAutomation("exec-1", "token-123");

    expect(result2.status).toBe("waiting"); // Should pause again at the next iteration
    // Previous steps: Loop Start, Approval (now success), Log A
    // New steps: Approval (iteration 1)
    expect(result2.steps).toHaveLength(4);
    expect(result2.steps[1].status).toBe("success");
    expect(result2.steps[2].detail).toBe("Processed A");
    expect(result2.steps[3].status).toBe("paused");

    const executionData2 = (prisma.execution.update as any).mock.calls[1][0].data;
    expect(executionData2.pausedPath).toBe("0.1.0"); // Action 0, Iteration 1, Sub-action 0

    // 3. Resume again
    const mockExecution2 = {
      ...mockExecution,
      logJson: JSON.stringify(result2.steps),
      pausedPath: "0.1.0",
      resumeToken: "token-456",
    };
    (prisma.execution.findUnique as any).mockResolvedValue(mockExecution2);

    const result3 = await resumeAutomation("exec-1", "token-456");
    expect(result3.status).toBe("success");
    expect(result3.steps).toHaveLength(5);
    expect(result3.steps[4].detail).toBe("Processed B");
  });
});
