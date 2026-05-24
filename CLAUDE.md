# MeuDIA Dashboard — Regras operacionais para Claude

Leia este arquivo antes de qualquer tarefa neste repo.

---

## Acesso à infraestrutura

**VPS SAACS** — acessível diretamente via SSH:
```bash
ssh root@82.112.244.174
```
Chave já configurada. Não perguntar credenciais — conectar direto.

**Evolution API key** (global, todas as instâncias):
```
28bad1a004a318d3f7ba983f466b7168
```

**n8n**: https://n8n.saacs.com.br

---

## Deploy

**Deploy = `git push` no branch `main`** → Vercel faz CI/CD automático.

Nunca sugerir deploy manual, upload de arquivos, ou comandos Vercel CLI. Push no git é suficiente.

---

## Estado atual do projeto

**Ler primeiro:** `README.md` deste repo — contém o que foi feito e o que está pendente.

**Decisões estratégicas:** `saacs-brain/sessions/SESSAO_ATUAL.md`

---

## Documentação a manter atualizada

Ao final de qualquer sessão que mude funcionalidades, atualizar:

1. **`README.md`** (este repo) — seção "Estado atual": o que foi feito, o que está pendente
2. **`saacs-brain/sessions/SESSAO_ATUAL.md`** — só se houver decisão estratégica nova
3. **`MCP_SAACS/Projeto MeuDIA/MeuDIA - Fluxo1.json`** — exportar do n8n após qualquer alteração no fluxo
4. **`MCP_SAACS/Templates/dashboard_saacs_template.md`** — se um padrão reutilizável for criado

Fazer commit e push nos repos afetados.

---

## Variáveis de ambiente

- `.env.local` → desenvolvimento local
- Vercel Settings → Environment Variables → produção
- As duas precisam ser atualizadas quando uma nova variável é criada

---

## Repos

| Repo | Propósito |
|---|---|
| `saacsai/meudia-dashboard` | Código operacional (este repo) |
| `saacsai/saacs-brain` | Decisões estratégicas, prompts, ADRs |
| `MCP_SAACS/` (local) | Templates, JSONs n8n, arquivos de projeto |
