# MeuDIA Dashboard

> Organizado e priorizado. Todo dia.  
> Secretaria virtual por WhatsApp para profissionais que não podem parar para responder tudo.

Produto SAACS.AI · [meudia.saacs.com.br](https://meudia.saacs.com.br)

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15 App Router + TypeScript + Tailwind |
| Auth + DB | Supabase |
| LLM | Google Gemini 2.5 Flash (REST API v1beta) |
| WhatsApp | Evolution API V2 (self-hosted na VPS) |
| Orquestração | n8n (self-hosted na VPS) |
| Deploy | Vercel (CI/CD automático via push no `main`) |

---

## Infraestrutura

| Serviço | Endereço |
|---|---|
| Dashboard produção | https://meudia.saacs.com.br |
| Cadastro (deep-link) | https://meudia.saacs.com.br/login?modo=cadastro |
| Evolution API (interno Docker) | http://evolution:8080 |
| VPS SAACS | `82.112.244.174` — SSH: `root@82.112.244.174` |
| Supabase projeto | `zeigxaekyltzitcpefli` |
| Supabase SQL Editor | https://app.supabase.com/project/zeigxaekyltzitcpefli/sql |

---

## Credenciais n8n (salvas no painel do n8n)

| Credential | Nome no n8n | ID |
|---|---|---|
| Redis | Redis SeuDIA | `sAdBQbnEV9z1O6ed` |
| Supabase | Supabase FILE | `qVDAhgdwZVcAEKd3` |
| Gemini | Google Gemini SeuDIA | `fpHeWD7qrWyARptC` |
| Evolution API key | — | `CA03A237-2DCC-4684-8989-0E615AE6220B` |

---

## Variáveis de ambiente (Vercel)

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
EVOLUTION_API_URL=https://evolution.saacs.com.br
EVOLUTION_API_KEY=CA03A237-2DCC-4684-8989-0E615AE6220B
CRON_SECRET=          # header de autenticação para endpoints de cron
```

---

## Estrutura de pastas

```
app/
  api/
    assistente/       # BIA + Olivia (chat, histórico, memórias, comando)
    whatsapp/         # webhook EVO + Olivia/BIA incoming (n8n chama aqui)
    contatos/         # CRUD contatos
    notificacoes/     # notificações do dashboard
    onboarding/       # steps de onboarding
    perfil/           # perfil do usuário
  dashboard/          # páginas do dashboard (Meu Dia, Chat, Contatos, etc.)
  login/              # auth (login + cadastro + recuperar senha)
components/
  ChatWithSidebar.tsx # componente reutilizável — base de todos os produtos SAACS.AI
  OnboardingView.tsx  # onboarding conversacional (BIA guia o primeiro acesso)
  Sidebar.tsx         # nav com desbloqueio progressivo
lib/
  assistant-tools.ts  # TOOL_DECLARATIONS + executeTool + callGemini
  supabase.ts         # cliente Supabase
```

---

## Migrações Supabase

Executar na ordem no SQL Editor:

1. `supabase_migration_onboarding.sql`
2. `supabase_migration_memory.sql`
3. `supabase_migration_chat_source.sql`
4. `supabase_migration_chat_notificacoes.sql`
5. `supabase_migration_conversations.sql`
6. `supabase_migration_grupos_contatos.sql`
7. `supabase_migration_tasks.sql`
8. `supabase_migration_tasks_duedate.sql`

---

## n8n — Fluxos

| Fluxo | Arquivo | Status |
|---|---|---|
| Fluxo 1 — Mensagem recebida (Olivia + BIA Vendedora) | `MCP_SAACS/Projeto MeuDIA/MeuDIA - Fluxo1.json` | em revisão |
| Fluxo 2 — Digest cron (manhã + tarde) | — | pendente |

Arquitetura e prompts dos fluxos: `saacs-brain/products/meudia/prompts/`

---

## Desenvolvimento local

```bash
npm install
npm run dev
# http://localhost:3000
```

---

## Deploy

Push no branch `main` → Vercel faz deploy automático.  
Migrations SQL: executar manualmente no Supabase SQL Editor.
