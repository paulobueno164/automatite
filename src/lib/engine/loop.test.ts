import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAutomation, resumeAutomation } from "./index";
import { prisma } from "../db";
import { loadUserIntegrations } from "../integrations";

vi.mock("../db", () => ({
  prisma: {
    automation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    execution: {
      count: vi.fn(),
      create: vi.fn().mockImplementation((data) => ({ id: "exec-1", ...data.data })),
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

describe("Loop Action and State Persistence", () => {
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

  it("should iterate over items in a loop", async () => {
    const automation = {
      ...mockAutomation,
      actionsJson: JSON.stringify([
        {
          type: "loop",
          params: {
            items: "{items}",
            actions: [
              { type: "log", params: { message: "Item: {loop_item.name}" } }
            ]
          }
        }
      ]),
    };
    (prisma.automation.findUnique as any).mockResolvedValue(automation);

    const payload = {
      items: [
        { name: "Alice" },
        { name: "Bob" }
      ]
    };

    const result = await runAutomation("auto-1", payload);

    expect(result.status).toBe("success");
    // Steps: 1 (start loop) + 2 (log Alice) + 3 (log Bob)
    expect(result.steps).toHaveLength(3);
    expect(result.steps[1].detail).toBe("Item: Alice");
    expect(result.steps[2].detail).toBe("Item: Bob");
  });

  it("should handle nested property access and dot-notation", async () => {
     const automation = {
      ...mockAutomation,
      actionsJson: JSON.stringify([
        { type: "log", params: { message: "Nested: {deep.data.value}" } }
      ]),
    };
    (prisma.automation.findUnique as any).mockResolvedValue(automation);

    const payload = {
      deep: { data: { value: "found me" } }
    };

    const result = await runAutomation("auto-1", payload);
    expect(result.steps[0].detail).toBe("Nested: found me");
  });

  it("should persist state and resume correctly within a loop", async () => {
    const automation = {
      ...mockAutomation,
      actionsJson: JSON.stringify([
        {
          type: "loop",
          params: {
            items: "{items}",
            actions: [
              { type: "log", params: { message: "Before: {loop_item}" } },
              { type: "wait_for_approval", params: { to: "admin@test.com" } },
              { type: "log", params: { message: "After: {loop_item}" } }
            ]
          }
        }
      ]),
    };
    (prisma.automation.findUnique as any).mockResolvedValue(automation);

    const payload = { items: ["A", "B"] };

    // 1. Start execution
    const result1 = await runAutomation("auto-1", payload);
    expect(result1.status).toBe("waiting");
    // Steps: Loop Start, Log "Before: A", Wait (Paused)
    expect(result1.steps).toHaveLength(3);
    expect(result1.steps[1].detail).toBe("Before: A");
    expect(result1.steps[2].status).toBe("paused");

    const executionData = (prisma.execution.create as any).mock.results[0].value;
    const updateCall = (prisma.execution.update as any).mock.calls[0][0];
    const pausedPath = updateCall.data.pausedPath;
    const contextJson = updateCall.data.contextJson;
    const resumeToken = updateCall.data.resumeToken;

    expect(pausedPath).toBe("0.0.1"); // Loop index 0, Iteration index 0, Action index 1
    expect(JSON.parse(contextJson).loop_item).toBe("A");

    // 2. Resume execution
    (prisma.execution.findUnique as any).mockResolvedValue({
      id: "exec-1",
      status: "waiting",
      resumeToken,
      pausedPath,
      contextJson,
      inputJson: JSON.stringify(payload),
      logJson: JSON.stringify(result1.steps),
      automation
    });

    const result2 = await resumeAutomation("exec-1", resumeToken);
    expect(result2.status).toBe("waiting"); // Paused again on item "B"

    // Steps so far:
    // [0] Loop Start
    // [1] Log Before A
    // [2] Wait (now success)
    // [3] Log After A
    // [4] Log Before B
    // [5] Wait (Paused)
    expect(result2.steps).toHaveLength(6);
    expect(result2.steps[3].detail).toBe("After: A");
    expect(result2.steps[4].detail).toBe("Before: B");
    expect(result2.steps[5].status).toBe("paused");

    // 3. Resume again
    const updateCall2 = (prisma.execution.update as any).mock.calls[1][0];
    const pausedPath2 = updateCall2.data.pausedPath;
    const contextJson2 = updateCall2.data.contextJson;
    const resumeToken2 = updateCall2.data.resumeToken;

    (prisma.execution.findUnique as any).mockResolvedValue({
      id: "exec-1",
      status: "waiting",
      resumeToken: resumeToken2,
      pausedPath: pausedPath2,
      contextJson: contextJson2,
      inputJson: JSON.stringify(payload),
      logJson: JSON.stringify(result2.steps),
      automation
    });

    const result3 = await resumeAutomation("exec-1", resumeToken2);
    expect(result3.status).toBe("success");
    expect(result3.steps).toHaveLength(7);
    expect(result3.steps[6].detail).toBe("After: B");
  });
});
