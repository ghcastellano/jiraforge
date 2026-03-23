// ============================================================
// Tests for credential encryption/decryption (AES-256-GCM)
// ============================================================

import {
  encryptCredentials,
  decryptCredentials,
  encryptJiraCredentials,
  decryptJiraCredentials,
} from './credentials'
import type { ApiTokenCredentials } from './credentials'

// Set the encryption key env var before tests
beforeAll(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = 'test-encryption-key-at-least-32-chars!!'
})

afterAll(() => {
  delete process.env.CREDENTIALS_ENCRYPTION_KEY
})

describe('encryptCredentials / decryptCredentials', () => {
  it('roundtrips plaintext correctly', async () => {
    const plaintext = 'my-secret-token-12345'
    const { encrypted, iv } = await encryptCredentials(plaintext)
    const decrypted = await decryptCredentials(encrypted, iv)
    expect(decrypted).toBe(plaintext)
  })

  it('roundtrips long plaintext', async () => {
    const plaintext = 'A'.repeat(10000)
    const { encrypted, iv } = await encryptCredentials(plaintext)
    const decrypted = await decryptCredentials(encrypted, iv)
    expect(decrypted).toBe(plaintext)
  })

  it('roundtrips unicode plaintext', async () => {
    const plaintext = 'credentials-with-unicode-\u00e9\u00e8\u00ea-\u00e7\u00e0-\ud83d\ude80'
    const { encrypted, iv } = await encryptCredentials(plaintext)
    const decrypted = await decryptCredentials(encrypted, iv)
    expect(decrypted).toBe(plaintext)
  })

  it('produces different encrypted outputs for different inputs', async () => {
    const { encrypted: enc1 } = await encryptCredentials('input-one')
    const { encrypted: enc2 } = await encryptCredentials('input-two')
    expect(enc1).not.toBe(enc2)
  })

  it('generates unique IV per encryption (same plaintext)', async () => {
    const plaintext = 'same-input-same-input'
    const { iv: iv1 } = await encryptCredentials(plaintext)
    const { iv: iv2 } = await encryptCredentials(plaintext)
    expect(iv1).not.toBe(iv2)
  })

  it('encrypted and iv are base64 strings', async () => {
    const { encrypted, iv } = await encryptCredentials('test')
    const base64Regex = /^[A-Za-z0-9+/=]+$/
    expect(encrypted).toMatch(base64Regex)
    expect(iv).toMatch(base64Regex)
  })
})

describe('encryptJiraCredentials / decryptJiraCredentials', () => {
  it('roundtrips api_token credentials', async () => {
    const creds: ApiTokenCredentials = {
      type: 'api_token',
      email: 'user@example.com',
      token: 'ATATT3xF...',
    }
    const { encrypted, iv } = await encryptJiraCredentials(creds)
    const decrypted = await decryptJiraCredentials(encrypted, iv)
    expect(decrypted).toEqual(creds)
  })

  it('roundtrips oauth credentials', async () => {
    const creds = {
      type: 'oauth' as const,
      access_token: 'eyJhbGciOi...',
      refresh_token: 'refresh_token_123',
      expires_at: 1700000000,
      cloud_id: 'cloud-id-abc',
    }
    const { encrypted, iv } = await encryptJiraCredentials(creds)
    const decrypted = await decryptJiraCredentials(encrypted, iv)
    expect(decrypted).toEqual(creds)
  })

  it('preserves credential type field', async () => {
    const creds: ApiTokenCredentials = {
      type: 'api_token',
      email: 'test@ntt.com',
      token: 'secret',
    }
    const { encrypted, iv } = await encryptJiraCredentials(creds)
    const decrypted = await decryptJiraCredentials(encrypted, iv)
    expect(decrypted.type).toBe('api_token')
  })
})
