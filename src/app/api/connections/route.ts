// app/api/connections/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'
import { encryptJiraCredentials } from '@/lib/crypto/credentials'
import type { CreateConnectionInput } from '@/types'

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenant_id')
  if (!tenantId) return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('jira_connections')
    .select('id, tenant_id, name, jira_base_url, jira_cloud_id, auth_type, status, last_checked_at, last_error, is_premium, created_at, updated_at')
    // never select encrypted_creds or creds_iv
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as CreateConnectionInput

  if (!body.tenant_id || !body.name || !body.jira_base_url || !body.auth_type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  let credentials: { type: string; email?: string; token?: string }
  if (body.auth_type === 'api_token') {
    if (!body.api_token || !body.jira_email) {
      return NextResponse.json({ error: 'api_token and jira_email required for api_token auth' }, { status: 400 })
    }
    credentials = { type: 'api_token', email: body.jira_email, token: body.api_token }
  } else {
    return NextResponse.json({ error: 'OAuth flow must use /api/connections/oauth/init' }, { status: 400 })
  }

  const { encrypted, iv } = await encryptJiraCredentials(credentials as Parameters<typeof encryptJiraCredentials>[0])

  const { data, error } = await supabaseAdmin
    .from('jira_connections')
    .insert({
      tenant_id: body.tenant_id,
      name: body.name,
      jira_base_url: body.jira_base_url.replace(/\/$/, ''),
      auth_type: body.auth_type,
      encrypted_creds: encrypted,
      creds_iv: iv,
      status: 'pending',
    })
    .select('id, tenant_id, name, jira_base_url, auth_type, status, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
