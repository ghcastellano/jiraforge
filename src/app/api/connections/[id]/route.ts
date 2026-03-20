import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'
import { JiraClient } from '@/lib/jira/client'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  // First, deactivate any automation rules pointing to this connection
  await supabaseAdmin
    .from('automation_rules')
    .update({ active: false })
    .eq('jira_connection_id', params.id)

  const { error } = await supabaseAdmin
    .from('jira_connections')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: { deleted: true } })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()

  const { data, error } = await supabaseAdmin
    .from('jira_connections')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('id, tenant_id, name, jira_base_url, auth_type, status, is_premium, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
