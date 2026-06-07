# ⚡ Automatite

> Plataforma **no-code de automação** multi-tenant em que o usuário **descreve em linguagem
> natural** o que quer e a **Claude monta o fluxo** — com integrações reais, planos por tier e
> cobrança via Stripe.

![Next.js](https://img.shields.io/badge/Next.js_14-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)
![Anthropic](https://img.shields.io/badge/Claude_(Anthropic)-D97757?logo=anthropic&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-06B6D4?logo=tailwindcss&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-635BFF?logo=stripe&logoColor=white)

**[Português](#-português) · [English](#-english)**

> 🚧 **Work in progress** — MVP funcional, em evolução.

---

## 🇧🇷 Português

### Sobre

SaaS completo de automação com modelo **híbrido**: **templates prontos** para os fluxos comuns +
**criação por IA**, onde o cliente descreve o objetivo e a Claude gera o fluxo em JSON validado.
Um **Flow Engine** executa as ações quando um gatilho (webhook, formulário ou agendamento) chega.

### Destaques técnicos

- **Geração de fluxo por LLM**: descrição em linguagem natural → JSON de automação **validado com
  Zod**, com *prompt caching* da Anthropic e *fallback* de demonstração sem chave.
- **Multi-tenant** com autenticação por sessão (cookie + hash de senha) e escopo de dados por usuário.
- **Flow Engine** próprio: executa ações em ordem, substitui placeholders `{campo}` pelo payload do
  gatilho e registra log passo-a-passo de cada execução.
- **Integrações reais** (Google Sheets, WhatsApp Cloud API, Twilio, Pipedrive, Trello, Asana, HTTP)
  com credenciais **criptografadas em AES-256-GCM** no banco; ações sem integração rodam em **modo mock**.
- **BYOK** (Bring Your Own Key): cada cliente pode usar a própria chave da Anthropic.
- **Planos por tier** com limites de automações ativas e execuções/mês, aplicados na ativação e no disparo.
- **Cobrança via Stripe** (Checkout + webhook) e **gatilhos agendados** (scheduler in-process em dev,
  cron externo em produção serverless com header secreto).

### Stack

| Camada | Tecnologia |
| --- | --- |
| Full-stack | Next.js 14 (App Router) + TypeScript |
| Estilo | Tailwind CSS |
| Banco | SQLite via Prisma |
| IA | Anthropic SDK (Claude) com prompt caching |
| Pagamentos | Stripe |
| Validação | Zod |

### Como rodar

```bash
npm install
cp .env.example .env     # cole sua ANTHROPIC_API_KEY (opcional p/ modo demo)
npm run db:push          # cria o banco
npm run db:seed          # (opcional) usuário demo: demo@automatite.app / demo123
npm run dev              # http://localhost:3000
```

Sem `ANTHROPIC_API_KEY`, o gerador por IA roda em **modo demonstração** e o app continua navegável.

---

## 🇺🇸 English

### About

A full SaaS automation platform with a **hybrid** model: **ready-made templates** for common flows
plus **AI-driven creation**, where the user describes the goal and Claude generates a validated JSON
flow. A custom **Flow Engine** runs the actions when a trigger (webhook, form or schedule) fires.

### Technical highlights

- **LLM flow generation**: natural-language description → **Zod-validated** automation JSON, with
  Anthropic prompt caching and a keyless demo fallback.
- **Multi-tenant** with session auth (cookie + password hash) and per-user data scoping.
- **Custom Flow Engine**: runs actions in order, substitutes `{field}` placeholders from the trigger
  payload, and records a step-by-step log per run.
- **Real integrations** (Google Sheets, WhatsApp Cloud API, Twilio, Pipedrive, Trello, Asana, HTTP)
  with credentials **encrypted at AES-256-GCM**; unconnected actions run in **mock mode**.
- **BYOK** (Bring Your Own Key) per customer.
- **Tiered plans** with active-automation and monthly-run limits, enforced on activation and trigger.
- **Stripe billing** (Checkout + webhook) and **scheduled triggers** (in-process scheduler in dev,
  external cron with a secret header in serverless production).

### Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Prisma/SQLite · Anthropic SDK (Claude) ·
Stripe · Zod.

### Getting started

```bash
npm install
cp .env.example .env     # paste your ANTHROPIC_API_KEY (optional for demo mode)
npm run db:push
npm run db:seed          # optional demo user: demo@automatite.app / demo123
npm run dev              # http://localhost:3000
```

---

<sub>Autor / Author: **Paulo Bueno** · [github.com/paulobueno164](https://github.com/paulobueno164)</sub>
