# Roadmap Automatite

Este documento descreve o estado atual da plataforma e a visão para o futuro. O roadmap é flexível e pode mudar com base no feedback da comunidade e dos clientes.

*This document outlines the current state of the platform and the vision for the future. The roadmap is flexible and may change based on community and customer feedback.*

---

## 🇧🇷 Português

### 🚀 O que temos hoje (Fase 1 - MVP)

- **Geração de fluxo via IA:** Usuário descreve em texto, a Claude gera o workflow JSON estruturado.
- **Flow Engine Base:** Motor que processa gatilhos sequencialmente, substitui variáveis dinâmicas e loga cada execução.
- **Integrações reais (v1):** Google Sheets, WhatsApp, Twilio, Pipedrive, Trello, Asana, HTTP/Webhook.
- **Gatilhos iniciais:** Webhooks, Formulários Públicos, e Agendamentos.
- **SaaS Base:** Autenticação, planos (Free/Pro/Enterprise) e cobrança via Stripe, BYOK (Bring Your Own Key).
- **Segurança de credenciais:** Criptografia AES-256-GCM para chaves salvas.

### 📅 Curto Prazo (Próximos passos)

- **Fluxos Condicionais (If/Else):** Permitir rotas diferentes no fluxo baseadas no payload recebido.
- **Editor Visual Simplificado:** Interface de nós arrastáveis (drag-and-drop) para quem deseja modificar manualmente o fluxo gerado pela IA.
- **Novas Integrações:**
  - Slack, Discord (Notificações).
  - Hubspot, Salesforce (CRM).
  - Gmail (Envio nativo além de SMTP customizado).
- **Tratamento de Erros:** Opção de "tentar novamente" (retry) ou acionar um fluxo alternativo em caso de falha de um nó.

### 🌓 Médio Prazo

- **Colaboração em Equipe:** Múltiplos usuários em um mesmo "Workspace", controle de permissões (Admin, Editor, Viewer).
- **Versionamento de Fluxos:** Salvar o histórico de versões das automações e permitir *rollback* para versões anteriores.
- **Loopings (For-each):** Capacidade de iterar sobre arrays vindos de um webhook (ex: processar múltiplos itens de um carrinho).
- **Templates de Comunidade:** Permitir que usuários publiquem seus próprios templates e os compartilhem com outros.

### 🔭 Longo Prazo

- **Agentes Autônomos:** Em vez de apenas executar passos rígidos, a automação pode invocar agentes de IA para pesquisar na web, tomar decisões com base no contexto, e então seguir.
- **Analytics Avançado:** Dashboards visuais detalhados sobre economia de tempo, taxas de sucesso, e uso intensivo de APIs externas.
- **Marketplace de Integrações:** SDK para que desenvolvedores de terceiros possam criar e plugar suas próprias integrações diretamente na plataforma.

---

## 🇺🇸 English

### 🚀 What we have today (Phase 1 - MVP)

- **AI Flow Generation:** User describes intent in text, Claude generates the structured JSON workflow.
- **Core Flow Engine:** Engine that processes triggers sequentially, substitutes dynamic variables, and logs every run.
- **Real Integrations (v1):** Google Sheets, WhatsApp, Twilio, Pipedrive, Trello, Asana, HTTP/Webhook.
- **Initial Triggers:** Webhooks, Public Forms, and Schedules.
- **SaaS Foundation:** Auth, tiered plans (Free/Pro/Enterprise) and Stripe billing, BYOK (Bring Your Own Key).
- **Credential Security:** AES-256-GCM encryption for stored API keys.

### 📅 Short Term (Next steps)

- **Conditional Flows (If/Else):** Allow different routes in the workflow based on incoming payload data.
- **Simplified Visual Editor:** Drag-and-drop node interface for users who want to manually tweak the AI-generated flow.
- **New Integrations:**
  - Slack, Discord (Notifications).
  - Hubspot, Salesforce (CRM).
  - Gmail (Native sending alongside custom SMTP).
- **Error Handling:** "Retry" options or fallback workflows in case a specific node fails.

### 🌓 Medium Term

- **Team Collaboration:** Multiple users in a single "Workspace", role-based access control (Admin, Editor, Viewer).
- **Flow Versioning:** Save version history of automations and allow rollbacks.
- **Looping (For-each):** Iterate over arrays received from a webhook (e.g., process multiple items in a shopping cart).
- **Community Templates:** Allow users to publish their own templates and share them with the community.

### 🔭 Long Term

- **Autonomous Agents:** Instead of rigid steps, the automation can summon AI agents to perform web research, make context-based decisions, and then proceed.
- **Advanced Analytics:** Visual dashboards tracking time saved, success rates, and heavy API usage.
- **Integration Marketplace:** SDK for third-party developers to build and plug in their own integrations directly into the platform.
