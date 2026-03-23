/**
 * @jest-environment node
 */
// ============================================================
// Tests for /api/connections route (GET + POST)
// ============================================================

import { GET, POST } from './route'
import { NextRequest } from 'next/server'

// ─── Mock crypto module ─────────────────────────────────────
jest.mock('@/lib/crypto/credentials', () => ({
  encryptJiraCredentials: jest.fn().mockResolvedValue({
    encrypted: 'mock-encrypted-data',
    iv: 'mock-iv-data',
  }),
}))

// ─── Mock Supabase ──────────────────────────────────────────
function createQueryChain(finalResult: { data: any; error: any }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue(finalResult),
    insert: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(finalResult),
  }
  chain.insert.mockReturnValue({
    select: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue(finalResult),
    }),
  })
  return chain
}

let mockQueryChain: any

jest.mock('@/lib/supabase/client', () => ({
  supabaseAdmin: {
    from: jest.fn(() => mockQueryChain),
  },
}))

beforeEach(() => {
  jest.clearAllMocks()
})

// ─── GET /api/connections ───────────────────────────────────
describe('GET /api/connections', () => {
  it('returns connections for tenant', async () => {
    const connections = [
      { id: 'c1', tenant_id: 't1', name: 'Jira Cloud', status: 'active', auth_type: 'api_token' },
    ]
    mockQueryChain = createQueryChain({ data: connections, error: null })

    const req = new NextRequest('http://localhost/api/connections?tenant_id=t1')
    const response = await GET(req)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data).toEqual(connections)
  })

  it('returns 400 when tenant_id is missing', async () => {
    const req = new NextRequest('http://localhost/api/connections')
    const response = await GET(req)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('tenant_id required')
  })

  it('returns 500 on supabase error', async () => {
    mockQueryChain = createQueryChain({ data: null, error: { message: 'DB error' } })

    const req = new NextRequest('http://localhost/api/connections?tenant_id=t1')
    const response = await GET(req)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ─── POST /api/connections ──────────────────────────────────
describe('POST /api/connections', () => {
  it('creates connection with encrypted credentials', async () => {
    const newConnection = {
      id: 'c2',
      tenant_id: 't1',
      name: 'New Jira',
      jira_base_url: 'https://ntt.atlassian.net',
      auth_type: 'api_token',
      status: 'pending',
    }
    mockQueryChain = createQueryChain({ data: newConnection, error: null })

    const req = new NextRequest('http://localhost/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: 't1',
        name: 'New Jira',
        jira_base_url: 'https://ntt.atlassian.net/',
        auth_type: 'api_token',
        api_token: 'ATATT3xF...',
        jira_email: 'user@ntt.com',
      }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.data).toEqual(newConnection)

    const { encryptJiraCredentials } = require('@/lib/crypto/credentials')
    expect(encryptJiraCredentials).toHaveBeenCalledWith({
      type: 'api_token',
      email: 'user@ntt.com',
      token: 'ATATT3xF...',
    })
  })

  it('validates required fields - missing tenant_id', async () => {
    const req = new NextRequest('http://localhost/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Jira',
        jira_base_url: 'https://x.atlassian.net',
        auth_type: 'api_token',
      }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Missing required fields')
  })

  it('validates required fields - missing name', async () => {
    const req = new NextRequest('http://localhost/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: 't1',
        jira_base_url: 'https://x.atlassian.net',
        auth_type: 'api_token',
      }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Missing required fields')
  })

  it('requires api_token and jira_email for api_token auth', async () => {
    const req = new NextRequest('http://localhost/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: 't1',
        name: 'Jira',
        jira_base_url: 'https://x.atlassian.net',
        auth_type: 'api_token',
        // missing api_token and jira_email
      }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('api_token and jira_email required for api_token auth')
  })

  it('rejects oauth auth type (must use separate flow)', async () => {
    const req = new NextRequest('http://localhost/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: 't1',
        name: 'OAuth Jira',
        jira_base_url: 'https://x.atlassian.net',
        auth_type: 'oauth',
      }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('OAuth flow')
  })
})
