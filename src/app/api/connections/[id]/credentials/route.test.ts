/**
 * @jest-environment node
 */
// ============================================================
// Tests for /api/connections/[id]/credentials route
// Security-critical: verifies internal API key authentication
// ============================================================

import { GET } from './route'
import { NextRequest } from 'next/server'

// ─── Mock crypto ────────────────────────────────────────────
jest.mock('@/lib/crypto/credentials', () => ({
  decryptJiraCredentials: jest.fn().mockResolvedValue({
    type: 'api_token',
    email: 'user@test.com',
    token: 'secret-token',
  }),
}))

// ─── Mock Supabase ──────────────────────────────────────────
let mockQueryResult: { data: any; error: any }

jest.mock('@/lib/supabase/client', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(mockQueryResult),
    })),
  },
}))

// ─── Mock env ───────────────────────────────────────────────
beforeAll(() => {
  process.env.INTERNAL_API_KEY = 'valid-internal-key-123'
})

afterAll(() => {
  delete process.env.INTERNAL_API_KEY
})

beforeEach(() => {
  jest.clearAllMocks()
  mockQueryResult = {
    data: {
      id: 'conn-1',
      jira_base_url: 'https://test.atlassian.net',
      encrypted_creds: 'encrypted-data',
      creds_iv: 'iv-data',
      auth_type: 'api_token',
      status: 'active',
    },
    error: null,
  }
})

describe('GET /api/connections/[id]/credentials', () => {
  it('returns 401 when x-internal-key header is missing', async () => {
    const req = new NextRequest('http://localhost/api/connections/conn-1/credentials')
    const response = await GET(req, { params: { id: 'conn-1' } })
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 401 when x-internal-key is wrong', async () => {
    const req = new NextRequest('http://localhost/api/connections/conn-1/credentials', {
      headers: { 'x-internal-key': 'wrong-key' },
    })
    const response = await GET(req, { params: { id: 'conn-1' } })
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns decrypted credentials with valid key', async () => {
    const req = new NextRequest('http://localhost/api/connections/conn-1/credentials', {
      headers: { 'x-internal-key': 'valid-internal-key-123' },
    })
    const response = await GET(req, { params: { id: 'conn-1' } })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.base_url).toBe('https://test.atlassian.net')
    expect(json.headers.Authorization).toMatch(/^Basic /)
    expect(json.headers['Content-Type']).toBe('application/json')
  })

  it('returns 404 when connection not found', async () => {
    mockQueryResult = { data: null, error: { message: 'Not found' } }

    const req = new NextRequest('http://localhost/api/connections/invalid/credentials', {
      headers: { 'x-internal-key': 'valid-internal-key-123' },
    })
    const response = await GET(req, { params: { id: 'invalid' } })
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toBe('Connection not found')
  })

  it('returns 400 when connection is not active', async () => {
    mockQueryResult = {
      data: { ...mockQueryResult.data, status: 'error' },
      error: null,
    }

    const req = new NextRequest('http://localhost/api/connections/conn-1/credentials', {
      headers: { 'x-internal-key': 'valid-internal-key-123' },
    })
    const response = await GET(req, { params: { id: 'conn-1' } })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Connection is not active')
  })
})
