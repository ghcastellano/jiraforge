import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'

// Allowed fields for PATCH updates (prevent mass assignment)
const ALLOWED_PATCH_FIELDS = ['name', 'jira_base_url', 'is_premium', 'status'] as const

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = req.nextUrl.searchParams.get('tenant_id')
  if (!tenantId) return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })

  // First, deactivate any automation rules pointing to this connection
  await supabaseAdmin
    .from('automation_rules')
    .update({ active: false })
    .eq('jira_connection_id', params.id)
    .eq('tenant_id', tenantId)

  const { error } = await supabaseAdmin
    .from('jira_connections')
    .delete()
    .eq('id', params.id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: { deleted: true } })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const tenantId = body.tenant_id
  if (!tenantId) return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })

  // Filter to allowed fields only (prevent mass assignment)
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const field of ALLOWED_PATCH_FIELDS) {
    if (field in body) update[field] = body[field]
  }

  const { data, error } = await supabaseAdmin
    .from('jira_connections')
    .update(update)
    .eq('id', params.id)
    .eq('tenant_id', tenantId)
    .select('id, tenant_id, name, jira_base_url, auth_type, status, is_premium, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
