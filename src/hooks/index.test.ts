// ============================================================
// Tests for custom React hooks (useTenants, useConnections, useTemplates)
// ============================================================

import { renderHook, act, waitFor } from '@testing-library/react'
import { useTenants, useConnections, useTemplates } from './index'

// ─── Mock global fetch ──────────────────────────────────────
const mockFetch = jest.fn()
global.fetch = mockFetch as any

beforeEach(() => {
  mockFetch.mockReset()
})

// ─── Helpers ────────────────────────────────────────────────
function mockFetchResponse(data: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(ok ? { data } : { error: 'Error' }),
  })
}

// ─── useTenants ─────────────────────────────────────────────
describe('useTenants', () => {
  it('loads tenants on mount', async () => {
    const tenants = [
      { id: '1', name: 'Tenant A', slug: 'tenant-a', active: true },
      { id: '2', name: 'Tenant B', slug: 'tenant-b', active: true },
    ]
    mockFetch.mockReturnValueOnce(mockFetchResponse(tenants))

    const { result } = renderHook(() => useTenants())

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.tenants).toEqual(tenants)
    expect(result.current.error).toBeNull()
    expect(mockFetch).toHaveBeenCalledWith('/api/tenants')
  })

  it('sets error on fetch failure', async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })
    )

    const { result } = renderHook(() => useTenants())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('HTTP 500')
    expect(result.current.tenants).toEqual([])
  })

  it('createTenant calls API and updates state', async () => {
    const existingTenants = [{ id: '1', name: 'Existing', slug: 'existing', active: true }]
    mockFetch.mockReturnValueOnce(mockFetchResponse(existingTenants))

    const { result } = renderHook(() => useTenants())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const newTenant = { id: '2', name: 'New Tenant', slug: 'new-tenant', active: true }
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ data: newTenant }),
      })
    )

    let created: any
    await act(async () => {
      created = await result.current.createTenant({ name: 'New Tenant', slug: 'new-tenant' })
    })

    expect(created).toEqual(newTenant)
    expect(result.current.tenants).toHaveLength(2)
    expect(result.current.tenants[1]).toEqual(newTenant)
    expect(mockFetch).toHaveBeenCalledWith('/api/tenants', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'New Tenant', slug: 'new-tenant' }),
    }))
  })
})

// ─── useConnections ─────────────────────────────────────────
describe('useConnections', () => {
  it('loads connections when tenantId changes', async () => {
    const connections = [
      { id: 'c1', tenant_id: 't1', name: 'Jira Cloud', status: 'active' },
    ]
    mockFetch.mockReturnValueOnce(mockFetchResponse(connections))

    const { result } = renderHook(() => useConnections('t1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.connections).toEqual(connections)
    expect(mockFetch).toHaveBeenCalledWith('/api/connections?tenant_id=t1')
  })

  it('does not load when tenantId is null', async () => {
    const { result } = renderHook(() => useConnections(null))

    // Should not be loading since tenantId is null
    expect(result.current.loading).toBe(false)
    expect(result.current.connections).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('checkConnection calls correct endpoint and updates state', async () => {
    const connections = [
      { id: 'c1', tenant_id: 't1', name: 'Conn 1', status: 'pending' },
    ]
    mockFetch.mockReturnValueOnce(mockFetchResponse(connections))

    const { result } = renderHook(() => useConnections('t1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { status: 'active' } }),
      })
    )

    await act(async () => {
      await result.current.checkConnection('c1')
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/connections/c1/check', { method: 'POST' })
    expect(result.current.connections[0].status).toBe('active')
  })

  it('deleteConnection removes from state', async () => {
    const connections = [
      { id: 'c1', tenant_id: 't1', name: 'Conn 1', status: 'active' },
      { id: 'c2', tenant_id: 't1', name: 'Conn 2', status: 'active' },
    ]
    mockFetch.mockReturnValueOnce(mockFetchResponse(connections))

    const { result } = renderHook(() => useConnections('t1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    mockFetch.mockReturnValueOnce(
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) })
    )

    await act(async () => {
      await result.current.deleteConnection('c1')
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/connections/c1?tenant_id=t1', { method: 'DELETE' })
    expect(result.current.connections).toHaveLength(1)
    expect(result.current.connections[0].id).toBe('c2')
  })
})

// ─── useTemplates ───────────────────────────────────────────
describe('useTemplates', () => {
  it('loads templates on mount', async () => {
    const templates = [
      { id: 't1', name: 'Scrum Template', is_global: true, used_count: 5 },
      { id: 't2', name: 'Kanban Template', is_global: true, used_count: 3 },
    ]
    mockFetch.mockReturnValueOnce(mockFetchResponse(templates))

    const { result } = renderHook(() => useTemplates())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.templates).toEqual(templates)
    expect(mockFetch).toHaveBeenCalledWith('/api/templates')
  })

  it('createTemplate calls API and updates state', async () => {
    mockFetch.mockReturnValueOnce(mockFetchResponse([]))

    const { result } = renderHook(() => useTemplates())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const newTemplate = {
      id: 't3',
      name: 'Custom Template',
      is_global: false,
      used_count: 0,
    }
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ data: newTemplate }),
      })
    )

    const payload = {
      name: 'Custom Template',
      is_global: false,
      tags: ['custom'],
      created_by: 'test-user',
      config: {
        hierarchy: { levels: ['Epic', 'Story'], requiresPremium: false },
        issueTypes: [],
        customFields: [],
        workflow: { statuses: ['To Do', 'Done'], transitions: [] },
        automations: [],
      } as any,
    }

    await act(async () => {
      await result.current.createTemplate(payload)
    })

    expect(result.current.templates).toHaveLength(1)
    expect(result.current.templates[0]).toEqual(newTemplate)
    expect(mockFetch).toHaveBeenCalledWith('/api/templates', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(payload),
    }))
  })
})
