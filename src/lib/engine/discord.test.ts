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

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Discord Integration - runAutomation", () => {
  const mockAutomation = {
    id: "auto-1",
    userId: "user-1",
    active: true,
    triggerJson: JSON.stringify({ type: "webhook" }),
    actionsJson: JSON.stringify([
      {
        type: "send_discord",
        params: { text: "Hello Discord!" }
      }
    ]),
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
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
      text: () => Promise.resolve(""),
    });
  });

  it("should send a message to Discord using credentials from integrations", async () => {
    (loadUserIntegrations as any).mockResolvedValue({
      discord: { webhookUrl: "https://discord.com/api/webhooks/123" }
    });

    const result = await runAutomation("auto-1", {});

    expect(result.status).toBe("success");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/123",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content: "Hello Discord!" }),
      })
    );
  });

  it("should send a message to Discord using webhookUrl from params", async () => {
    const automationWithParam = {
      ...mockAutomation,
      actionsJson: JSON.stringify([
        {
          type: "send_discord",
          params: {
            text: "Hello from Param!",
            webhookUrl: "https://discord.com/api/webhooks/param"
          }
        }
      ]),
    };
    (prisma.automation.findUnique as any).mockResolvedValue(automationWithParam);
    (loadUserIntegrations as any).mockResolvedValue({});

    const result = await runAutomation("auto-1", {});

    expect(result.status).toBe("success");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/param",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content: "Hello from Param!" }),
      })
    );
  });

  it("should fail if no webhookUrl is provided", async () => {
    (loadUserIntegrations as any).mockResolvedValue({});

    const result = await runAutomation("auto-1", {});

    expect(result.status).toBe("error");
    expect(result.steps[0].detail).toContain("Discord não conectado");
  });

  it("should handle fetch errors from Discord", async () => {
    (loadUserIntegrations as any).mockResolvedValue({
      discord: { webhookUrl: "https://discord.com/api/webhooks/123" }
    });
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve("Bad Request"),
    });

    const result = await runAutomation("auto-1", {});

    expect(result.status).toBe("error");
    expect(result.steps[0].detail).toContain("Discord error: 400");
  });
});
