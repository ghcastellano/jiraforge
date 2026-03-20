# JiraForge · Guia de Setup Completo

## Pré-requisitos

- Node.js 18+
- Python 3.11+ (para o rollup-service)
- Conta no [Supabase](https://supabase.com)
- Conta no [Vercel](https://vercel.com)
- Conta no [Railway](https://railway.app)
- Git configurado

---

## 1. Clonar e instalar dependências

```bash
git clone https://github.com/SEU_USER/jiraforge.git
cd jiraforge
npm install
```

---

## 2. Configurar o Supabase

1. Crie um novo projeto em [supabase.com](https://supabase.com)
2. Vá em **SQL Editor** e execute em ordem:
   ```
   supabase/schema.sql      ← tabelas, índices, RLS, seeds
   supabase/functions.sql   ← RPC, policies, triggers
   ```
3. Copie as credenciais em **Settings → API**:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`

---

## 3. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Edite `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Gere com: openssl rand -base64 32
CREDENTIALS_ENCRYPTION_KEY=sua-chave-secreta-32-chars-minimo

# Gere com: openssl rand -hex 32
INTERNAL_API_KEY=sua-chave-interna-hex

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 4. Rodar em desenvolvimento

```bash
npm run dev
# Acesse: http://localhost:3000
```

---

## 5. Deploy do Roll-up Service no Railway

```bash
# Instale a Railway CLI
npm install -g @railway/cli
railway login

# Entre na pasta do serviço
cd rollup-service

# Inicialize e faça deploy
railway init
railway up
```

Configure as variáveis no dashboard do Railway:
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ... (service_role key)
JIRAFORGE_API_URL=https://jiraforge.vercel.app
INTERNAL_API_KEY=mesma-chave-do-nextjs
```

Após o deploy, copie a URL gerada (ex: `https://jiraforge-rollup.railway.app`)
e adicione ao `.env.local`:
```
ROLLUP_SERVICE_URL=https://jiraforge-rollup.railway.app
```

---

## 6. Deploy no Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

Configure as variáveis no Vercel Dashboard → Settings → Environment Variables:
- Copie todas as variáveis do `.env.local`
- Atualize `NEXT_PUBLIC_APP_URL` para a URL do Vercel

---

## 7. Configurar Atlassian OAuth (para conexões OAuth)

1. Acesse [developer.atlassian.com](https://developer.atlassian.com/console/myapps/)
2. Crie uma app → **OAuth 2.0 (3LO)**
3. Adicione os scopes:
   - `read:jira-work`
   - `write:jira-work`
   - `manage:jira-project`
   - `manage:jira-configuration`
   - `manage:jira-webhook`
4. Callback URL: `https://SUA-URL.vercel.app/api/connections/oauth/callback`
5. Adicione ao `.env.local`:
   ```
   ATLASSIAN_CLIENT_ID=seu-client-id
   ATLASSIAN_CLIENT_SECRET=seu-client-secret
   ```

---

## 8. Adicionar primeiro cliente

1. Acesse o JiraForge em produção
2. Menu → **Clientes** → **Novo cliente**
3. Crie o tenant (ex: Avangrid)
4. Clique em **+ Conexão** e configure o Jira do cliente
5. Clique em **Testar** para verificar a conexão
6. Pronto — pode criar projetos via **Novo Projeto**

---

## Estrutura do projeto

```
jiraforge/
├── src/
│   ├── app/
│   │   ├── api/                    ← API Routes (Next.js BFF)
│   │   │   ├── tenants/            ← CRUD clientes
│   │   │   ├── connections/        ← Conexões Jira + health check
│   │   │   ├── projects/           ← Histórico + deploy
│   │   │   ├── templates/          ← Biblioteca de templates
│   │   │   └── automations/        ← Roll-up rules CRUD
│   │   ├── clients/                ← Tela gestão de clientes
│   │   ├── builder/                ← Wizard 7-steps
│   │   ├── templates/              ← Biblioteca de templates
│   │   ├── automations/            ← Roll-up rules
│   │   └── activity/               ← Log de eventos
│   ├── components/layout/          ← AppShell + sidebar
│   ├── lib/
│   │   ├── jira/                   ← Jira API client + deployer
│   │   ├── supabase/               ← Supabase clients
│   │   └── crypto/                 ← AES-256-GCM encryption
│   ├── hooks/                      ← Data fetching hooks
│   ├── store/                      ← Zustand global state
│   └── types/                      ← TypeScript types
├── supabase/
│   ├── schema.sql                  ← Tabelas + RLS + seeds
│   └── functions.sql               ← RPCs + policies + triggers
└── rollup-service/
    ├── main.py                     ← FastAPI webhook service
    ├── requirements.txt
    ├── Procfile
    └── railway.json
```
