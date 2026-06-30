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
      create: vi.fn().mockResolvedValue({ id: "exec-1" }),
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

  it("should iterate over a list of items and execute sub-actions", async () => {
    const automationWithLoop = {
      ...mockAutomation,
      actionsJson: JSON.stringify([
        {
          type: "loop",
          params: {
            items: "A, B, C",
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
    // 1 loop action + 3 log actions (one for each item)
    expect(result.steps.length).toBe(4);
    expect(result.steps[1].detail).toBe("Item: A, Index: 0");
    expect(result.steps[2].detail).toBe("Item: B, Index: 1");
    expect(result.steps[3].detail).toBe("Item: C, Index: 2");
  });

  it("should handle JSON array in items", async () => {
    const automationWithLoop = {
      ...mockAutomation,
      actionsJson: JSON.stringify([
        {
          type: "loop",
          params: {
            items: JSON.stringify(["one", "two"]),
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
    expect(result.steps.length).toBe(3);
    expect(result.steps[1].detail).toBe("one");
    expect(result.steps[2].detail).toBe("two");
  });

  it("should support nested loops", async () => {
    const automationWithNestedLoop = {
      ...mockAutomation,
      actionsJson: JSON.stringify([
        {
          type: "loop",
          params: {
            items: "1, 2",
            actions: [
              {
                type: "loop",
                params: {
                  items: "A, B",
                  actions: [
                    { type: "log", params: { message: "{loop_item_outer}:{loop_item}" } }
                  ]
                }
              }
            ]
          }
        }
      ]),
    };
    // Wait, I need to be careful with variable names in nested loops.
    // Currently, both use loop_item. The inner one will overwrite the outer one.
    // My implementation saves and restores oldItem/oldIndex, so after inner loop,
    // outer loop_item is restored. But INSIDE the inner loop, outer is gone.

    // Actually, I can use a different name for the outer one by using a transform before?
    // Or maybe I should support custom variable names.
    // But for now, let's test isolation: inner loop should not permanently break outer loop.

    const automationWithNestedLoopFixed = {
        ...mockAutomation,
        actionsJson: JSON.stringify([
          {
            type: "loop",
            params: {
              items: "1, 2",
              actions: [
                { type: "log", params: { message: "Outer: {loop_item}" } },
                {
                  type: "loop",
                  params: {
                    items: "A",
                    actions: [
                      { type: "log", params: { message: "Inner: {loop_item}" } }
                    ]
                  }
                },
                { type: "log", params: { message: "Back: {loop_item}" } }
              ]
            }
          }
        ]),
      };

    (prisma.automation.findUnique as any).mockResolvedValue(automationWithNestedLoopFixed);

    const result = await runAutomation("auto-1", {});

    expect(result.status).toBe("success");
    // Loop1 (1)
    //   Log Outer: 1 (2)
    //   Loop2 (3)
    //     Log Inner: A (4)
    //   Log Back: 1 (5)
    // Loop1 (6)
    //   Log Outer: 2 (7)
    //   Loop2 (8)
    //     Log Inner: A (9)
    //   Log Back: 2 (10)
    // Total 10 steps (approx)

    // Let's check sequence for first iteration
    expect(result.steps[1].detail).toBe("Outer: 1");
    expect(result.steps[3].detail).toBe("Inner: A");
    expect(result.steps[4].detail).toBe("Back: 1");
    expect(result.steps[5].detail).toBe("Outer: 2");
    expect(result.steps[7].detail).toBe("Inner: A");
    expect(result.steps[8].detail).toBe("Back: 2");
  });

  it("should handle pause/resume within a loop", async () => {
    const automationWithPause = {
      ...mockAutomation,
      actionsJson: JSON.stringify([
        {
          type: "loop",
          params: {
            items: "1, 2",
            actions: [
              { type: "log", params: { message: "Pre-{loop_item}" } },
              { type: "wait_for_approval", params: { to: "test@test.com" } },
              { type: "log", params: { message: "Post-{loop_item}" } }
            ]
          }
        }
      ]),
    };
    (prisma.automation.findUnique as any).mockResolvedValue(automationWithPause);

    // 1. Start execution
    const result = await runAutomation("auto-1", {});

    expect(result.status).toBe("waiting");
    expect(result.steps.length).toBe(3); // Loop, Log(Pre-1), Wait
    expect(result.steps[1].detail).toBe("Pre-1");
    expect(result.steps[2].status).toBe("paused");

    // 2. Mock resume
    const executionId = result.executionId;
    const resumeToken = "token-123";
    (prisma.execution.findUnique as any).mockResolvedValue({
        id: executionId,
        status: "waiting",
        resumeToken,
        inputJson: "{}",
        logJson: JSON.stringify(result.steps),
        pausedPath: "0.0.1", // index 0 (loop), iteration 0, index 1 (wait)
        automation: {
            ...mockAutomation,
            actionsJson: automationWithPause.actionsJson,
        },
    });

    const resumeResult = await resumeAutomation(executionId, resumeToken);
    expect(resumeResult.status).toBe("waiting"); // Should pause again at iteration 1

    // Steps so far:
    // 0: Loop
    // 1: Log Pre-1
    // 2: Wait (now success)
    // 3: Log Post-1
    // 4: Log Pre-2
    // 5: Wait (paused)
    expect(resumeResult.steps.length).toBe(6);
    expect(resumeResult.steps[3].detail).toBe("Post-1");
    expect(resumeResult.steps[4].detail).toBe("Pre-2");
    expect(resumeResult.steps[5].status).toBe("paused");
  });
});
