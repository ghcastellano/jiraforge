/**
 * @jest-environment node
 */
// ============================================================
// Tests for /api/automations/[id] route (PATCH + DELETE)
// Tests tenant isolation and mass assignment protection
// ============================================================

import { PATCH, DELETE } from './route'
import { NextRequest } from 'next/server'

// ─── Mock Supabase ──────────────────────────────────────────
let mockQueryResult: { data: any; error: any }

function createChain() {
  const chain: any = {
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(() => mockQueryResult),
  }
  return chain
}

let mockChain: any

jest.mock('@/lib/supabase/client', () => ({
  supabaseAdmin: {
    from: jest.fn(() => mockChain),
  },
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockChain = createChain()
  mockQueryResult = {
    data: { id: 'r1', tenant_id: 't1', active: false, rule_type: 'story_bug_to_epic' },
    error: null,
  }
})

// ─── PATCH ──────────────────────────────────────────────────
describe('PATCH /api/automations/[id]', () => {
  it('requires tenant_id in body', async () => {
    const req = new NextRequest('http://localhost/api/automations/r1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    })
    const response = await PATCH(req, { params: { id: 'r1' } })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('tenant_id required')
  })

  it('only allows active, config, project_key fields', async () => {
    const req = new NextRequest('http://localhost/api/automations/r1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: 't1',
        active: false,
        // These should be ignored:
        jira_connection_id: 'HACKED',
        webhook_secret: 'HACKED',
        rule_type: 'HACKED',
      }),
    })
    const response = await PATCH(req, { params: { id: 'r1' } })

    expect(response.status).toBe(200)
    const updateArg = mockChain.update.mock.calls[0][0]
    expect(updateArg.active).toBe(false)
    expect(updateArg.updated_at).toBeDefined()
    expect(updateArg.jira_connection_id).toBeUndefined()
    expect(updateArg.webhook_secret).toBeUndefined()
    expect(updateArg.rule_type).toBeUndefined()
  })
})

// ─── DELETE ─────────────────────────────────────────────────
describe('DELETE /api/automations/[id]', () => {
  it('requires tenant_id query parameter', async () => {
    const req = new NextRequest('http://localhost/api/automations/r1', { method: 'DELETE' })
    const response = await DELETE(req, { params: { id: 'r1' } })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('tenant_id required')
  })

  it('deletes rule with tenant isolation', async () => {
    mockQueryResult = { data: null, error: null }

    const req = new NextRequest('http://localhost/api/automations/r1?tenant_id=t1', { method: 'DELETE' })
    const response = await DELETE(req, { params: { id: 'r1' } })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.deleted).toBe(true)
  })
})
