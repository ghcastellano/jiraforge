/**
 * @jest-environment node
 */
// ============================================================
// Tests for /api/projects/deploy route
// ============================================================

import { POST } from './route'
import { NextRequest } from 'next/server'

// ─── Mock deployProject ─────────────────────────────────────
const mockDeployProject = jest.fn()

jest.mock('@/lib/jira/deployer', () => ({
  deployProject: (...args: any[]) => mockDeployProject(...args),
}))

// ─── Mock JiraClient ────────────────────────────────────────
jest.mock('@/lib/jira/client', () => ({
  JiraClient: {
    fromConnection: jest.fn().mockResolvedValue({}),
  },
}))

// ─── Mock Supabase ──────────────────────────────────────────
let mockConnectionResult: { data: any; error: any }
let mockInsertResult: { data: any; error: any }

jest.mock('@/lib/supabase/client', () => ({
  supabaseAdmin: {
    from: jest.fn((table: string) => {
      if (table === 'jira_connections') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(mockConnectionResult),
        }
      }
      if (table === 'projects_created') {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue(mockInsertResult),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        }
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() }
    }),
    rpc: jest.fn().mockResolvedValue({ error: null }),
  },
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockConnectionResult = {
    data: {
      id: 'conn-1',
      tenant_id: 't1',
      jira_base_url: 'https://test.atlassian.net',
      encrypted_creds: 'enc',
      creds_iv: 'iv',
      status: 'active',
    },
    error: null,
  }
  mockInsertResult = {
    data: { id: 'proj-rec-1' },
    error: null,
  }
  mockDeployProject.mockResolvedValue({
    success: true,
    jira_project_id: 'p1',
    jira_project_url: 'https://test.atlassian.net/jira/software/projects/TEST/boards',
    steps: [
      { key: 'project', status: 'done' },
      { key: 'issue_types', status: 'done' },
      { key: 'workflow', status: 'done' },
      { key: 'fields', status: 'done' },
      { key: 'screens', status: 'done' },
      { key: 'schemes', status: 'done' },
    ],
  })
})

function makeDeployRequest(body: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/projects/deploy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: 't1',
      jira_connection_id: 'conn-1',
      project_name: 'Test',
      project_key: 'TEST',
      project_type: 'scrum',
      description: '',
      issueTypes: [],
      customFields: [],
      workflow: { statuses: [], transitions: [] },
      schemes: { screenScheme: 'auto', permissionScheme: 'Default', notificationScheme: 'Default', fieldConfiguration: 'auto' },
      created_by: 'test-user',
      ...body,
    }),
  })
}

describe('POST /api/projects/deploy', () => {
  it('returns 400 when jira_connection_id is missing', async () => {
    const req = makeDeployRequest({ jira_connection_id: '' })
    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('required')
  })

  it('returns 404 when connection not found', async () => {
    mockConnectionResult = { data: null, error: { message: 'Not found' } }

    const req = makeDeployRequest()
    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toBe('Connection not found')
  })

  it('returns 400 when connection is not active', async () => {
    mockConnectionResult.data.status = 'error'

    const req = makeDeployRequest()
    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('not active')
  })

  it('returns 200 on successful deployment', async () => {
    const req = makeDeployRequest()
    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.project_record_id).toBe('proj-rec-1')
    expect(json.data.success).toBe(true)
    expect(json.data.jira_project_id).toBe('p1')
  })

  it('returns 500 on failed deployment', async () => {
    mockDeployProject.mockResolvedValue({
      success: false,
      steps: [{ key: 'project', status: 'error', error: 'Key exists' }],
      error: 'Key exists',
    })

    const req = makeDeployRequest()
    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.data.success).toBe(false)
  })
})
