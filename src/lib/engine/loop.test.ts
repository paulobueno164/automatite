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
      create: vi.fn(),
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

describe("Loop and Context Persistence", () => {
  const mockUser = { id: "user-1", tier: "pro", anthropicKey: null };
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
    (prisma.execution.count as any).mockResolvedValue(0);
    (loadUserIntegrations as any).mockResolvedValue({});
  });

  it("should iterate over a list and preserve context", async () => {
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
    (prisma.execution.create as any).mockResolvedValue({ id: "exec-1" });

    const result = await runAutomation("auto-1", {});

    expect(result.status).toBe("success");
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].detail).toBe("Item: A, Index: 0");
    expect(result.steps[1].detail).toBe("Item: B, Index: 1");

  });

  it("should handle JSON string in items", async () => {
    const automationWithJson = {
      ...mockAutomation,
      actionsJson: JSON.stringify([
        {
          type: "loop",
          params: {
            items: '["X", "Y"]',
            actions: [
              { type: "log", params: { message: "Item: {loop_item}" } }
            ]
          }
        }
      ]),
    };
    (prisma.automation.findUnique as any).mockResolvedValue(automationWithJson);
    (prisma.execution.create as any).mockResolvedValue({ id: "exec-json" });

    const result = await runAutomation("auto-1", {});

    expect(result.status).toBe("success");
    expect(result.steps[0].detail).toBe("Item: X");
    expect(result.steps[1].detail).toBe("Item: Y");
  });

  it("should handle nested pauses and resume with context", async () => {
    const automationWithPause = {
      ...mockAutomation,
      actionsJson: JSON.stringify([
        {
          type: "loop",
          params: {
            items: ["Item1", "Item2"],
            actions: [
              { type: "wait_for_approval", params: { to: "test@test.com" } },
              { type: "log", params: { message: "Processed {loop_item}" } }
            ]
          }
        }
      ]),
    };
    (prisma.automation.findUnique as any).mockResolvedValue(automationWithPause);
    (prisma.execution.create as any).mockResolvedValue({ id: "exec-1" });

    // 1. Initial run
    const result1 = await runAutomation("auto-1", {});
    expect(result1.status).toBe("waiting");
    expect(result1.steps).toHaveLength(1); // Paused at wait_for_approval in first iteration

    const updateCall = (prisma.execution.update as any).mock.calls[0][0];
    const pausedPath = updateCall.data.pausedPath;
    const contextJson = updateCall.data.contextJson;
    const resumeToken = updateCall.data.resumeToken;

    expect(pausedPath).toBe("0.0.0"); // 0 (loop), 0 (iteration), 0 (wait_for_approval)
    expect(contextJson).toContain('"loop_item":"Item1"');

    // 2. Resume
    (prisma.execution.findUnique as any).mockResolvedValue({
      id: "exec-1",
      status: "waiting",
      resumeToken,
      pausedPath,
      contextJson,
      inputJson: "{}",
      logJson: JSON.stringify(result1.steps),
      automation: automationWithPause,
    });

    const result2 = await resumeAutomation("exec-1", resumeToken);

    // Should have:
    // - Success log for wait_for_approval (Item1)
    // - Log for Processed Item1
    // - Paused log for wait_for_approval (Item2)
    expect(result2.status).toBe("waiting");
    expect(result2.steps).toHaveLength(3);
    expect(result2.steps[1].detail).toBe("Processed Item1");
    expect(result2.steps[2].status).toBe("paused");

    const updateCall2 = (prisma.execution.update as any).mock.calls[1][0];
    expect(updateCall2.data.pausedPath).toBe("0.1.0"); // 0 (loop), 1 (iteration), 0 (wait_for_approval)
    expect(updateCall2.data.contextJson).toContain('"loop_item":"Item2"');
  });

  it("should support dot-notation for loop items", async () => {
     const automationWithDotNotation = {
      ...mockAutomation,
      actionsJson: JSON.stringify([
        {
          type: "loop",
          params: {
            items: "{data.list}",
            actions: [
              { type: "log", params: { message: "Val: {loop_item.val}" } }
            ]
          }
        }
      ]),
    };
    (prisma.automation.findUnique as any).mockResolvedValue(automationWithDotNotation);
    (prisma.execution.create as any).mockResolvedValue({ id: "exec-dot" });

    const result = await runAutomation("auto-1", { data: { list: [{ val: 10 }, { val: 20 }] } });

    expect(result.status).toBe("success");
    expect(result.steps[0].detail).toBe("Val: 10");
    expect(result.steps[1].detail).toBe("Val: 20");
  });
});
