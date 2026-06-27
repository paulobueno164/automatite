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
      create: vi.fn().mockImplementation((data) => Promise.resolve({ id: "exec-1", ...data.data })),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    storage: {
      upsert: vi.fn(),
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

describe("Loop and Storage Actions", () => {
  const mockUser = { id: "user-1", tier: "pro", anthropicKey: null };

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.execution.count as any).mockResolvedValue(0);
  });

  it("should handle storage_set and storage_get", async () => {
    const automation = {
      id: "auto-1",
      userId: "user-1",
      active: true,
      triggerJson: JSON.stringify({ type: "webhook" }),
      actionsJson: JSON.stringify([
        { type: "storage_set", params: { key: "score", value: 100 } },
        { type: "storage_get", params: { key: "score" } },
        { type: "log", params: { message: "Score is {score}" } },
      ]),
      user: mockUser,
    };
    (prisma.automation.findUnique as any).mockResolvedValue(automation);
    (prisma.storage.findUnique as any).mockResolvedValue({ valueJson: JSON.stringify(100) });

    const result = await runAutomation("auto-1", {});

    expect(result.status).toBe("success");
    expect(prisma.storage.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_key: { userId: "user-1", key: "score" } },
      create: expect.objectContaining({ valueJson: "100" }),
    }));
    expect(result.steps[2].detail).toBe("Score is 100");
  });

  it("should execute a simple loop over an array", async () => {
    const automation = {
      id: "auto-2",
      userId: "user-1",
      active: true,
      triggerJson: JSON.stringify({ type: "webhook" }),
      actionsJson: JSON.stringify([
        {
          type: "loop",
          params: {
            items: ["apple", "banana"],
            actions: [
              { type: "log", params: { message: "Item: {loop_item} at {loop_index}" } }
            ]
          }
        }
      ]),
      user: mockUser,
    };
    (prisma.automation.findUnique as any).mockResolvedValue(automation);

    const result = await runAutomation("auto-2", {});

    expect(result.status).toBe("success");
    // Steps: [loop_start, log_apple, log_banana]
    expect(result.steps).toHaveLength(3);
    expect(result.steps[1].detail).toBe("Item: apple at 0");
    expect(result.steps[2].detail).toBe("Item: banana at 1");
  });

  it("should handle nested loops", async () => {
    const automation = {
      id: "auto-3",
      userId: "user-1",
      active: true,
      triggerJson: JSON.stringify({ type: "webhook" }),
      actionsJson: JSON.stringify([
        {
          type: "loop",
          params: {
            items: [1, 2],
            actions: [
              {
                type: "loop",
                params: {
                  items: ["a", "b"],
                  actions: [
                    { type: "log", params: { message: "{loop_item}{loop_index}" } }
                  ]
                }
              }
            ]
          }
        }
      ]),
      user: mockUser,
    };
    (prisma.automation.findUnique as any).mockResolvedValue(automation);

    const result = await runAutomation("auto-3", {});

    expect(result.status).toBe("success");
    // Steps:
    // 0: Loop 1 start
    //   1: Loop 2 start (iter 0)
    //     2: log a0
    //     3: log b1
    //   4: Loop 2 start (iter 1)
    //     5: log a0
    //     6: log b1
    expect(result.steps).toHaveLength(7);
  });

  it("should resume from a paused state within a loop", async () => {
    const automation = {
      id: "auto-4",
      userId: "user-1",
      active: true,
      triggerJson: JSON.stringify({ type: "webhook" }),
      actionsJson: JSON.stringify([
        { type: "log", params: { message: "Start" } },
        {
          type: "loop",
          params: {
            items: ["A", "B"],
            actions: [
              { type: "wait_for_approval", params: { to: "boss@example.com" } },
              { type: "log", params: { message: "Approved {loop_item}" } }
            ]
          }
        },
        { type: "log", params: { message: "End" } }
      ]),
      user: mockUser,
    };
    (prisma.automation.findUnique as any).mockResolvedValue(automation);

    // 1. Initial run
    const result1 = await runAutomation("auto-4", { initial: "data" });
    expect(result1.status).toBe("waiting");
    expect(result1.steps).toHaveLength(3); // log, loop, wait_for_approval
    expect(result1.steps[2].status).toBe("paused");

    // 2. Resume
    (prisma.execution.findUnique as any).mockResolvedValue({
      id: "exec-1",
      status: "waiting",
      resumeToken: "token-123",
      automationId: "auto-4",
      inputJson: JSON.stringify({ initial: "data" }),
      contextJson: JSON.stringify({ initial: "data", some: "other" }), // Simulated context persistence
      logJson: JSON.stringify(result1.steps),
      pausedPath: "1.0.0", // Action 1 (loop), Iteration 0, Sub-action 0 (wait)
      automation,
    });

    const result2 = await resumeAutomation("exec-1", "token-123");
    expect(result2.status).toBe("waiting"); // Paused again on second iteration
    // Previous steps (3) + Approved A (1) + wait B (1)
    expect(result2.steps).toHaveLength(5);
    expect(result2.steps[3].detail).toBe("Approved A");
    expect(result2.steps[4].status).toBe("paused");

    // Verify context was preserved
    const updateCall = vi.mocked(prisma.execution.update).mock.calls.find(c => c[0].where.id === "exec-1");
    const savedContext = JSON.parse((updateCall![0].data as any).contextJson);
    expect(savedContext.initial).toBe("data");
  });

  it("should handle dot-notation interpolation for nested data", async () => {
    const automation = {
      id: "auto-5",
      userId: "user-1",
      active: true,
      triggerJson: JSON.stringify({ type: "webhook" }),
      actionsJson: JSON.stringify([
        { type: "log", params: { message: "Hello {user.profile.name}" } },
      ]),
      user: mockUser,
    };
    (prisma.automation.findUnique as any).mockResolvedValue(automation);

    const result = await runAutomation("auto-5", { user: { profile: { name: "Alice" } } });

    expect(result.status).toBe("success");
    expect(result.steps[0].detail).toBe("Hello Alice");
  });

  it("should handle comma-separated string in loop items", async () => {
    const automation = {
      id: "auto-6",
      userId: "user-1",
      active: true,
      triggerJson: JSON.stringify({ type: "webhook" }),
      actionsJson: JSON.stringify([
        {
          type: "loop",
          params: {
            items: "x, y, z",
            actions: [
              { type: "log", params: { message: "{loop_item}" } }
            ]
          }
        }
      ]),
      user: mockUser,
    };
    (prisma.automation.findUnique as any).mockResolvedValue(automation);

    const result = await runAutomation("auto-6", {});

    expect(result.status).toBe("success");
    expect(result.steps).toHaveLength(4); // loop, x, y, z
    expect(result.steps[1].detail).toBe("x");
    expect(result.steps[3].detail).toBe("z");
  });
});
