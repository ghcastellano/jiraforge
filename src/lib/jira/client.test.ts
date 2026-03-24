/**
 * @jest-environment node
 */
// ============================================================
// Tests for JiraClient — Jira API wrapper
// ============================================================

import { JiraClient, FIELD_TYPE_MAP, FIELD_SEARCHER_MAP } from './client'

// ─── Mock global fetch ──────────────────────────────────────
const mockFetch = jest.fn()
global.fetch = mockFetch as any

beforeEach(() => {
  mockFetch.mockReset()
})

function createClient() {
  return new JiraClient('https://test.atlassian.net', {
    type: 'api_token',
    email: 'test@example.com',
    token: 'test-token',
  })
}

function mockOkResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: true,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  })
}

function mockErrorResponse(status: number, errorBody: string) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ errorMessages: [errorBody] }),
    text: () => Promise.resolve(errorBody),
  })
}

// ─── Auth ────────────────────────────────────────────────────
describe('JiraClient auth headers', () => {
  it('sends Basic auth header for api_token credentials', async () => {
    const client = createClient()
    mockFetch.mockReturnValueOnce(mockOkResponse({ accountId: 'abc', displayName: 'Test', emailAddress: 'test@example.com' }))

    await client.getMyself()

    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[0]).toBe('https://test.atlassian.net/rest/api/3/myself')
    const authHeader = callArgs[1].headers['Authorization']
    const expected = `Basic ${Buffer.from('test@example.com:test-token').toString('base64')}`
    expect(authHeader).toBe(expected)
  })

  it('sends Bearer auth header for oauth credentials', async () => {
    const client = new JiraClient('https://test.atlassian.net', {
      type: 'oauth',
      access_token: 'my-access-token',
      refresh_token: 'refresh',
      expires_at: 9999999999,
      cloud_id: 'cloud-123',
    })
    mockFetch.mockReturnValueOnce(mockOkResponse({ accountId: 'abc' }))

    await client.getMyself()

    const authHeader = mockFetch.mock.calls[0][1].headers['Authorization']
    expect(authHeader).toBe('Bearer my-access-token')
  })
})

// ─── Error handling ─────────────────────────────────────────
describe('JiraClient error handling', () => {
  it('throws on non-ok response', async () => {
    const client = createClient()
    mockFetch.mockReturnValueOnce(mockErrorResponse(404, 'Not found'))

    await expect(client.getMyself()).rejects.toThrow('Jira API error 404 on /myself')
  })
})

// ─── getMyself ──────────────────────────────────────────────
describe('getMyself', () => {
  it('returns user data', async () => {
    const client = createClient()
    const userData = { accountId: 'abc123', displayName: 'John Doe', emailAddress: 'john@test.com' }
    mockFetch.mockReturnValueOnce(mockOkResponse(userData))

    const result = await client.getMyself()
    expect(result).toEqual(userData)
  })
})

// ─── createProject ──────────────────────────────────────────
describe('createProject', () => {
  it('sends correct payload', async () => {
    const client = createClient()
    const project = { id: 'p1', key: 'PROJ', name: 'Project', projectTypeKey: 'software', self: '' }
    mockFetch.mockReturnValueOnce(mockOkResponse(project))

    await client.createProject({
      key: 'PROJ',
      name: 'Project',
      projectTypeKey: 'software',
      leadAccountId: 'abc',
    })

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://test.atlassian.net/rest/api/3/project')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toMatchObject({ key: 'PROJ', name: 'Project', leadAccountId: 'abc' })
  })
})

