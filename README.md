# ⚡ Automatite

> Plataforma **no-code de automação** multi-tenant em que o usuário **descreve em linguagem natural** o que quer e a **Claude monta o fluxo** — com integrações reais, planos por tier e cobrança via Stripe.

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

### Sobre e Proposta de Valor

O **Automatite** é um SaaS de automação que democratiza a criação de fluxos de trabalho complexos. Nossa proposta de valor foca em um modelo **híbrido** e intuitivo: em vez de arrastar e soltar dezenas de blocos numa interface complexa, o usuário pode simplesmente **descrever o que precisa em linguagem natural** (ex: *"Quando eu receber um webhook, envie um email de boas-vindas e adicione o cliente no Pipedrive"*). A inteligência artificial (Claude) interpreta o pedido e gera a automação completa. Para necessidades comuns, também oferecemos **templates prontos**.

### Arquitetura e Fluxo de Dados

A arquitetura do Automatite foi desenhada para ser escalável, segura e multi-tenant:
1. **Frontend / Dashboard**: Construído com Next.js 14 App Router, provendo uma interface limpa onde o usuário gerencia suas automações, credenciais e métricas de execução.
2. **AI Generative Layer**: Quando o usuário digita o prompt, nosso backend se comunica com a API da Anthropic (Claude). O fluxo gerado é validado estritamente via **Zod** para garantir que apenas integrações suportadas e formatos válidos sejam salvos no banco.
3. **Flow Engine (Motor de Execução)**: O coração da plataforma. Quando um gatilho é disparado (Webhooks, Agendamentos via cron/scheduler, ou Formulários públicos), o *Flow Engine*:
   - Substitui variáveis dinâmicas (`{nome_campo}`) utilizando o payload recebido.
   - Executa as ações do fluxo sequencialmente.
   - Se comunica de forma segura com APIs externas (Google Sheets, WhatsApp, Pipedrive, etc.).
4. **Segurança de Dados**: Credenciais de terceiros (Tokens, chaves de API) inseridas pelo usuário são **criptografadas com AES-256-GCM** antes de irem para o banco de dados.
5. **Faturamento e Tiers**: Totalmente integrado com Stripe, onde os limites de execução e número de fluxos ativos são validados on-the-fly pelo *Flow Engine* e backend.

### Destaques Técnicos

- **Geração de fluxo por LLM**: descrição em linguagem natural → JSON de automação **validado com Zod**, com *prompt caching* da Anthropic e *fallback* de demonstração sem chave.
- **Multi-tenant** com autenticação por sessão (cookie + hash de senha) e escopo de dados por usuário.
- **Flow Engine** próprio: executa ações em ordem, substitui placeholders e registra log passo-a-passo de cada execução.
- **Integrações reais** (Google Sheets, WhatsApp Cloud API, Twilio, Pipedrive, Trello, Asana, HTTP) com credenciais **criptografadas em AES-256-GCM** no banco; ações sem integração rodam em **modo mock**.
- **BYOK** (Bring Your Own Key): cada cliente pode usar a própria chave da Anthropic.
- **Planos por tier** com limites de automações ativas e execuções/mês, aplicados na ativação e no disparo.
- **Cobrança via Stripe** (Checkout + webhook) e **gatilhos agendados** (scheduler in-process em dev, cron externo em produção serverless com header secreto).

### Stack

| Camada | Tecnologia |
| --- | --- |
| Full-stack | Next.js 14 (App Router) + TypeScript |
| Estilo | Tailwind CSS |
| Banco | SQLite via Prisma (preparado para PostgreSQL) |
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

### About & Value Proposition

**Automatite** is an automation SaaS that democratizes the creation of complex workflows. Our value proposition focuses on a **hybrid** and intuitive model: instead of dragging and dropping dozens of nodes in a complex interface, users can simply **describe what they need in natural language** (e.g., *"When I receive a webhook, send a welcome email and add the client to Pipedrive"*). The artificial intelligence (Claude) interprets the request and generates the complete automation. For common needs, we also provide **ready-made templates**.

### Architecture & Data Flow

The architecture is designed to be scalable, secure, and multi-tenant:
1. **Frontend / Dashboard**: Built with Next.js 14 App Router, providing a clean interface where users manage their automations, credentials, and execution metrics.
2. **AI Generative Layer**: When the user enters a prompt, our backend communicates with the Anthropic API (Claude). The generated flow is strictly validated via **Zod** to ensure only supported integrations and valid formats are saved to the database.
3. **Flow Engine**: The core of the platform. When a trigger is fired (Webhooks, Schedules via cron/scheduler, or Public Forms), the *Flow Engine*:
   - Substitutes dynamic variables (`{field_name}`) using the received payload.
   - Executes the flow actions sequentially.
   - Communicates securely with external APIs (Google Sheets, WhatsApp, Pipedrive, etc.).
4. **Data Security**: Third-party credentials (Tokens, API keys) entered by the user are **encrypted at AES-256-GCM** before hitting the database.
5. **Billing & Tiers**: Fully integrated with Stripe, where execution limits and active flow limits are validated on-the-fly by the *Flow Engine* and backend.

### Technical Highlights

- **LLM flow generation**: natural-language description → **Zod-validated** automation JSON, with Anthropic prompt caching and a keyless demo fallback.
- **Multi-tenant** with session auth (cookie + password hash) and per-user data scoping.
- **Custom Flow Engine**: runs actions in order, substitutes placeholders, and records a step-by-step log per run.
- **Real integrations** (Google Sheets, WhatsApp Cloud API, Twilio, Pipedrive, Trello, Asana, HTTP) with credentials **encrypted at AES-256-GCM** in the DB; unconnected actions run in **mock mode**.
- **BYOK** (Bring Your Own Key): each customer can use their own Anthropic key.
- **Tiered plans** with active-automation and monthly-run limits, enforced on activation and trigger.
- **Stripe billing** (Checkout + webhook) and **scheduled triggers** (in-process scheduler in dev, external cron with a secret header in serverless production).

### Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Prisma/SQLite · Anthropic SDK (Claude) · Stripe · Zod.

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
