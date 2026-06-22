import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAutomation, resumeAutomation } from "./index";
import { prisma } from "../db";

vi.mock("../db", () => ({
  prisma: {
    automation: {
      findUnique: vi.fn(),
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

describe("Engine - Loop", () => {
  const mockAutomation = {
    id: "auto-1",
    userId: "user-1",
    active: true,
    triggerJson: JSON.stringify({ type: "webhook" }),
    user: {
      id: "user-1",
      tier: "free",
      anthropicKey: null,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should iterate over a list of items", async () => {
    const actions = [
      {
        type: "loop" as const,
        params: {
          items: "a,b,c",
          actions: [
            { type: "log" as const, params: { message: "Item: {loop_item}, Index: {loop_index}" } }
          ]
        }
      }
    ];

    (prisma.automation.findUnique as any).mockResolvedValue({
      ...mockAutomation,
      actionsJson: JSON.stringify(actions),
    });
    (prisma.execution.create as any).mockResolvedValue({ id: "exec-1" });

    const result = await runAutomation("auto-1", {});

    expect(result.status).toBe("success");
    // Steps: 1 (loop start) + 3 iterations of log = 4 steps
    expect(result.steps).toHaveLength(4);
    expect(result.steps[1].detail).toBe("Item: a, Index: 0");
    expect(result.steps[2].detail).toBe("Item: b, Index: 1");
    expect(result.steps[3].detail).toBe("Item: c, Index: 2");
  });

  it("should handle nested loops", async () => {
    const actions = [
      {
        type: "loop" as const,
        params: {
          items: "1,2",
          actions: [
            {
              type: "loop" as const,
              params: {
                items: "A,B",
                actions: [
                  { type: "log" as const, params: { message: "{loop_item}-{loop_index}" } }
                ]
              }
            }
          ]
        }
      }
    ];

    (prisma.automation.findUnique as any).mockResolvedValue({
      ...mockAutomation,
      actionsJson: JSON.stringify(actions),
    });
    (prisma.execution.create as any).mockResolvedValue({ id: "exec-1" });

    const result = await runAutomation("auto-1", {});

    expect(result.status).toBe("success");
    // Steps:
    // 0: Loop 1 start
    // 1:   Loop 2 start (it 0)
    // 2:     Log A-0
    // 3:     Log B-1
    // 4:   Loop 2 start (it 1)
    // 5:     Log A-0
    // 6:     Log B-1
    expect(result.steps).toHaveLength(7);
  });

  it("should pause and resume inside a loop", async () => {
    const actions = [
      {
        type: "loop" as const,
        params: {
          items: "item1,item2",
          actions: [
            { type: "wait_for_approval" as const, params: { to: "test@example.com" } },
            { type: "log" as const, params: { message: "Processed {loop_item}" } }
          ]
        }
      }
    ];

    (prisma.automation.findUnique as any).mockResolvedValue({
      ...mockAutomation,
      actionsJson: JSON.stringify(actions),
    });
    (prisma.execution.create as any).mockResolvedValue({ id: "exec-1" });

    // 1. Run until pause
    const runResult = await runAutomation("auto-1", {});

    expect(runResult.status).toBe("waiting");
    // Steps: 0: loop start, 1: wait_for_approval
    expect(runResult.steps).toHaveLength(2);
    expect(runResult.steps[1].status).toBe("paused");

    const updateCall = (prisma.execution.update as any).mock.calls[0][0];
    const pausedPath = updateCall.data.pausedPath;
    const resumeToken = updateCall.data.resumeToken;

    expect(pausedPath).toBe("0.loop_iteration.0.0"); // Action 0, iteration 0, sub-action 0

    // 2. Resume
    (prisma.execution.findUnique as any).mockResolvedValue({
      ...mockAutomation,
      automation: {
        ...mockAutomation,
        actionsJson: JSON.stringify(actions),
      },
      status: "waiting",
      resumeToken: resumeToken,
      pausedPath: pausedPath,
      inputJson: JSON.stringify({}),
      logJson: JSON.stringify(runResult.steps)
    });

    const resumeResult = await resumeAutomation("exec-1", resumeToken);

    expect(resumeResult.status).toBe("waiting"); // Should pause again on item2
    // Steps should now have:
    // 0: loop start
    // 1: wait_for_approval (now success)
    // 2: log (Processed item1)
    // 3: wait_for_approval (paused for item2)
    expect(resumeResult.steps).toHaveLength(4);
    expect(resumeResult.steps[2].detail).toBe("Processed item1");
    expect(resumeResult.steps[3].status).toBe("paused");
  });
});
