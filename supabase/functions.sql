-- ============================================================
-- JiraForge · Supabase Functions & Policies
-- Run this AFTER schema.sql
-- ============================================================

-- ── RPC: increment template usage ─────────────────────────
create or replace function increment_template_usage(template_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update templates
  set used_count = used_count + 1,
      updated_at = now()
  where id = template_id;
end;
$$;

-- ── RLS Policies ───────────────────────────────────────────
-- Service role (used by Next.js server) bypasses RLS automatically.
-- These policies allow service role full access.

-- tenants
create policy "service_role_all_tenants"
  on tenants for all
  using (true)
  with check (true);

-- tenant_users
create policy "service_role_all_tenant_users"
  on tenant_users for all
  using (true)
  with check (true);

-- jira_connections
create policy "service_role_all_connections"
  on jira_connections for all
  using (true)
  with check (true);

-- templates
create policy "service_role_all_templates"
  on templates for all
  using (true)
  with check (true);

-- projects_created
create policy "service_role_all_projects"
  on projects_created for all
  using (true)
  with check (true);

-- automation_rules
create policy "service_role_all_automation_rules"
  on automation_rules for all
  using (true)
  with check (true);

-- automation_logs
create policy "service_role_all_automation_logs"
  on automation_logs for all
  using (true)
  with check (true);

-- ── Trigger: updated_at auto-update ───────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_updated_at
  before update on tenants
  for each row execute function set_updated_at();

create trigger connections_updated_at
  before update on jira_connections
  for each row execute function set_updated_at();

create trigger templates_updated_at
  before update on templates
  for each row execute function set_updated_at();

create trigger automation_rules_updated_at
  before update on automation_rules
  for each row execute function set_updated_at();
