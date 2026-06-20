import { describe, it, expect, vi, beforeEach } from "vitest";
import { slackSend } from "./providers";
import { runAction, EngineContext } from "./engine/actions";

describe("Slack Integration", () => {
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("slackSend provider", () => {
    it("should send a notification successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, ts: "123456" }),
      });

      const creds = { botToken: "xoxb-test", defaultChannel: "#general" };
      const params = { text: "Hello Slack!" };

      const result = await slackSend(creds, params);

      expect(mockFetch).toHaveBeenCalledWith("https://slack.com/api/chat.postMessage", expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer xoxb-test",
        }),
        body: JSON.stringify({ channel: "#general", text: "Hello Slack!" }),
      }));
      expect(result.detail).toContain("Mensagem enviada");
    });

    it("should throw error if Slack API returns ok: false", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: "invalid_auth" }),
      });

      const creds = { botToken: "xoxb-test", defaultChannel: "#general" };
      const params = { text: "Hello Slack!" };

      await expect(slackSend(creds, params)).rejects.toThrow("Slack error: invalid_auth");
    });
  });

  describe("Flow Engine Integration", () => {
    it("should execute send_slack action through runAction", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, ts: "123456" }),
      });

      const ctx: EngineContext = {
        data: { nome: "Fulano" },
        userId: "user-1",
        automationId: "auto-1",
        executionId: "exec-1",
        getIntegrations: async () => ({
          slack: { botToken: "xoxb-test", defaultChannel: "#alerts" }
        })
      };

      const action = {
        type: "send_slack" as const,
        label: "Avisar no Slack",
        params: { text: "Novo lead: {nome}" }
      };

      const step = await runAction(action, ctx);

      expect(step.status).toBe("success");
      expect(step.detail).toContain("#alerts");
      expect(mockFetch).toHaveBeenCalledWith("https://slack.com/api/chat.postMessage", expect.objectContaining({
        body: JSON.stringify({ channel: "#alerts", text: "Novo lead: Fulano" }),
      }));
    });

    it("should fail if slack integration is missing", async () => {
      const ctx: EngineContext = {
        data: {},
        userId: "user-1",
        automationId: "auto-1",
        executionId: "exec-1",
        getIntegrations: async () => ({})
      };

      const action = {
        type: "send_slack" as const,
        params: { text: "Test" }
      };

      const step = await runAction(action, ctx);

      expect(step.status).toBe("error");
      expect(step.detail).toContain("Slack não conectado");
    });
  });
});
