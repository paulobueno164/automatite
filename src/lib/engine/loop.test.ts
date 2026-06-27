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
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "exec-1", ...data })),
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

describe("Engine - Loops and Storage", () => {
  const mockUser = { id: "user-1", tier: "pro", anthropicKey: null };

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.execution.count as any).mockResolvedValue(0);
  });

  it("should execute a loop correctly", async () => {
    const automation = {
      id: "auto-loop",
      userId: "user-1",
      active: true,
      triggerJson: JSON.stringify({ type: "webhook" }),
      actionsJson: JSON.stringify([
        {
          type: "loop",
          params: {
            items: ["A", "B"],
            actions: [
              { type: "log", params: { message: "Item: {loop_item}" } }
            ]
          }
        }
      ]),
      user: mockUser,
    };

    (prisma.automation.findUnique as any).mockResolvedValue(automation);

    const result = await runAutomation("auto-loop", {});

    expect(result.status).toBe("success");
    expect(result.steps.length).toBe(3);
    expect(result.steps[1].detail).toBe("Item: A");
    expect(result.steps[2].detail).toBe("Item: B");
  });

  it("should handle storage_set and storage_get", async () => {
     const automation = {
      id: "auto-storage",
      userId: "user-1",
      active: true,
      triggerJson: JSON.stringify({ type: "webhook" }),
      actionsJson: JSON.stringify([
        { type: "storage_set", params: { key: "counter", value: "10" } },
        { type: "storage_get", params: { key: "counter", output_key: "my_val" } },
        { type: "log", params: { message: "Value is {my_val}" } }
      ]),
      user: mockUser,
    };

    (prisma.automation.findUnique as any).mockResolvedValue(automation);
    (prisma.storage.findUnique as any).mockResolvedValue({ value: "10" });

    const result = await runAutomation("auto-storage", {});

    expect(result.status).toBe("success");
    expect(prisma.storage.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId_key: { userId: "user-1", key: "counter" } },
        create: expect.objectContaining({ value: "10" })
    }));
    expect(result.steps[2].detail).toBe("Value is 10");
  });

  it("should pause and resume within a loop", async () => {
    const automation = {
      id: "auto-pause-loop",
      userId: "user-1",
      active: true,
      triggerJson: JSON.stringify({ type: "webhook" }),
      actionsJson: JSON.stringify([
        {
          type: "loop",
          params: {
            items: ["A", "B"],
            actions: [
              { type: "log", params: { message: "Before {loop_item}" } },
              { type: "wait_for_approval", params: { to: "test@test.com" } },
              { type: "log", params: { message: "After {loop_item}" } }
            ]
          }
        }
      ]),
      user: mockUser,
    };

    (prisma.automation.findUnique as any).mockResolvedValue(automation);

    const runResult = await runAutomation("auto-pause-loop", {});
    expect(runResult.status).toBe("waiting");
    expect(runResult.steps.length).toBe(3);
    expect(runResult.steps[2].status).toBe("paused");

    const execution = {
        id: "exec-1",
        status: "waiting",
        resumeToken: "token-123",
        pausedPath: "0.0.1",
        inputJson: "{}",
        logJson: JSON.stringify(runResult.steps),
        automation
    };
    (prisma.execution.findUnique as any).mockResolvedValue(execution);

    const resumeResult = await resumeAutomation("exec-1", "token-123");
    expect(resumeResult.status).toBe("waiting");
    expect(resumeResult.steps.length).toBe(6);
    expect(resumeResult.steps[3].detail).toBe("After A");
    expect(resumeResult.steps[4].detail).toBe("Before B");
    expect(resumeResult.steps[5].status).toBe("paused");
  });
});
