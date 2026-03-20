-- ============================================================
-- JiraForge · NTT DATA · Multi-tenant Schema
-- ============================================================

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- TENANTS (clients: Avangrid, Santander, etc.)
-- ============================================================
create table tenants (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text not null unique,       -- avangrid, santander
  description text,
  logo_url    text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- NTT DATA USERS → TENANT ACCESS
-- ============================================================
create table tenant_users (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  email       text not null,              -- NTT DATA email
  name        text not null,
  role        text not null default 'operator' check (role in ('admin','operator','viewer')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique(tenant_id, email)
);

-- ============================================================
-- JIRA CONNECTIONS (per tenant, multiple allowed)
-- ============================================================
create table jira_connections (
  id               uuid primary key default uuid_generate_v4(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  name             text not null,         -- "Avangrid Prod", "Santander Dev"
  jira_base_url    text not null,         -- https://avangrid.atlassian.net
  jira_cloud_id    text,                  -- filled after first API call
  auth_type        text not null check (auth_type in ('oauth', 'api_token')),
  -- credentials stored AES-256 encrypted (never plain text)
  encrypted_creds  text not null,         -- see lib/crypto.ts
  creds_iv         text not null,         -- IV for AES-GCM
  -- oauth specific
  oauth_scope      text,
  token_expires_at timestamptz,
  -- status
  status           text not null default 'pending' check (status in ('pending','active','error','expired')),
  last_checked_at  timestamptz,
  last_error       text,
  -- meta
  is_premium       boolean not null default false,  -- Advanced Roadmaps
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ============================================================
-- TEMPLATES (global NTT DATA library)
-- ============================================================
create table templates (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  icon        text,                       -- emoji or icon name
  is_global   boolean not null default true,  -- false = tenant-private
  tenant_id   uuid references tenants(id) on delete cascade,  -- null if global
  config      jsonb not null,             -- full template config
  -- config shape: { issueTypes, customFields, workflow, hierarchy, schemes }
  tags        text[] default '{}',
  used_count  int not null default 0,
  created_by  text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint global_or_tenant check (
    (is_global = true and tenant_id is null) or
    (is_global = false and tenant_id is not null)
  )
);

-- ============================================================
-- PROJECTS CREATED (audit log per tenant)
-- ============================================================
create table projects_created (
  id                  uuid primary key default uuid_generate_v4(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  jira_connection_id  uuid not null references jira_connections(id),
  template_id         uuid references templates(id),
  -- jira data
  jira_project_key    text not null,
  jira_project_id     text,
  jira_project_name   text not null,
  jira_project_url    text,
  -- what was created (snapshot of the exact payload sent)
  config_snapshot     jsonb not null,
  -- status tracking
  status              text not null default 'pending' check (status in ('pending','in_progress','success','partial','failed')),
  steps_completed     jsonb default '[]',   -- array of completed API steps
  error_details       jsonb,
  -- meta
  created_by          text not null,
  created_at          timestamptz not null default now()
);

-- ============================================================
-- AUTOMATION RULES (roll-up rules per tenant)
-- ============================================================
create table automation_rules (
  id                  uuid primary key default uuid_generate_v4(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  jira_connection_id  uuid not null references jira_connections(id) on delete cascade,
  project_key         text,               -- null = applies to all projects of this connection
  rule_type           text not null check (rule_type in (
    'story_bug_to_epic',      -- all children done → epic done
    'epic_to_initiative',     -- all epics done → initiative done
    'sprint_close_notify'     -- sprint closed with open issues → notify
  )),
  config              jsonb not null default '{}',
  -- jira webhook tracking
  webhook_id          text,               -- ID returned by Jira after registration
  webhook_url         text,               -- our endpoint URL
  webhook_secret      text,               -- HMAC secret for verification
  active              boolean not null default true,
  last_triggered_at   timestamptz,
  trigger_count       int not null default 0,
  last_error          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- AUTOMATION EXECUTION LOG
-- ============================================================
create table automation_logs (
  id              uuid primary key default uuid_generate_v4(),
  rule_id         uuid not null references automation_rules(id) on delete cascade,
  tenant_id       uuid not null,
  -- what triggered
  trigger_issue   text,                   -- Jira issue key
  trigger_event   text,
  -- what happened
  result          text not null check (result in ('rolled_up','skipped','error')),
  details         jsonb,
  duration_ms     int,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_tenant_users_tenant on tenant_users(tenant_id);
create index idx_tenant_users_email on tenant_users(email);
create index idx_jira_connections_tenant on jira_connections(tenant_id);
create index idx_projects_tenant on projects_created(tenant_id);
create index idx_projects_connection on projects_created(jira_connection_id);
create index idx_automation_rules_tenant on automation_rules(tenant_id);
create index idx_automation_rules_connection on automation_rules(jira_connection_id);
create index idx_automation_logs_rule on automation_logs(rule_id);
create index idx_automation_logs_tenant on automation_logs(tenant_id);
create index idx_templates_global on templates(is_global) where is_global = true;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table tenants           enable row level security;
alter table tenant_users      enable row level security;
alter table jira_connections  enable row level security;
alter table projects_created  enable row level security;
alter table automation_rules  enable row level security;
alter table automation_logs   enable row level security;
alter table templates         enable row level security;

-- Service role bypasses RLS (used by Next.js server)
-- Anon role has no access (no public facing API)

-- ============================================================
-- SEED: Global Templates
-- ============================================================
insert into templates (name, description, icon, is_global, config, tags, created_by) values
(
  'Scrum + Advanced Roadmaps',
  'Hierarquia 3 níveis: Iniciativa → Épico → US/Bug com suporte a Advanced Roadmaps (Jira Premium)',
  '🚀',
  true,
  '{
    "hierarchy": {
      "levels": ["Initiative","Epic","Story","Bug","Subtask"],
      "requiresPremium": true
    },
    "issueTypes": [
      {"name":"Initiative","level":3,"color":"#854F0B","icon":"🎯"},
      {"name":"Epic","level":2,"color":"#534AB7","icon":"⚡"},
      {"name":"Story","level":1,"color":"#185FA5","icon":"📝"},
      {"name":"Bug","level":1,"color":"#A32D2D","icon":"🐛"},
      {"name":"Subtask","level":0,"color":"#3B6D11","icon":"✅"}
    ],
    "customFields": [
      {"name":"OKR Key Result","type":"text","required":true,"scope":["Initiative"]},
      {"name":"Story Points","type":"number","required":false,"scope":["Epic","Story","Bug"]},
      {"name":"Squad","type":"select","required":false,"scope":["Epic","Story","Bug"],"options":[]},
      {"name":"Severity","type":"select","required":false,"scope":["Bug"],"options":["Critical","High","Medium","Low"]}
    ],
    "workflow": {
      "statuses": ["Backlog","In Progress","In Review","Done","Blocked"],
      "transitions": [
        {"from":"Backlog","to":"In Progress","name":"Start"},
        {"from":"In Progress","to":"In Review","name":"Review"},
        {"from":"In Review","to":"Done","name":"Approve"},
        {"from":"In Review","to":"In Progress","name":"Reject"},
        {"from":"*","to":"Blocked","name":"Block"},
        {"from":"Blocked","to":"In Progress","name":"Unblock"}
      ]
    },
    "automations": ["story_bug_to_epic","epic_to_initiative"]
  }',
  '{"scrum","roadmaps","premium","hierarchy"}',
  'ntt-data-system'
),
(
  'Kanban simples',
  'Fluxo contínuo sem sprints. Ideal para suporte, operações e times de manutenção.',
  '📋',
  true,
  '{
    "hierarchy": {"levels":["Epic","Story","Bug","Subtask"],"requiresPremium":false},
    "issueTypes": [
      {"name":"Epic","level":2,"color":"#534AB7","icon":"⚡"},
      {"name":"Story","level":1,"color":"#185FA5","icon":"📝"},
      {"name":"Bug","level":1,"color":"#A32D2D","icon":"🐛"},
      {"name":"Subtask","level":0,"color":"#3B6D11","icon":"✅"}
    ],
    "customFields": [
      {"name":"Story Points","type":"number","required":false,"scope":["Story","Bug"]},
      {"name":"Priority","type":"select","required":true,"scope":["Story","Bug"],"options":["Urgent","High","Medium","Low"]}
    ],
    "workflow": {
      "statuses": ["To Do","In Progress","Done"],
      "transitions": [
        {"from":"To Do","to":"In Progress","name":"Start"},
        {"from":"In Progress","to":"Done","name":"Complete"},
        {"from":"In Progress","to":"To Do","name":"Pause"}
      ]
    },
    "automations": []
  }',
  '{"kanban","simple"}',
  'ntt-data-system'
),
(
  'SAFe-lite',
  'Portfolio → Programa → Time. Adaptação leve do SAFe para times ágeis em escala.',
  '⚡',
  true,
  '{
    "hierarchy": {"levels":["Portfolio","Program","Epic","Story","Task"],"requiresPremium":true},
    "issueTypes": [
      {"name":"Portfolio Item","level":3,"color":"#854F0B","icon":"🏛"},
      {"name":"Program Increment","level":2,"color":"#534AB7","icon":"🎯"},
      {"name":"Epic","level":2,"color":"#0F6E56","icon":"⚡"},
      {"name":"Story","level":1,"color":"#185FA5","icon":"📝"},
      {"name":"Task","level":0,"color":"#3B6D11","icon":"✅"}
    ],
    "customFields": [
      {"name":"Business Value","type":"number","required":false,"scope":["Portfolio Item","Epic"]},
      {"name":"WSJF Score","type":"number","required":false,"scope":["Epic","Story"]},
      {"name":"PI Objective","type":"text","required":false,"scope":["Program Increment"]}
    ],
    "workflow": {
      "statuses": ["Funnel","Analysis","Backlog","Implementing","Validating","Done"],
      "transitions": [
        {"from":"Funnel","to":"Analysis","name":"Analyze"},
        {"from":"Analysis","to":"Backlog","name":"Approve"},
        {"from":"Backlog","to":"Implementing","name":"Start"},
        {"from":"Implementing","to":"Validating","name":"Validate"},
        {"from":"Validating","to":"Done","name":"Accept"},
        {"from":"Validating","to":"Implementing","name":"Reject"}
      ]
    },
    "automations": ["story_bug_to_epic","epic_to_initiative"]
  }',
  '{"safe","enterprise","scale","premium"}',
  'ntt-data-system'
);
