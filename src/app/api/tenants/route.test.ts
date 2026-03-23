/**
 * @jest-environment node
 */
// ============================================================
// Tests for /api/tenants route (GET + POST)
// ============================================================

import { GET, POST } from './route'
import { NextRequest } from 'next/server'

// ─── Mock Supabase ──────────────────────────────────────────
const mockSelect = jest.fn()
const mockEq = jest.fn()
const mockOrder = jest.fn()
const mockInsert = jest.fn()
const mockSingle = jest.fn()

// Chain builder for query
function createQueryChain(finalResult: { data: any; error: any }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue(finalResult),
    insert: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(finalResult),
  }
  // For insert chains: insert().select().single()
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
    from: jest.fn((table: string) => mockQueryChain),
  },
}))

beforeEach(() => {
  jest.clearAllMocks()
})

// ─── GET /api/tenants ───────────────────────────────────────
describe('GET /api/tenants', () => {
  it('returns tenants with counts', async () => {
    const tenants = [
      { id: '1', name: 'Acme Corp', slug: 'acme', active: true, connections_count: 2, projects_count: 5 },
      { id: '2', name: 'NTT DATA', slug: 'ntt', active: true, connections_count: 1, projects_count: 3 },
    ]

    mockQueryChain = createQueryChain({ data: tenants, error: null })

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data).toEqual(tenants)
  })

  it('returns 500 on supabase error', async () => {
    mockQueryChain = createQueryChain({ data: null, error: { message: 'DB connection failed' } })

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('DB connection failed')
  })
})

// ─── POST /api/tenants ──────────────────────────────────────
describe('POST /api/tenants', () => {
  it('creates tenant with valid data', async () => {
    const newTenant = { id: '3', name: 'New Corp', slug: 'new-corp', active: true }
    mockQueryChain = createQueryChain({ data: newTenant, error: null })

    const req = new NextRequest('http://localhost/api/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Corp', slug: 'New Corp' }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.data).toEqual(newTenant)
  })

  it('rejects missing name', async () => {
    const req = new NextRequest('http://localhost/api/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'no-name' }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('name and slug are required')
  })

  it('rejects missing slug', async () => {
    const req = new NextRequest('http://localhost/api/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Has Name' }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('name and slug are required')
  })

  it('rejects duplicate slug (supabase unique constraint)', async () => {
    mockQueryChain = createQueryChain({
      data: null,
      error: { message: 'duplicate key value violates unique constraint "tenants_slug_key"' },
    })

    const req = new NextRequest('http://localhost/api/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Dup', slug: 'existing-slug' }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toContain('duplicate key')
  })
})
