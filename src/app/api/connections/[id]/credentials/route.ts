import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'
import { decryptJiraCredentials } from '@/lib/crypto/credentials'

// This endpoint is called ONLY by the roll-up service (FastAPI on Railway)
// Protected by INTERNAL_API_KEY — never expose to frontend

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Verify internal API key
  const key = req.headers.get('x-internal-key')
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: conn, error } = await supabaseAdmin
    .from('jira_connections')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !conn) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  if (conn.status !== 'active') {
    return NextResponse.json({ error: 'Connection is not active' }, { status: 400 })
  }

  const credentials = await decryptJiraCredentials(conn.encrypted_creds, conn.creds_iv)

  // Build auth headers based on credential type
  let headers: Record<string, string>
  if (credentials.type === 'api_token') {
    const encoded = Buffer.from(`${credentials.email}:${credentials.token}`).toString('base64')
    headers = {
      'Authorization': `Basic ${encoded}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  } else {
    headers = {
      'Authorization': `Bearer ${credentials.access_token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  }

  return NextResponse.json({
    base_url: conn.jira_base_url,
    headers,
  })
}
