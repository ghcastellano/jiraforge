/**
 * @jest-environment node
 */
// ============================================================
// Tests for /api/automations route (GET + POST)
// ============================================================

import { NextRequest } from 'next/server'

// ─── Mock JiraClient ────────────────────────────────────────
let mockRegisterWebhook: jest.Mock

jest.mock('@/lib/jira/client', () => ({
  JiraClient: {
    fromConnection: jest.fn().mockImplementation(async () => ({
      registerWebhook: (...args: any[]) => mockRegisterWebhook(...args),
    })),
  },
}))

// ─── Mock Supabase ──────────────────────────────────────────
let mockFromBehavior: Record<string, any> = {}

const makeChain = (result: any) => {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue(result),
    single: jest.fn().mockResolvedValue(result),
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue(result),
      }),
    }),
    update: jest.fn().mockReturnThis(),
  }
  return chain
}

jest.mock('@/lib/supabase/client', () => ({
  supabaseAdmin: {
    from: jest.fn((table: string) => {
      if (mockFromBehavior[table]) return makeChain(mockFromBehavior[table])
      return makeChain({ data: [], error: null })
    }),
  },
}))

// Import AFTER mocks are set up
import { GET, POST } from './route'

beforeEach(() => {
  jest.clearAllMocks()
  mockFromBehavior = {}
  mockRegisterWebhook = jest.fn().mockResolvedValue({
    webhookRegistrationResult: [{ createdWebhookId: 42 }],
  })
})

// ─── GET /api/automations ───────────────────────────────────
describe('GET /api/automations', () => {
  it('returns automation rules', async () => {
    const rules = [
      { id: 'r1', rule_type: 'story_bug_to_epic', active: true },
    ]
    mockFromBehavior['automation_rules'] = { data: rules, error: null }

    const req = new NextRequest('http://localhost/api/automations')
    const response = await GET(req)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data).toEqual(rules)
  })
})

// ─── POST /api/automations ──────────────────────────────────
describe('POST /api/automations', () => {
  it('returns 400 when required fields are missing', async () => {
    const req = new NextRequest('http://localhost/api/automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: 't1' }), // missing jira_connection_id and rule_type
    })
    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('required')
  })

  it('returns 404 when connection not found', async () => {
    mockFromBehavior['jira_connections'] = { data: null, error: null }

    const req = new NextRequest('http://localhost/api/automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: 't1',
        jira_connection_id: 'invalid',
        rule_type: 'story_bug_to_epic',
      }),
    })
    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toBe('Connection not found')
  })
})
