import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenant_id')
  const connectionId = req.nextUrl.searchParams.get('connection_id')

  let query = supabaseAdmin
    .from('projects_created')
    .select('*, connection:jira_connections(id, name, jira_base_url), template:templates(id, name, icon)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (tenantId) query = query.eq('tenant_id', tenantId)
  if (connectionId) query = query.eq('jira_connection_id', connectionId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
