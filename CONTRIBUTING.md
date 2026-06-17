# Contributing to Automatite / Contribuindo com o Automatite

First off, thank you for considering contributing to Automatite!
*Primeiramente, obrigado por considerar contribuir com o Automatite!*

## 🇧🇷 Português

### 1. Setup Local

1. Faça o fork do repositório.
2. Clone o seu fork: `git clone https://github.com/SEU_USUARIO/automatite.git`
3. Entre na pasta: `cd automatite`
4. Instale as dependências: `npm install`
5. Configure as variáveis de ambiente: `cp .env.example .env`
   - Configure a chave do Stripe para testes se for mexer com pagamentos.
   - Configure a `ANTHROPIC_API_KEY` se for testar a IA (ou não configure para rodar em modo fallback/mock).
6. Rode as migrations e gere o client do Prisma: `npm run db:push` e `npx prisma generate`
7. Inicie o projeto: `npm run dev`

### 2. Estrutura de Pastas

- `/src/app`: Rotas da aplicação (App Router do Next.js). Páginas, layouts e rotas de API.
- `/src/components`: Componentes reutilizáveis (UI) feitos em React e estilizados com Tailwind.
- `/src/lib`: Contém toda a lógica core de negócios, utilitários, e engines.
  - `/src/lib/engine`: Código do *Flow Engine* que executa automações.
  - `/src/lib/provider-catalog.ts` & `providers.ts`: Catálogo de integrações disponíveis.
- `/prisma`: Schema do banco de dados e script de seed.

### 3. Padrões de Código

- Usamos **TypeScript** estrito. Evite o uso de `any`.
- A estilização é feita utilizando **Tailwind CSS**.
- Validações de entrada e de schemas do banco devem ser feitas usando **Zod**.
- Tente manter os componentes do frontend separados da lógica de negócio. Use as Server Actions ou APIs para comunicar com a lógica contida em `src/lib`.

### 4. Processo de Pull Request

1. Crie uma branch para a sua feature ou bugfix: `git checkout -b feature/minha-feature`
2. Escreva o seu código e faça commit (mensagens claras e descritivas).
3. Antes de abrir o PR, certifique-se de que os testes e linters passam:
   - `npm run lint`
   - `npx tsc --noEmit`
   - `npm test`
4. Faça o push para o seu fork: `git push origin feature/minha-feature`
5. Abra o Pull Request neste repositório. Descreva detalhadamente o que foi feito, por que foi feito e como testar.

---

## 🇺🇸 English

### 1. Local Setup

1. Fork the repository.
2. Clone your fork: `git clone https://github.com/YOUR_USER/automatite.git`
3. Enter the folder: `cd automatite`
4. Install dependencies: `npm install`
5. Set up environment variables: `cp .env.example .env`
   - Setup Stripe keys for testing if you plan to touch billing logic.
   - Setup `ANTHROPIC_API_KEY` if testing AI (or leave it out to use the fallback/mock mode).
6. Run migrations and generate Prisma client: `npm run db:push` and `npx prisma generate`
7. Start the project: `npm run dev`

### 2. Folder Structure

- `/src/app`: Application routes (Next.js App Router). Pages, layouts, and API routes.
- `/src/components`: Reusable UI components in React, styled with Tailwind.
- `/src/lib`: Core business logic, utilities, and engines.
  - `/src/lib/engine`: The *Flow Engine* code that executes automations.
  - `/src/lib/provider-catalog.ts` & `providers.ts`: Catalog of available integrations.
- `/prisma`: Database schema and seed script.

### 3. Code Standards

- We use strict **TypeScript**. Avoid using `any`.
- Styling is done via **Tailwind CSS**.
- Input and schema validation should be handled with **Zod**.
- Keep frontend components separated from business logic. Use Server Actions or API routes to interact with the logic in `src/lib`.

### 4. Pull Request Process

1. Create a branch for your feature or bugfix: `git checkout -b feature/my-feature`
2. Write your code and commit (clear and descriptive commit messages).
3. Before opening a PR, ensure that linters and tests pass:
   - `npm run lint`
   - `npx tsc --noEmit`
   - `npm test`
4. Push to your fork: `git push origin feature/my-feature`
5. Open a Pull Request in this repository. Describe in detail what was done, why, and how to test it.
