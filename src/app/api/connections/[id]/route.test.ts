/**
 * @jest-environment node
 */
// ============================================================
// Tests for /api/connections/[id] route (DELETE + PATCH)
// Tests tenant isolation and mass assignment protection
// ============================================================

import { DELETE, PATCH } from './route'
import { NextRequest } from 'next/server'

// ─── Mock Supabase ──────────────────────────────────────────
const mockUpdate = jest.fn()
const mockDelete = jest.fn()
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
    data: { id: 'conn-1', tenant_id: 't1', name: 'Updated', status: 'active' },
    error: null,
  }
})

// ─── DELETE ─────────────────────────────────────────────────
describe('DELETE /api/connections/[id]', () => {
  it('requires tenant_id query parameter', async () => {
    const req = new NextRequest('http://localhost/api/connections/conn-1', { method: 'DELETE' })
    const response = await DELETE(req, { params: { id: 'conn-1' } })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('tenant_id required')
  })

  it('deletes connection with tenant isolation', async () => {
    const req = new NextRequest('http://localhost/api/connections/conn-1?tenant_id=t1', { method: 'DELETE' })
    const response = await DELETE(req, { params: { id: 'conn-1' } })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.deleted).toBe(true)
    // Verify .eq is called (for both id and tenant_id filters)
    expect(mockChain.eq).toHaveBeenCalled()
  })
})

// ─── PATCH ──────────────────────────────────────────────────
describe('PATCH /api/connections/[id]', () => {
  it('requires tenant_id in body', async () => {
    const req = new NextRequest('http://localhost/api/connections/conn-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    })
    const response = await PATCH(req, { params: { id: 'conn-1' } })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('tenant_id required')
  })

  it('updates only allowed fields (name, jira_base_url, is_premium, status)', async () => {
    const req = new NextRequest('http://localhost/api/connections/conn-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: 't1',
        name: 'New Name',
        jira_base_url: 'https://new.atlassian.net',
        // These should be IGNORED (mass assignment protection):
        encrypted_creds: 'HACKED',
        creds_iv: 'HACKED',
        auth_type: 'oauth',
      }),
    })
    const response = await PATCH(req, { params: { id: 'conn-1' } })

    expect(response.status).toBe(200)
    // Verify that update was called — the first call to the chain should include only allowed fields
    expect(mockChain.update).toHaveBeenCalled()
    const updateArg = mockChain.update.mock.calls[0][0]
    expect(updateArg.name).toBe('New Name')
    expect(updateArg.jira_base_url).toBe('https://new.atlassian.net')
    expect(updateArg.updated_at).toBeDefined()
    // Disallowed fields should NOT be present
    expect(updateArg.encrypted_creds).toBeUndefined()
    expect(updateArg.creds_iv).toBeUndefined()
    expect(updateArg.auth_type).toBeUndefined()
  })
})