// ─── createWorkflow (new bulk API) ──────────────────────────
describe('createWorkflow (bulk API)', () => {
  it('calls /workflows/create with correct bulk payload structure', async () => {
    const client = createClient()
    const mockResult = {
      workflows: [{ entityId: 'wf-uuid-123', name: 'Test Workflow' }],
    }
    mockFetch.mockReturnValueOnce(mockOkResponse(mockResult))

    const result = await client.createWorkflow({
      name: 'Test Workflow',
      description: 'A test workflow',
      statuses: [
        { name: 'To Do', statusCategory: 'TODO' },
        { name: 'In Progress', statusCategory: 'IN_PROGRESS' },
        { name: 'Done', statusCategory: 'DONE' },
      ],
      transitions: [
        { name: 'Start', from: ['To Do'], to: 'In Progress', type: 'DIRECTED' },
        { name: 'Finish', from: ['In Progress'], to: 'Done', type: 'DIRECTED' },
        { name: 'Reopen', from: [], to: 'To Do', type: 'GLOBAL' },
      ],
    })

    // Verify endpoint
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://test.atlassian.net/rest/api/3/workflows/create')
    expect(opts.method).toBe('POST')

    // Parse and verify bulk payload structure
    const payload = JSON.parse(opts.body)
    expect(payload.scope).toEqual({ type: 'GLOBAL' })
    expect(payload.statuses).toHaveLength(3)
    expect(payload.workflows).toHaveLength(1)
    expect(payload.workflows[0].name).toBe('Test Workflow')
    expect(payload.workflows[0].description).toBe('A test workflow')

    // Verify statuses have UUIDs
    for (const status of payload.statuses) {
      expect(status.statusReference).toBeDefined()
      expect(status.statusReference).toMatch(/^[0-9a-f-]+$/)
      expect(status.name).toBeDefined()
      expect(status.statusCategory).toBeDefined()
    }

    // Verify transitions reference statuses by UUID
    const statusRefMap = Object.fromEntries(payload.statuses.map((s: any) => [s.name, s.statusReference]))
    const transitions = payload.workflows[0].transitions

    // Start: To Do → In Progress
    expect(transitions[0].name).toBe('Start')
    expect(transitions[0].from).toEqual([{ statusReference: statusRefMap['To Do'] }])
    expect(transitions[0].to).toEqual({ statusReference: statusRefMap['In Progress'] })
    expect(transitions[0].type).toBe('directed')

    // Reopen: Global (empty from)
    expect(transitions[2].name).toBe('Reopen')
    expect(transitions[2].from).toEqual([])
    expect(transitions[2].type).toBe('global')

    // Verify return format matches old API shape
    expect(result).toEqual({
      id: { entityId: 'wf-uuid-123' },
      name: 'Test Workflow',
    })
  })

  it('handles empty transitions', async () => {
    const client = createClient()
    mockFetch.mockReturnValueOnce(mockOkResponse({
      workflows: [{ entityId: 'wf-1', name: 'Simple' }],
    }))

    const result = await client.createWorkflow({
      name: 'Simple',
      statuses: [{ name: 'To Do', statusCategory: 'TODO' }],
      transitions: [],
    })

    const payload = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(payload.workflows[0].transitions).toEqual([])
    expect(result.id.entityId).toBe('wf-1')
  })
})

// ─── createWorkflowScheme ───────────────────────────────────
describe('createWorkflowScheme', () => {
  it('sends correct payload', async () => {
    const client = createClient()
    mockFetch.mockReturnValueOnce(mockOkResponse({ id: 1, name: 'Scheme' }))

    await client.createWorkflowScheme({
      name: 'Scheme',
      defaultWorkflow: 'wf-123',
    })

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://test.atlassian.net/rest/api/3/workflowscheme')
    expect(JSON.parse(opts.body)).toEqual({ name: 'Scheme', defaultWorkflow: 'wf-123' })
  })
})

// ─── registerWebhook ────────────────────────────────────────
describe('registerWebhook', () => {
  it('wraps payload in webhooks array', async () => {
    const client = createClient()
    mockFetch.mockReturnValueOnce(mockOkResponse({
      webhookRegistrationResult: [{ createdWebhookId: 42 }],
    }))

    await client.registerWebhook({
      name: 'Test Hook',
      url: 'https://example.com/webhook',
      events: ['jira:issue_updated'],
    })

    const payload = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(payload.webhooks).toHaveLength(1)
    expect(payload.webhooks[0].name).toBe('Test Hook')
  })
})

// ─── FIELD_TYPE_MAP / FIELD_SEARCHER_MAP ────────────────────
describe('field type maps', () => {
  it('has matching keys between type and searcher maps', () => {
    const typeKeys = Object.keys(FIELD_TYPE_MAP).sort()
    const searcherKeys = Object.keys(FIELD_SEARCHER_MAP).sort()
    expect(typeKeys).toEqual(searcherKeys)
  })

  it('contains expected field types', () => {
    expect(FIELD_TYPE_MAP.text).toContain('textfield')
    expect(FIELD_TYPE_MAP.number).toContain('float')
    expect(FIELD_TYPE_MAP.select).toContain('select')
    expect(FIELD_TYPE_MAP.date).toContain('datepicker')
  })
})
