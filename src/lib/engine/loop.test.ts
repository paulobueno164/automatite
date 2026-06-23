import { describe, it, expect, beforeEach, vi } from "vitest";
import { runAutomation, resumeAutomation } from "./index";
import { prisma } from "../db";
import { Action, Trigger } from "../flow-types";

vi.mock("../db", () => ({
  prisma: {
    automation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    execution: {
      create: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../anthropic", () => ({
  resolveApiKey: vi.fn(() => "test-key"),
}));

vi.mock("../integrations", () => ({
  loadUserIntegrations: vi.fn(async () => ({})),
}));

vi.mock("../capture-form-crm", () => ({
  captureFormToCrm: vi.fn(),
}));

describe("Loop Engine", () => {
  const userId = "user-1";
  const automationId = "auto-1";
  const mockUser = { id: userId, tier: "pro", anthropicKey: null };

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.execution.count as any).mockResolvedValue(0);
  });

  it("should iterate over a list of items", async () => {
    const trigger: Trigger = { type: "webhook", config: {} };
    const actions: Action[] = [
      {
        type: "loop",
        params: {
          items: "item1, item2, item3",
          actions: [
            { type: "log", params: { message: "Processing {loop_item} at index {loop_index}" } }
          ],
        },
      },
    ];

    (prisma.automation.findUnique as any).mockResolvedValue({
      id: automationId,
      userId,
      active: true,
      triggerJson: JSON.stringify(trigger),
      actionsJson: JSON.stringify(actions),
      user: mockUser,
    });

    (prisma.execution.create as any).mockResolvedValue({ id: "exec-1" });

    const result = await runAutomation(automationId, {});

    expect(result.status).toBe("success");
    // Steps: 1 (loop start) + 3 (log iterations) = 4 steps
    // Wait, the loop action itself adds a step, and each sub-action iteration adds steps.
    // Loop action step + (Iteration 0: Log) + (Iteration 1: Log) + (Iteration 2: Log)
    expect(result.steps).toHaveLength(4);
    expect(result.steps[1].detail).toContain("Processing item1 at index 0");
    expect(result.steps[2].detail).toContain("Processing item2 at index 1");
    expect(result.steps[3].detail).toContain("Processing item3 at index 2");
  });

  it("should support nested loops and context isolation", async () => {
    const trigger: Trigger = { type: "webhook", config: {} };
    const actions: Action[] = [
      {
        type: "loop",
        label: "Outer",
        params: {
          items: "A, B",
          actions: [
            {
              type: "loop",
              label: "Inner",
              params: {
                items: "1, 2",
                actions: [
                  { type: "log", params: { message: "{loop_item_outer}:{loop_item}" } }
                ]
              }
            }
          ]
        }
      }
    ];

    // Note: We need a way to reference the outer loop_item.
    // Currently we only have loop_item and loop_index.
    // If we nest them, loop_item is overwritten.
    // Let's improve the engine to allow custom variable names or use dot notation if we implement it.
    // Wait, my implementation of runActionSequence saves prevItem/prevIndex.
    // So in the inner loop, loop_item is the inner item.
    // After inner loop finishes, loop_item of outer is restored.
    // But how to access outer item from INSIDE inner loop?
    // We could support {parent.loop_item} or similar, but for now let's just test isolation.

    const actionsWithManualVar: Action[] = [
        {
          type: "loop",
          params: {
            items: "A, B",
            actions: [
              { type: "transform", params: { instruction: "save {loop_item} to outer_val" } }, // Mock transform doesn't actually save to context unless we use AI.
              // Actually, runAction for log just interpolates.
              {
                type: "loop",
                params: {
                  items: "1",
                  actions: [
                    { type: "log", params: { message: "inner {loop_item}" } }
                  ]
                }
              },
              { type: "log", params: { message: "outer {loop_item}" } }
            ]
          }
        }
      ];

    (prisma.automation.findUnique as any).mockResolvedValue({
      id: automationId,
      userId,
      active: true,
      triggerJson: JSON.stringify(trigger),
      actionsJson: JSON.stringify(actionsWithManualVar),
      user: mockUser,
    });
    (prisma.execution.create as any).mockResolvedValue({ id: "exec-1" });

    const result = await runAutomation(automationId, {});

    // Iteration A: LoopStart, Transform, InnerLoopStart, InnerLog, OuterLog
    // Iteration B: Transform, InnerLoopStart, InnerLog, OuterLog
    // Total steps: 1 (OuterLoopStart) + 2 * (1 Transform + 1 InnerLoopStart + 1 InnerLog + 1 OuterLog) = 9 steps
    expect(result.steps).toHaveLength(9);

    // Check isolation
    expect(result.steps[4].detail).toBe("outer A");
    expect(result.steps[8].detail).toBe("outer B");
    expect(result.steps[3].detail).toBe("inner 1");
  });

  it("should resume from a paused state inside a loop", async () => {
    const trigger: Trigger = { type: "webhook", config: {} };
    const actions: Action[] = [
      {
        type: "loop",
        params: {
          items: "X, Y",
          actions: [
            { type: "wait_for_approval", params: { to: "test@test.com" } },
            { type: "log", params: { message: "Approved {loop_item}" } }
          ],
        },
      },
    ];

    (prisma.automation.findUnique as any).mockResolvedValue({
      id: automationId,
      userId,
      active: true,
      triggerJson: JSON.stringify(trigger),
      actionsJson: JSON.stringify(actions),
      user: mockUser,
    });

    (prisma.execution.create as any).mockResolvedValue({ id: "exec-1" });

    // First run
    const result1 = await runAutomation(automationId, {});
    expect(result1.status).toBe("waiting");
    expect(result1.steps).toHaveLength(2); // LoopStart + WaitApproval (Iteration 0)
    expect(prisma.execution.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "exec-1" },
      data: expect.objectContaining({
        status: "waiting",
        pausedPath: "0.0.0" // action 0 (loop), iteration 0, sub-action 0 (wait)
      })
    }));

    // Resume
    const resumeToken = "token-123";
    (prisma.execution.findUnique as any).mockResolvedValue({
      id: "exec-1",
      automationId,
      status: "waiting",
      resumeToken,
      pausedPath: "0.0.0",
      inputJson: "{}",
      contextJson: JSON.stringify(result1.steps[0].output), // Not exactly, but for mock it's fine. Wait, engine uses ctx.data
      logJson: JSON.stringify(result1.steps),
      automation: { id: automationId, userId, actionsJson: JSON.stringify(actions), user: mockUser }
    });

    // In actual engine, contextJson is saved. Let's mock it properly.
    const savedContext = { loop_item: "X", loop_index: 0 };
    (prisma.execution.findUnique as any).mockResolvedValue({
        id: "exec-1",
        automationId,
        status: "waiting",
        resumeToken,
        pausedPath: "0.0.0",
        inputJson: "{}",
        contextJson: JSON.stringify(savedContext),
        logJson: JSON.stringify(result1.steps),
        automation: { id: automationId, userId, actionsJson: JSON.stringify(actions), user: mockUser }
      });

    const result2 = await resumeAutomation("exec-1", resumeToken);
    expect(result2.status).toBe("waiting"); // Pauses again for iteration 1!
    expect(result2.steps).toHaveLength(4); // LoopStart, Approved X (success), Approved X (log), WaitApproval (Iteration 1)
    // Wait, steps are appended.
    // Step 0: Loop start
    // Step 1: Wait (paused) -> converted to success on resume
    // Step 2: Log "Approved X"
    // Step 3: Wait (paused) for Y
    expect(result2.steps[1].status).toBe("success");
    expect(result2.steps[2].detail).toBe("Approved X");
    expect(result2.steps[3].status).toBe("paused");

    expect(prisma.execution.update).toHaveBeenLastCalledWith(expect.objectContaining({
        data: expect.objectContaining({
            pausedPath: "0.1.0" // action 0, iteration 1, sub-action 0
        })
    }));
  });
});
