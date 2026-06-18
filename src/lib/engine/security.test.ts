import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAutomation } from "./index";
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
    },
  },
}));

vi.mock("../integrations", () => ({
  loadUserIntegrations: vi.fn().mockResolvedValue({}),
}));

vi.mock("../capture-form-crm", () => ({
  captureFormToCrm: vi.fn().mockResolvedValue({}),
}));

vi.mock("./actions", () => ({
  runAction: vi.fn().mockResolvedValue({ status: "success", label: "Mock", action: "log", detail: "ok" }),
}));

describe("Security - runAutomation", () => {
  const mockAutomation = {
    id: "auto-1",
    userId: "user-1",
    active: true,
    triggerJson: JSON.stringify({ type: "webhook" }),
    actionsJson: JSON.stringify([{ type: "log", params: { message: "hello" } }]),
    user: {
      id: "user-1",
      tier: "free",
      anthropicKey: null,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the automation owner's userId", async () => {
    (prisma.automation.findUnique as any).mockResolvedValue(mockAutomation);
    (prisma.execution.create as any).mockResolvedValue({ id: "exec-1" });

    const result = await runAutomation("auto-1", {});
    expect(result.userId).toBe("user-1");
  });

  it("should block scheduled automations if triggered externally (no _isInternal flag)", async () => {
    const scheduledAutomation = {
      ...mockAutomation,
      triggerJson: JSON.stringify({ type: "schedule" }),
    };
    (prisma.automation.findUnique as any).mockResolvedValue(scheduledAutomation);

    await expect(runAutomation("auto-1", {})).rejects.toThrow(
      "Agendamentos só podem ser disparados internamente"
    );
  });

  it("should allow scheduled automations if triggered internally (isInternal option)", async () => {
    const scheduledAutomation = {
      ...mockAutomation,
      triggerJson: JSON.stringify({ type: "schedule" }),
    };
    (prisma.automation.findUnique as any).mockResolvedValue(scheduledAutomation);
    (prisma.execution.create as any).mockResolvedValue({ id: "exec-1" });

    const result = await runAutomation("auto-1", {}, { isInternal: true });
    expect(result.status).toBe("success");
  });
});
