# ⚡ Automatite

Plataforma **no-code de automação** com modelo **híbrido**:

- **Templates prontos** — o cliente escolhe um fluxo comum e ativa em segundos (Modelo 1).
- **Criação por IA** — o cliente descreve o que quer em linguagem natural e a Claude monta o fluxo em JSON (Modelo 2).
- **Flow Engine** — executa as automações quando um gatilho (webhook/formulário) chega.

Nenhuma configuração manual por cliente: você cria os templates uma vez e a IA cobre o resto.

Inclui **login multi-tenant**, **planos por tier** com limites de uso, **chave própria por cliente (BYOK)**, **envio de e-mail real via Resend**, **integrações reais** (Google Sheets, WhatsApp, Pipedrive, Twilio, Trello, Asana) com credenciais criptografadas, e **cobrança via Stripe**.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend + Backend | Next.js 14 (App Router) + TypeScript |
| Estilo | Tailwind CSS |
| Banco | SQLite via Prisma |
| IA | Anthropic SDK (Claude) com prompt caching |

## Como rodar

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
copy .env.example .env      # Windows (ou: cp .env.example .env)
#   Edite .env e cole sua ANTHROPIC_API_KEY (opcional para demo)

# 3. Criar o banco
npm run db:push

# 4. (Opcional) popular com um usuário e automação de exemplo
npm run db:seed
#   Cria login demo: demo@automatite.app / senha: demo123

