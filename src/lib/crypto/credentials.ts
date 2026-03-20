// ============================================================
// JiraForge · Credential Encryption (AES-256-GCM)
// Server-side only — never import in client components
// ============================================================

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256

function getEncryptionKey(): string {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!key) throw new Error('CREDENTIALS_ENCRYPTION_KEY not set')
  if (key.length < 32) throw new Error('CREDENTIALS_ENCRYPTION_KEY must be at least 32 chars')
  return key
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret.padEnd(32, '0').slice(0, 32)),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('jiraforge-ntt-data'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptCredentials(plaintext: string): Promise<{ encrypted: string; iv: string }> {
  const key = await deriveKey(getEncryptionKey())
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoder = new TextEncoder()

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(plaintext)
  )

  return {
    encrypted: Buffer.from(encrypted).toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
  }
}

export async function decryptCredentials(encrypted: string, iv: string): Promise<string> {
  const key = await deriveKey(getEncryptionKey())
  const decoder = new TextDecoder()

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: Buffer.from(iv, 'base64') },
    key,
    Buffer.from(encrypted, 'base64')
  )

  return decoder.decode(decrypted)
}

// ─── Credential shapes ────────────────────────────────────

export interface ApiTokenCredentials {
  type: 'api_token'
  email: string
  token: string
}

export interface OAuthCredentials {
  type: 'oauth'
  access_token: string
  refresh_token: string
  expires_at: number
  cloud_id: string
}

export type JiraCredentials = ApiTokenCredentials | OAuthCredentials

export async function encryptJiraCredentials(creds: JiraCredentials): Promise<{ encrypted: string; iv: string }> {
  return encryptCredentials(JSON.stringify(creds))
}

export async function decryptJiraCredentials(encrypted: string, iv: string): Promise<JiraCredentials> {
  const plain = await decryptCredentials(encrypted, iv)
  return JSON.parse(plain) as JiraCredentials
}
