/**
 * @jest-environment node
 */
// ============================================================
// Tests for /api/templates route (GET + POST)
// ============================================================

import { GET, POST } from './route'
import { NextRequest } from 'next/server'

// ─── Mock Supabase ──────────────────────────────────────────
// The templates GET route builds a query incrementally:
//   query = supabase.from(...).select('*').order(...)
//   query = query.eq(...) or query.or(...)
//   const { data, error } = await query
// So every method must return a chainable + thenable object.
function createQueryChain(finalResult: { data: any; error: any }) {
  const makeThenableChain = (): any => {
    const chain: any = {}
    const methods = ['select', 'eq', 'or', 'order', 'insert', 'single']
    for (const m of methods) {
      chain[m] = jest.fn().mockReturnValue(chain)
    }
    // Make the chain thenable (await-able) so `const { data, error } = await query` works
    chain.then = (resolve: any) => resolve(finalResult)
    // For insert().select().single() chain
    chain.insert.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockReturnValue({
          then: (resolve: any) => resolve(finalResult),
        }),
      }),
    })
    return chain
  }
  return makeThenableChain()
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

// ─── GET /api/templates ─────────────────────────────────────
describe('GET /api/templates', () => {
  it('returns global templates when no tenant_id', async () => {
    const templates = [
      { id: 't1', name: 'Scrum Standard', is_global: true, used_count: 10 },
      { id: 't2', name: 'Kanban Basic', is_global: true, used_count: 5 },
    ]
    mockQueryChain = createQueryChain({ data: templates, error: null })

    const req = new NextRequest('http://localhost/api/templates')
    const response = await GET(req)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data).toEqual(templates)
  })

  it('returns global + tenant templates when tenant_id provided', async () => {
    const templates = [
      { id: 't1', name: 'Scrum Standard', is_global: true, used_count: 10 },
      { id: 't3', name: 'NTT Custom', is_global: false, tenant_id: 'tenant-1', used_count: 2 },
    ]
    mockQueryChain = createQueryChain({ data: templates, error: null })

    const req = new NextRequest('http://localhost/api/templates?tenant_id=tenant-1')
    const response = await GET(req)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data).toEqual(templates)
  })

  it('returns 500 on supabase error', async () => {
    mockQueryChain = createQueryChain({ data: null, error: { message: 'Query failed' } })

    const req = new NextRequest('http://localhost/api/templates')
    const response = await GET(req)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('Query failed')
  })
})

// ─── POST /api/templates ────────────────────────────────────
describe('POST /api/templates', () => {
  it('creates new template', async () => {
    const created = {
      id: 't4',
      name: 'Custom Scrum',
      description: 'Custom scrum template',
      icon: '🏃',
      is_global: false,
      tenant_id: 'tenant-1',
      config: { hierarchy: { levels: ['Epic', 'Story'], requiresPremium: false } },
      tags: ['scrum', 'custom'],
      used_count: 0,
      created_by: 'ntt-operator',
    }
    mockQueryChain = createQueryChain({ data: created, error: null })

    const req = new NextRequest('http://localhost/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Custom Scrum',
        description: 'Custom scrum template',
        icon: '🏃',
        is_global: false,
        tenant_id: 'tenant-1',
        config: { hierarchy: { levels: ['Epic', 'Story'], requiresPremium: false } },
        tags: ['scrum', 'custom'],
        created_by: 'ntt-operator',
      }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.data).toEqual(created)
  })

  it('uses defaults for optional fields', async () => {
    const created = {
      id: 't5',
      name: 'Minimal',
      icon: '📋',
      is_global: false,
      tags: [],
      created_by: 'ntt-operator',
    }
    mockQueryChain = createQueryChain({ data: created, error: null })

    const req = new NextRequest('http://localhost/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Minimal',
        config: {},
      }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.data.icon).toBe('📋')
    expect(json.data.created_by).toBe('ntt-operator')
  })

  it('returns 500 on supabase insert error', async () => {
    mockQueryChain = createQueryChain({
      data: null,
      error: { message: 'Insert failed: name cannot be null' },
    })

    const req = new NextRequest('http://localhost/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: null, config: {} }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toContain('Insert failed')
  })
})
