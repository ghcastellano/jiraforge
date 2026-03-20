// ============================================================
// JiraForge · Jira API Client (multi-tenant)
// Server-side only
// ============================================================

import { decryptJiraCredentials, type JiraCredentials } from '@/lib/crypto/credentials'
import type { JiraConnection, JiraProject, JiraIssueType, JiraField } from '@/types'

export class JiraClient {
  private baseUrl: string
  private credentials: JiraCredentials

  constructor(baseUrl: string, credentials: JiraCredentials) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.credentials = credentials
  }

  static async fromConnection(connection: JiraConnection & { encrypted_creds: string; creds_iv: string }): Promise<JiraClient> {
    const credentials = await decryptJiraCredentials(connection.encrypted_creds, connection.creds_iv)
    return new JiraClient(connection.jira_base_url, credentials)
  }

  private getAuthHeader(): string {
    if (this.credentials.type === 'api_token') {
      const encoded = Buffer.from(`${this.credentials.email}:${this.credentials.token}`).toString('base64')
      return `Basic ${encoded}`
    }
    return `Bearer ${this.credentials.access_token}`
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/rest/api/3${path}`
    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    })

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`Jira API error ${res.status} on ${path}: ${error}`)
    }

    return res.json() as Promise<T>
  }

  // ─── Connection health ──────────────────────────────────
  async getMyself(): Promise<{ accountId: string; displayName: string; emailAddress: string }> {
    return this.request('/myself')
  }

  async getCloudId(): Promise<string> {
    // accessible.atlassian.com returns the cloud IDs for the token
    const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: { Authorization: this.getAuthHeader(), Accept: 'application/json' }
    })
    const resources = await res.json() as { id: string; url: string; name: string }[]
    const match = resources.find(r => this.baseUrl.includes(r.url.replace('https://', '')))
    return match?.id ?? ''
  }

  // ─── Projects ───────────────────────────────────────────
  async createProject(payload: {
    key: string
    name: string
    projectTypeKey: 'software' | 'service_desk' | 'business'
    projectTemplateKey?: string
    description?: string
    leadAccountId: string
    assigneeType?: 'PROJECT_LEAD' | 'UNASSIGNED'
  }): Promise<JiraProject> {
    return this.request('/project', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async getProject(keyOrId: string): Promise<JiraProject> {
    return this.request(`/project/${keyOrId}`)
  }

  // ─── Issue Types ────────────────────────────────────────
  async createIssueType(payload: {
    name: string
    description?: string
    type?: 'standard' | 'subtask'
    hierarchyLevel?: number
  }): Promise<JiraIssueType> {
    return this.request('/issuetype', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async getIssueTypesForProject(projectId: string): Promise<JiraIssueType[]> {
    return this.request(`/issuetype/project?projectId=${projectId}`)
  }

  async addIssueTypeToProject(projectId: string, issueTypeId: string): Promise<void> {
    await this.request(`/project/${projectId}/issuetypes`, {
      method: 'PUT',
      body: JSON.stringify({ issueTypeIds: [issueTypeId] }),
    })
  }

  // ─── Custom Fields ──────────────────────────────────────
  async createCustomField(payload: {
    name: string
    description?: string
    type: string       // e.g. 'com.atlassian.jira.plugin.system.customfieldtypes:textfield'
    searcherKey?: string
  }): Promise<JiraField> {
    return this.request('/field', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async getAllFields(): Promise<JiraField[]> {
    return this.request('/field')
  }

  async createFieldContext(fieldId: string, payload: {
    name: string
    projectIds?: string[]
    issueTypeIds?: string[]
  }): Promise<{ id: string; name: string }> {
    return this.request(`/field/${fieldId}/context`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async addSelectFieldOptions(fieldId: string, contextId: string, options: string[]): Promise<void> {
    await this.request(`/field/${fieldId}/context/${contextId}/option`, {
      method: 'POST',
      body: JSON.stringify({ options: options.map(o => ({ value: o })) }),
    })
  }

  // ─── Workflows ──────────────────────────────────────────
  async createWorkflow(payload: {
    name: string
    description?: string
    statuses: {
      name: string
      statusCategory: 'TODO' | 'IN_PROGRESS' | 'DONE'
    }[]
    transitions: {
      name: string
      from: string[]
      to: string
      type: 'INITIAL' | 'DIRECTED' | 'GLOBAL'
    }[]
  }): Promise<{ id: { entityId: string }; name: string }> {
    return this.request('/workflow/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  // ─── Workflow Schemes ───────────────────────────────────
  async createWorkflowScheme(payload: {
    name: string
    description?: string
    defaultWorkflow?: string
    issueTypeMappings?: Record<string, string>
  }): Promise<{ id: number; name: string }> {
    return this.request('/workflowscheme', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async assignWorkflowSchemeToProject(projectId: string, workflowSchemeId: number): Promise<void> {
    await this.request(`/project/${projectId}/workflowscheme`, {
      method: 'PUT',
      body: JSON.stringify({ workflowSchemeId }),
    })
  }

  // ─── Screens ────────────────────────────────────────────
  async createScreen(name: string): Promise<{ id: number; name: string }> {
    return this.request('/screens', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  }

  async addFieldToScreen(screenId: number, tabId: number, fieldId: string): Promise<void> {
    await this.request(`/screens/${screenId}/tabs/${tabId}/fields`, {
      method: 'POST',
      body: JSON.stringify({ fieldId }),
    })
  }

  async createScreenScheme(payload: {
    name: string
    screens: { default: number; create?: number; edit?: number; view?: number }
  }): Promise<{ id: number }> {
    return this.request('/screenscheme', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async createIssueTypeScreenScheme(payload: {
    name: string
    issueTypeMappings: { issueTypeId: string; screenSchemeId: string }[]
  }): Promise<{ id: string }> {
    return this.request('/issuetypescreenscheme', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  // ─── Webhooks ───────────────────────────────────────────
  async registerWebhook(payload: {
    name: string
    url: string
    events: string[]
    filters?: { 'issue-related-events-section'?: string }
    excludeBody?: boolean
  }): Promise<{ webhookRegistrationResult: { createdWebhookId: number }[] }> {
    return this.request('/webhook', {
      method: 'POST',
      body: JSON.stringify({ webhooks: [payload] }),
    })
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    await this.request('/webhook', {
      method: 'DELETE',
      body: JSON.stringify({ webhookIds: [parseInt(webhookId)] }),
    })
  }

  // ─── Permissions ────────────────────────────────────────
  async getPermissionSchemes(): Promise<{ permissionSchemes: { id: number; name: string }[] }> {
    return this.request('/permissionscheme')
  }

  async assignPermissionScheme(projectKey: string, permissionSchemeId: number): Promise<void> {
    await this.request(`/project/${projectKey}/permissionscheme`, {
      method: 'PUT',
      body: JSON.stringify({ id: permissionSchemeId }),
    })
  }
}

// ─── Field type mapping ────────────────────────────────────
export const FIELD_TYPE_MAP: Record<string, string> = {
  text:        'com.atlassian.jira.plugin.system.customfieldtypes:textfield',
  textarea:    'com.atlassian.jira.plugin.system.customfieldtypes:textarea',
  number:      'com.atlassian.jira.plugin.system.customfieldtypes:float',
  select:      'com.atlassian.jira.plugin.system.customfieldtypes:select',
  multiselect: 'com.atlassian.jira.plugin.system.customfieldtypes:multiselect',
  date:        'com.atlassian.jira.plugin.system.customfieldtypes:datepicker',
  user:        'com.atlassian.jira.plugin.system.customfieldtypes:userpicker',
}

export const FIELD_SEARCHER_MAP: Record<string, string> = {
  text:        'com.atlassian.jira.plugin.system.customfieldtypes:textsearcher',
  textarea:    'com.atlassian.jira.plugin.system.customfieldtypes:textsearcher',
  number:      'com.atlassian.jira.plugin.system.customfieldtypes:exactnumber',
  select:      'com.atlassian.jira.plugin.system.customfieldtypes:multiselectsearcher',
  multiselect: 'com.atlassian.jira.plugin.system.customfieldtypes:multiselectsearcher',
  date:        'com.atlassian.jira.plugin.system.customfieldtypes:daterange',
  user:        'com.atlassian.jira.plugin.system.customfieldtypes:userpickergroupsearcher',
}