# 5. Subir o app
npm run dev
```

Acesse http://localhost:3000 → **crie uma conta** (ou use o login demo acima).

> **Nota:** rode em `npm run dev` no localhost. No build de produção (`npm run start`)
> o cookie de sessão é `Secure` e exige **HTTPS** — então login só funciona sob HTTPS,
> que é o esperado em produção real.

> Sem `ANTHROPIC_API_KEY`, o gerador por IA funciona em **modo demonstração**
> (gera um fluxo padrão), então o app continua navegável.

## Estrutura

```
src/
├─ app/
│  ├─ page.tsx                  Dashboard (automações do usuário)
│  ├─ login/ · signup/          Autenticação
│  ├─ billing/                  Planos + uso atual
│  ├─ settings/                 Chave própria (BYOK)
│  ├─ create/                   Escolha: template ou IA
│  │  ├─ templates/             Catálogo de templates
│  │  └─ ai/                    Construtor por IA (questionário)
│  ├─ automations/[id]/         Detalhe + teste + histórico
│  └─ api/
│     ├─ auth/                  signup / login / logout
│     ├─ automations/           CRUD (escopo por usuário)
│     ├─ ai/generate/           Descrição → fluxo (Claude)
│     ├─ billing/               Troca de plano
│     ├─ settings/key/          Salvar/remover chave BYOK
│     └─ trigger/[id]/          Webhook público (respeita limites do plano)
├─ lib/
│  ├─ auth.ts                   Sessão por cookie + hash de senha
│  ├─ tiers.ts                  Definição dos planos e limites
│  ├─ anthropic.ts              Geração do fluxo com a IA (+ BYOK + fallback)
│  ├─ templates.ts              Templates pré-construídos
│  ├─ flow-types.ts             Tipos + validação (zod) do fluxo
│  ├─ db.ts                     Cliente Prisma
│  └─ engine/                   Motor de execução (e-mail real via Resend)
└─ components/                  UI (preview, builder, ações, auth, billing)
```

## Planos (tiers)

| Plano | Automações ativas | Execuções/mês |
| --- | --- | --- |
| Free | 1 | 100 |
| Starter ($49) | 5 | 5.000 |
| Pro ($149) | 20 | 50.000 |
| Enterprise ($499+) | ∞ | ∞ |

Os limites são aplicados ao **ativar** uma automação e ao **disparar** o webhook.
A troca de plano é imediata no MVP (sem cobrança) — o ponto de integração do
**Stripe** está em [`src/app/api/billing/route.ts`](src/app/api/billing/route.ts).

## Chave da IA: plataforma vs. BYOK

Por padrão as gerações usam a **chave da plataforma** (`ANTHROPIC_API_KEY` no `.env`).
Em **Configurações**, cada cliente pode colar a **própria chave** (BYOK), que passa a
ter prioridade — útil para clientes que querem pagar o próprio consumo.

## Como funciona um disparo

1. Um sistema externo (formulário, app) faz `POST /api/trigger/<id>` com um JSON.
2. O Flow Engine lê as ações da automação e executa em ordem.
3. Placeholders `{campo}` nos parâmetros são substituídos pelos valores do JSON.
4. Cada execução é registrada em **Histórico** com log passo-a-passo.

Teste pela própria interface na página da automação ("Testar agora").

## Ações e integrações

| Ação | Integração real | Como conectar |
| --- | --- | --- |
| `send_email` | Resend | `RESEND_API_KEY` no `.env` |
| `append_sheet` | Google Sheets | Settings → Integrações (Service Account JSON) |
| `send_whatsapp` | WhatsApp Cloud API | Settings → Integrações (token + phone number id) |
| `send_sms` | Twilio | Settings → Integrações (SID + token + número) |
| `create_task` | Pipedrive / Trello / Asana | Settings → Integrações (escolhe pelo `app` da ação) |
| `http_request` | HTTP genérico (sempre real) | — |
| `ai_generate` | Claude | chave da plataforma ou BYOK |
| `log` | — | — |

Cada cliente conecta suas contas em **Configurações → Integrações**; as credenciais
são **criptografadas (AES-256-GCM)** no banco usando `ENCRYPTION_KEY`. Se uma ação não
tiver integração conectada, ela roda em **modo mock** (registra no log, não falha) —
assim o fluxo continua testável. As chamadas reais ficam em
[`src/lib/providers.ts`](src/lib/providers.ts).

## Cobrança (Stripe)

Defina `STRIPE_SECRET_KEY`, os `STRIPE_PRICE_*` e `STRIPE_WEBHOOK_SECRET` no `.env`
para ativar a cobrança real: os botões de plano viram **Assinar** e levam ao Stripe
Checkout; o webhook em [`/api/billing/webhook`](src/app/api/billing/webhook/route.ts)
atualiza o plano do usuário. **Sem** as chaves do Stripe, a troca de plano é direta
e imediata (modo MVP sem cobrança). Para testar o webhook localmente use o
`stripe listen --forward-to localhost:3000/api/billing/webhook`.

## Gatilhos agendados (cron)

Automações com gatilho `schedule` rodam sozinhas. Configure a frequência no
**editor de fluxo** (presets como "todo dia às 9h" ou expressão cron livre; fuso
America/Sao_Paulo). O motor calcula o `nextRunAt` ao ativar e reagenda após cada
execução.

- Em **dev/self-host**, um scheduler in-process chama `/api/cron/tick` a cada 60s.
- Em **produção serverless**, defina `ENABLE_INPROCESS_CRON=false` e aponte um cron
  externo (cron-job.org, GitHub Actions, Vercel Cron) para `POST /api/cron/tick`,
  enviando o header `x-cron-secret: $CRON_SECRET`.

## Editor visual de fluxo

Em qualquer automação, **Editar fluxo** (`/automations/[id]/edit`) abre o editor:
alterar nome/descrição, trocar o gatilho (webhook / formulário / agendamento),
e adicionar, remover, **reordenar (arrastar e soltar)** e editar os parâmetros das
ações. Salva direto no fluxo (validado por zod).

## Próximos passos sugeridos

- OAuth "1 clique" para as integrações (hoje é via token/credencial colada).
- Portal de billing do Stripe (gerenciar/cancelar assinatura) e e-mails transacionais.
- Painel de uso/limites mais detalhado e alertas ao se aproximar do limite do plano.
```
