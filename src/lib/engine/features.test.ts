import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAction, EngineContext } from "./actions";
import { Action, ExecutionStep } from "../flow-types";
import Anthropic from "@anthropic-ai/sdk";

// Mock Anthropic
vi.mock("@anthropic-ai/sdk", () => {
  class AnthropicMock {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: '{"fixed": "params"}' }],
      }),
    }
  }
  return {
    default: AnthropicMock,
  };
});

describe("Flow Engine Features", () => {
  let ctx: EngineContext;

  beforeEach(() => {
    ctx = {
      data: { name: "Alice", items: "one, two, three" },
      userId: "user_1",
      automationId: "auto_1",
      executionId: "exec_1",
      apiKey: "fake_key",
      getIntegrations: async () => ({}),
    };
  });

  describe("Loop Action", () => {
    it("should parse comma-separated items", async () => {
      const action: Action = {
        type: "loop",
        params: { items: "{items}" },
      };
      const step = await runAction(action, ctx);
      expect(step.status).toBe("success");
      expect(step.output).toEqual({ items: ["one", "two", "three"] });
    });

    it("should parse JSON array items", async () => {
      const action: Action = {
        type: "loop",
        params: { items: "[1, 2, 3]" },
      };
      const step = await runAction(action, ctx);
      expect(step.status).toBe("success");
      expect(step.output).toEqual({ items: [1, 2, 3] });
    });
  });

  describe("AI Self-Healing", () => {
    it("should retry with fixed params when an action fails", async () => {
      // Forçamos uma falha em log (simulando falha ao forçar erro no switch ou interpolate)
      // Como log é simples, vamos zombar o console.log para ver se o self-healing foi chamado
      const consoleSpy = vi.spyOn(console, "log");

      // Criamos uma ação que vai falhar propositalmente no runAction (por exemplo, log sem message mas com erro simulado)
      // Para testar de verdade, precisaríamos que o switch desse erro.
      // Vamos tentar um http_request sem URL que lança erro se não for tratada.
      const action: Action = {
        type: "http_request",
        params: { url: "" }, // Isso deve retornar fail() mas não lançar erro no switch.
      };

      // Para testar o catch do self-healing, o corpo do switch precisa LANÇAR um erro.
      // No código atual, a maioria dos erros são capturados e retornam fail().
      // Vamos usar uma ação que lança erro, como send_email sem credenciais SMTP nem Resend API KEY.

      const step = await runAction(action, ctx);
      // http_request sem url retorna fail() diretamente, não entra no catch de auto-correção.

      // Vamos tentar provocar um erro real no switch.
      // Se passarmos um parâmetro que o interpolate quebra? Não, interpolate é seguro.
      // E se a ação for "send_email" mas ctx.getIntegrations lançar erro?
      ctx.getIntegrations = async () => { throw new Error("Integration Error"); };

      const action2: Action = { type: "send_email", params: { to: "test@test.com" } };
      const step2 = await runAction(action2, ctx);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[SELF-HEALING]"));
      expect(step2.status).toBe("error");
      expect(step2.detail).toContain("[Auto-corrigido pela IA]");
    });
  });
});
