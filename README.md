# JiraForge · NTT DATA

Plataforma interna de configuração de projetos Jira para múltiplos clientes.

## Arquitetura

```
jiraforge/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── tenants/           # CRUD de clientes
│   │   │   ├── connections/       # Conexões Jira por cliente
│   │   │   │   └── [id]/check/    # Health check
│   │   │   ├── projects/
│   │   │   │   └── deploy/        # Orquestrador de criação
│   │   │   └── templates/         # Biblioteca de templates
│   │   ├── clients/               # Tela de gestão de clientes
│   │   ├── builder/               # Wizard de criação de projeto
│   │   ├── templates/             # Biblioteca de templates
│   │   └── automations/           # Roll-up rules
│   ├── components/
│   ├── lib/
│   │   ├── jira/
│   │   │   ├── client.ts          # Jira REST API client
│   │   │   └── deployer.ts        # Orquestrador de deploy
│   │   ├── supabase/client.ts
│   │   └── crypto/credentials.ts  # AES-256-GCM encryption
│   └── types/index.ts
├── supabase/
│   └── schema.sql                 # Schema completo + RLS + seeds
├── rollup-service/
│   └── main.py                    # FastAPI (deploy no Railway)
└── .env.example
```

## Setup

### 1. Supabase

```bash
# Crie um projeto em supabase.com
# Execute o schema:
psql $DATABASE_URL < supabase/schema.sql
```

### 2. Next.js

```bash
npm install
cp .env.example .env.local
# Preencha as variáveis no .env.local
npm run dev
```

### 3. Roll-up Service (Railway)

```bash
# No Railway, crie um novo projeto Python
# Variáveis de ambiente necessárias:
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
JIRAFORGE_API_URL=https://jiraforge.vercel.app
INTERNAL_API_KEY=...   # mesmo valor do Next.js
```

```bash
# requirements.txt
fastapi==0.110.0
uvicorn==0.27.1
httpx==0.27.0
python-multipart==0.0.9
```

### 4. Atlassian OAuth App

1. Acesse https://developer.atlassian.com/console/myapps/
2. Crie uma nova app OAuth 2.0 (3LO)
3. Scopes necessários:
   - `read:jira-work`
   - `write:jira-work`
   - `manage:jira-project`
   - `manage:jira-configuration`
   - `manage:jira-webhook`
4. Callback URL: `https://jiraforge.vercel.app/api/connections/oauth/callback`

## Sequência de Deploy (Jira API calls por projeto)

Ao criar um projeto, o deployer executa ~12 chamadas em ordem:

1. `GET /myself` — obtém accountId do service account
2. `POST /project` — cria o projeto
3. `POST /issuetype` × N — cria cada issue type
4. `PUT /project/{id}/issuetypes` × N — associa ao projeto
5. `POST /workflow/create` — cria workflow com statuses e transitions
6. `POST /workflowscheme` — cria scheme
7. `PUT /project/{id}/workflowscheme` — associa scheme ao projeto
8. `POST /field` × N — cria custom fields
9. `POST /field/{id}/context` × N — cria contexto por projeto/issue type
10. `POST /screens` × 3 — create, edit, view screens
11. `POST /screenscheme` — screen scheme
12. `POST /issuetypescreenscheme` — mapeia screens por issue type
13. `PUT /project/{key}/permissionscheme` — aplica permission scheme

## Multi-tenant: Isolamento de Dados

- Cada cliente (tenant) tem seus próprios registros isolados por `tenant_id`
- Row Level Security (RLS) no Supabase garante isolamento no banco
- Credenciais Jira são criptografadas com AES-256-GCM antes de salvar
- A chave de criptografia fica apenas no ambiente do servidor (nunca no banco)
- O roll-up service recebe `tenant_id` na URL do webhook — impossível cruzar dados

## Adicionando um novo cliente

1. Criar tenant em `/clients` → "Novo cliente"
2. Adicionar conexão Jira (API token ou OAuth)
3. Fazer health check da conexão
4. Pronto — pode criar projetos para esse cliente
