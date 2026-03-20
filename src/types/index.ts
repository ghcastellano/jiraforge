// ============================================================
// JiraForge · NTT DATA · Core Types
// ============================================================

export type UserRole = 'admin' | 'operator' | 'viewer'
export type AuthType = 'oauth' | 'api_token'
export type ConnectionStatus = 'pending' | 'active' | 'error' | 'expired'
export type ProjectStatus = 'pending' | 'in_progress' | 'success' | 'partial' | 'failed'
export type RuleType = 'story_bug_to_epic' | 'epic_to_initiative' | 'sprint_close_notify'
export type AutomationResult = 'rolled_up' | 'skipped' | 'error'

// ─── Tenant ───────────────────────────────────────────────
export interface Tenant {
  id: string
  name: string
  slug: string
  description?: string
  logo_url?: string
  active: boolean
  created_at: string
  updated_at: string
  // computed / joined
  connections_count?: number
  projects_count?: number
  active_rules_count?: number
}

export interface TenantUser {
  id: string
  tenant_id: string
  email: string
  name: string
  role: UserRole
  active: boolean
  created_at: string
}

// ─── Jira Connection ──────────────────────────────────────
export interface JiraConnection {
  id: string
  tenant_id: string
  name: string
  jira_base_url: string
  jira_cloud_id?: string
  auth_type: AuthType
  // credentials never returned to frontend
  oauth_scope?: string
  token_expires_at?: string
  status: ConnectionStatus
  last_checked_at?: string
  last_error?: string
  is_premium: boolean
  created_at: string
  updated_at: string
  // joined
  tenant?: Pick<Tenant, 'id' | 'name' | 'slug'>
}

export interface CreateConnectionInput {
  tenant_id: string
  name: string
  jira_base_url: string
  auth_type: AuthType
  // for api_token
  api_token?: string
  jira_email?: string
  // for oauth — handled via redirect flow
}

// ─── Templates ────────────────────────────────────────────
export interface IssueTypeConfig {
  name: string
  level: number
  color: string
  icon: string
}

export interface CustomFieldConfig {
  name: string
  type: 'text' | 'number' | 'select' | 'date' | 'user' | 'multiselect' | 'textarea'
  required: boolean
  scope: string[]
  options?: string[]
  description?: string
}

export interface WorkflowStatus {
  name: string
  category: 'TODO' | 'IN_PROGRESS' | 'DONE'
  color?: string
}

export interface WorkflowTransition {
  from: string     // status name or '*' for any
  to: string
  name: string
  conditions?: string[]
}

export interface HierarchyConfig {
  levels: string[]
  requiresPremium: boolean
}

export interface TemplateConfig {
  hierarchy: HierarchyConfig
  issueTypes: IssueTypeConfig[]
  customFields: CustomFieldConfig[]
  workflow: {
    statuses: string[]
    transitions: WorkflowTransition[]
  }
  automations: RuleType[]
  schemes?: {
    permissionScheme?: 'default' | 'custom'
    notificationScheme?: 'default' | 'custom'
  }
}

export interface Template {
  id: string
  name: string
  description?: string
  icon?: string
  is_global: boolean
  tenant_id?: string
  config: TemplateConfig
  tags: string[]
  used_count: number
  created_by: string
  created_at: string
  updated_at: string
}

// ─── Project Builder ──────────────────────────────────────
export interface ProjectBuilderState {
  // step 1
  template_id?: string
  template?: Template
  // step 2
  project_name: string
  project_key: string
  project_type: 'scrum' | 'kanban'
  description: string
  // step 3 - issue types (starts from template, editable)
  issueTypes: IssueTypeConfig[]
  // step 4 - custom fields (starts from template, editable)
  customFields: CustomFieldConfig[]
  // step 5 - workflow (starts from template, editable)
  workflow: {
    statuses: WorkflowStatus[]
    transitions: WorkflowTransition[]
  }
  // step 6 - schemes
  schemes: {
    screenScheme: 'auto' | 'existing'
    permissionScheme: string
    notificationScheme: string
    fieldConfiguration: 'auto' | 'custom'
  }
  // meta
  jira_connection_id: string
  tenant_id: string
}

// ─── Projects Created ─────────────────────────────────────
export interface ProjectCreated {
  id: string
  tenant_id: string
  jira_connection_id: string
  template_id?: string
  jira_project_key: string
  jira_project_id?: string
  jira_project_name: string
  jira_project_url?: string
  config_snapshot: TemplateConfig & { project_name: string; project_key: string }
  status: ProjectStatus
  steps_completed: string[]
  error_details?: Record<string, unknown>
  created_by: string
  created_at: string
  // joined
  connection?: Pick<JiraConnection, 'id' | 'name' | 'jira_base_url'>
  template?: Pick<Template, 'id' | 'name' | 'icon'>
}

// ─── Automation Rules ─────────────────────────────────────
export interface AutomationRule {
  id: string
  tenant_id: string
  jira_connection_id: string
  project_key?: string
  rule_type: RuleType
  config: Record<string, unknown>
  webhook_id?: string
  webhook_url?: string
  active: boolean
  last_triggered_at?: string
  trigger_count: number
  last_error?: string
  created_at: string
  updated_at: string
  // joined
  connection?: Pick<JiraConnection, 'id' | 'name' | 'jira_base_url'>
}

export interface AutomationLog {
  id: string
  rule_id: string
  tenant_id: string
  trigger_issue?: string
  trigger_event?: string
  result: AutomationResult
  details?: Record<string, unknown>
  duration_ms?: number
  created_at: string
}

// ─── API Responses ────────────────────────────────────────
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// ─── Jira API types ───────────────────────────────────────
export interface JiraProject {
  id: string
  key: string
  name: string
  projectTypeKey: string
  self: string
}

export interface JiraIssueType {
  id: string
  name: string
  description: string
  subtask: boolean
  hierarchyLevel: number
}

export interface JiraWorkflow {
  id: string
  name: string
  statuses: { id: string; name: string }[]
}

export interface JiraField {
  id: string
  name: string
  custom: boolean
  schema?: { type: string; custom?: string }
}
