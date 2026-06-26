"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type PendingConfirmation = {
  tool: string;
  input: Record<string, unknown>;
  label: string;
};

const STORAGE_KEY = "automatite_assistant_chat";
const PENDING_KEY = "automatite_assistant_pending";
const WELCOME: Message = {
  role: "assistant",
  content:
    "Olá! Sou seu assistente no Automatite. Posso ver o estado da sua conta, criar e ativar automações, personalizar formulários, gerenciar leads, tarefas e muito mais. O que você precisa?",
};

function loadStoredMessages(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [WELCOME];
    const parsed = JSON.parse(raw) as Message[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [WELCOME];
  } catch {
    return [WELCOME];
  }
}

function normalizeReply(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isAffirmative(text: string): boolean {
  const t = normalizeReply(text);
  if (/^(sim|s|ok|pode|confirmo|confirma|confirmar|vai|faz|faca|bora|isso|quero|beleza|perfeito|certo|claro|manda|executa|prossiga|continua|yes)\.?!*$/.test(t)) {
    return true;
  }
  return /^(sim|ok|pode|confirma|vai|faz)\s/.test(t);
}

function isNegative(text: string): boolean {
  const t = normalizeReply(text);
  return /^(nao|n|cancela|cancelar|deixa|para|pare|stop)\.?!*$/.test(t) || /^(nao|cancela)\s/.test(t);
}

function isMessageList(v: unknown): v is Message[] {
  return (
    Array.isArray(v) &&
    v.every((m) => m && typeof m === "object" && "role" in m && "content" in m)
  );
}

function loadStoredPending(): PendingConfirmation[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingConfirmation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function AiAssistant() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [pendingQueue, setPendingQueue] = useState<PendingConfirmation[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(loadStoredMessages());
    const storedPending = loadStoredPending();
    if (storedPending.length > 0) setConfirmations(storedPending);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (pendingQueue.length > 0) {
      localStorage.setItem(PENDING_KEY, JSON.stringify(pendingQueue));
    } else {
      localStorage.removeItem(PENDING_KEY);
    }
  }, [pendingQueue, hydrated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending, pendingQueue, open]);

  function setConfirmations(list: PendingConfirmation[]) {
    setPendingQueue(list);
    setPending(list[0] ?? null);
  }

  async function send(userText?: string) {
    const text = (userText ?? input).trim();
    if (!text || busy) return;

    if (pending) {
      if (isAffirmative(text)) {
        setInput("");
        const withUser: Message[] = [...messages, { role: "user", content: text }];
        setMessages(withUser);
        await confirm(withUser);
        return;
      }
      if (isNegative(text)) {
        setInput("");
        setMessages((m) => [...m, { role: "user", content: text }]);
        cancelPending();
        return;
      }
      setInput("");
      setMessages((m) => [
        ...m,
        { role: "user", content: text },
        {
          role: "assistant",
          content:
            "Ainda tem uma ação esperando confirmação logo acima. Digite sim para continuar ou cancelar para desistir.",
        },
      ]);
      return;
    }

    setInput("");
    const nextMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setBusy(true);
    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha na resposta");
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      const queue: PendingConfirmation[] = data.pendingConfirmations ?? (data.pendingConfirmation ? [data.pendingConfirmation] : []);
      if (queue.length > 0) setConfirmations(queue);
      if (data.executed) router.refresh();
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: err instanceof Error ? err.message : "Erro ao processar." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(messagesForApi?: Message[]) {
    if (!pending || busy) return;
    const current = pendingQueue[0] ?? pending;
    const remaining = pendingQueue.slice(1);
    const hasMore = remaining.length > 0;
    const apiMessages = isMessageList(messagesForApi) ? messagesForApi : messages;

    setBusy(true);
    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          confirmedTool: { name: current.tool, input: current.input },
          executeOnly: hasMore,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao executar");

      if (hasMore) {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: `✓ ${current.label} — feito! Confirme a próxima ação abaixo.` },
        ]);
        setPendingQueue(remaining);
        setPending(remaining[0]);
      } else {
        setPending(null);
        setPendingQueue([]);
        setMessages((m) => [...m, { role: "assistant", content: data.reply ?? "Ação concluída!" }]);
      }
      router.refresh();
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: err instanceof Error ? err.message : "Erro ao executar ação." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function cancelPending() {
    setPending(null);
    setPendingQueue([]);
    setMessages((m) => [
      ...m,
      { role: "assistant", content: "Ok, cancelei as ações pendentes. Quer fazer outra coisa?" },
    ]);
  }

  function clearChat() {
    setMessages([WELCOME]);
    setPending(null);
    setPendingQueue([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PENDING_KEY);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-2xl text-white shadow-lg transition hover:bg-brand-700 hover:shadow-xl"
        title="Assistente IA"
        aria-label={open ? "Fechar assistente IA" : "Abrir assistente IA"}
        aria-expanded={open}
        aria-controls="ai-assistant-panel"
      >
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <div
          id="ai-assistant-panel"
          role="dialog"
          aria-label="Assistente de IA"
          className="fixed bottom-24 right-5 z-50 flex h-[min(520px,calc(100vh-8rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="flex items-start justify-between border-b border-slate-100 bg-gradient-to-r from-brand-600 to-indigo-600 px-4 py-3 text-white">
            <div>
              <p className="font-semibold">Assistente Automatite</p>
              <p className="text-xs text-white/80">Pode fazer qualquer coisa na sua conta</p>
            </div>
            <button type="button" onClick={clearChat} className="text-xs text-white/70 hover:text-white" title="Limpar conversa">
              Limpar
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user" ? "ml-auto bg-brand-600 text-white" : "bg-slate-100 text-slate-800"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}

            {pending && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                <p className="mb-1 font-medium text-amber-900">Confirmar ação</p>
                {pendingQueue.length > 1 && (
                  <p className="mb-2 text-xs text-amber-700">
                    {pendingQueue.length} ações na fila — esta é a primeira
                  </p>
                )}
                <p className="mb-1 text-amber-800">{pending.label}</p>
                <p className="mb-3 text-xs text-amber-700">Ou digite <strong>sim</strong> no campo abaixo.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => confirm()} disabled={busy} className="btn-primary flex-1 text-xs py-2">
                    {busy ? "Executando…" : "Sim, confirmar"}
                  </button>
                  <button type="button" onClick={cancelPending} disabled={busy} className="btn-ghost flex-1 text-xs py-2">
                    Cancelar{pendingQueue.length > 1 ? " todas" : ""}
                  </button>
                </div>
              </div>
            )}

            {busy && !pending && (
              <p className="text-xs text-slate-400 animate-pulse" aria-live="polite">
                Pensando…
              </p>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            className="border-t border-slate-100 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                placeholder="Peça qualquer coisa…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="btn-primary shrink-0 px-4"
                aria-label="Enviar mensagem"
              >
                →
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
