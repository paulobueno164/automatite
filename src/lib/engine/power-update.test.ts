import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAutomation } from "./index";
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
    },
    storage: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    lead: {
      findFirst: vi.fn(),
    }
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

describe("Power Update - Loops and Storage", () => {
  const mockUser = { id: "user-1", tier: "pro", anthropicKey: null };

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.execution.count as any).mockResolvedValue(0);
  });

  it("should execute a loop and interpolate loop_item", async () => {
    const actions = [
      {
        type: "loop",
        params: {
          items: ["A", "B"],
          actions: [
            { type: "log", params: { message: "Item: {loop_item}" } }
          ]
        }
      }
    ];

    (prisma.automation.findUnique as any).mockResolvedValue({
      id: "auto-1",
      userId: "user-1",
      active: true,
      triggerJson: JSON.stringify({ type: "webhook" }),
      actionsJson: JSON.stringify(actions),
      user: mockUser,
    });

    const result = await runAutomation("auto-1", {});

    expect(result.status).toBe("success");
    // Steps: 1 (loop start) + 2 (log A) + 2 (log B) -> actually the loop action itself produces a step, then sub-actions
    // Wait, let's check index.ts: it pushes step for "loop", then runs sub-actions.
    // So:
    // Step 0: action="loop", detail="Iniciando repetição"
    // Step 1: action="log", detail="Item: A"
    // Step 2: action="log", detail="Item: B"
    expect(result.steps).toHaveLength(3);
    expect(result.steps[1].detail).toBe("Item: A");
    expect(result.steps[2].detail).toBe("Item: B");
  });

  it("should handle nested property access in interpolation", async () => {
    const actions = [
      {
        type: "loop",
        params: {
          items: [{ name: "Alice" }, { name: "Bob" }],
          actions: [
            { type: "log", params: { message: "Hello {loop_item.name}" } }
          ]
        }
      }
    ];

    (prisma.automation.findUnique as any).mockResolvedValue({
      id: "auto-1",
      userId: "user-1",
      active: true,
      triggerJson: JSON.stringify({ type: "webhook" }),
      actionsJson: JSON.stringify(actions),
      user: mockUser,
    });

    const result = await runAutomation("auto-1", {});

    expect(result.steps[1].detail).toBe("Hello Alice");
    expect(result.steps[2].detail).toBe("Hello Bob");
  });

  it("should support dynamic loop items using interpolation", async () => {
    const actions = [
      {
        type: "loop",
        params: {
          items: "{list}",
          actions: [
            { type: "log", params: { message: "Val: {loop_item}" } }
          ]
        }
      }
    ];

    (prisma.automation.findUnique as any).mockResolvedValue({
      id: "auto-dynamic-loop",
      userId: "user-1",
      active: true,
      triggerJson: JSON.stringify({ type: "webhook" }),
      actionsJson: JSON.stringify(actions),
      user: mockUser,
    });

    const result = await runAutomation("auto-dynamic-loop", { list: ["X", "Y"] });

    expect(result.status).toBe("success");
    expect(result.steps[1].detail).toBe("Val: X");
    expect(result.steps[2].detail).toBe("Val: Y");
  });

  it("should set and get from storage", async () => {
    const actions = [
      { type: "storage_set", params: { key: "counter", value: "10" } },
      { type: "storage_get", params: { key: "counter", output_key: "my_val" } },
      { type: "log", params: { message: "Value is {my_val}" } }
    ];

    (prisma.automation.findUnique as any).mockResolvedValue({
      id: "auto-2",
      userId: "user-1",
      active: true,
      triggerJson: JSON.stringify({ type: "webhook" }),
      actionsJson: JSON.stringify(actions),
      user: mockUser,
    });

    (prisma.storage.findUnique as any).mockResolvedValue({ key: "counter", value: "10" });

    const result = await runAutomation("auto-2", {});

    expect(prisma.storage.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_key: { userId: "user-1", key: "counter" } },
      create: expect.objectContaining({ value: "10" })
    }));
    expect(result.steps[2].detail).toBe("Value is 10");
  });
});
