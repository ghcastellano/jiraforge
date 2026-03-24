/**
 * @jest-environment node
 */
// ============================================================
// Tests for /api/connections/[id]/check route (health check)
// ============================================================

import { POST } from './route'
import { NextRequest } from 'next/server'

// ─── Mock JiraClient ────────────────────────────────────────
let mockGetMyself: jest.Mock
let mockGetCloudId: jest.Mock

jest.mock('@/lib/jira/client', () => ({
  JiraClient: {
    fromConnection: jest.fn().mockImplementation(async () => ({
      getMyself: (...args: any[]) => mockGetMyself(...args),
      getCloudId: (...args: any[]) => mockGetCloudId(...args),
    })),
  },
}))

// ─── Mock Supabase ──────────────────────────────────────────
const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn() })
let mockSelectResult: { data: any; error: any }

jest.mock('@/lib/supabase/client', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockImplementation(() => mockSelectResult),
      update: mockUpdate,
    })),
  },
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockGetMyself = jest.fn()
  mockGetCloudId = jest.fn()
  mockSelectResult = {
    data: {
      id: 'conn-1',
      jira_base_url: 'https://test.atlassian.net',
      encrypted_creds: 'enc',
      creds_iv: 'iv',
      auth_type: 'api_token',
      status: 'pending',
      jira_cloud_id: null,
    },
    error: null,
  }
  mockGetMyself.mockResolvedValue({
    accountId: 'acc-123',
    displayName: 'Test User',
    emailAddress: 'test@example.com',
  })
  mockGetCloudId.mockResolvedValue('cloud-abc')
})

describe('POST /api/connections/[id]/check', () => {
  it('returns active status on successful check', async () => {
    const req = new NextRequest('http://localhost/api/connections/conn-1/check', { method: 'POST' })
    const response = await POST(req, { params: { id: 'conn-1' } })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.status).toBe('active')
    expect(json.data.jira_user).toBe('Test User')
    expect(json.data.jira_email).toBe('test@example.com')
  })

  it('returns 404 when connection not found', async () => {
    mockSelectResult = { data: null, error: { message: 'Not found' } }

    const req = new NextRequest('http://localhost/api/connections/invalid/check', { method: 'POST' })
    const response = await POST(req, { params: { id: 'invalid' } })
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toBe('Connection not found')
  })

  it('returns error status when Jira API fails', async () => {
    mockGetMyself.mockRejectedValue(new Error('Jira API error 401: Unauthorized'))

    const req = new NextRequest('http://localhost/api/connections/conn-1/check', { method: 'POST' })
    const response = await POST(req, { params: { id: 'conn-1' } })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.data.status).toBe('error')
    expect(json.error).toContain('Unauthorized')
  })
})
