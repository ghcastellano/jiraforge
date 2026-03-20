// app/api/connections/[id]/check/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'
import { JiraClient } from '@/lib/jira/client'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  // Fetch full connection record including encrypted creds
  const { data: conn, error } = await supabaseAdmin
    .from('jira_connections')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !conn) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })

  try {
    const client = await JiraClient.fromConnection(conn)
    const user = await client.getMyself()

    // Try to get cloud ID
    let cloudId = conn.jira_cloud_id
    if (!cloudId && conn.auth_type === 'oauth') {
      cloudId = await client.getCloudId()
    }

    await supabaseAdmin
      .from('jira_connections')
      .update({
        status: 'active',
        last_checked_at: new Date().toISOString(),
        last_error: null,
        jira_cloud_id: cloudId ?? conn.jira_cloud_id,
      })
      .eq('id', params.id)

    return NextResponse.json({
      data: {
        status: 'active',
        jira_user: user.displayName,
        jira_email: user.emailAddress,
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    await supabaseAdmin
      .from('jira_connections')
      .update({
        status: 'error',
        last_checked_at: new Date().toISOString(),
        last_error: message,
      })
      .eq('id', params.id)

    return NextResponse.json({ error: message, data: { status: 'error' } }, { status: 400 })
  }
}
