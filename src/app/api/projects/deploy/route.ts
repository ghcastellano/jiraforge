// app/api/projects/deploy/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'
import { JiraClient } from '@/lib/jira/client'
import { deployProject } from '@/lib/jira/deployer'
import type { ProjectBuilderState } from '@/types'

export async function POST(req: NextRequest) {
  const state = await req.json() as ProjectBuilderState & { created_by: string }

  if (!state.jira_connection_id || !state.tenant_id) {
    return NextResponse.json({ error: 'jira_connection_id and tenant_id required' }, { status: 400 })
  }

  // Fetch connection (with creds)
  const { data: conn, error: connError } = await supabaseAdmin
    .from('jira_connections')
    .select('*')
    .eq('id', state.jira_connection_id)
    .eq('tenant_id', state.tenant_id)   // tenant isolation check
    .single()

  if (connError || !conn) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  if (conn.status !== 'active') {
    return NextResponse.json({ error: 'Connection is not active. Run a health check first.' }, { status: 400 })
  }

  // Create project record (pending)
  const { data: projectRecord, error: insertError } = await supabaseAdmin
    .from('projects_created')
    .insert({
      tenant_id: state.tenant_id,
      jira_connection_id: state.jira_connection_id,
      template_id: state.template_id ?? null,
      jira_project_key: state.project_key,
      jira_project_name: state.project_name,
      config_snapshot: state,
      status: 'in_progress',
      created_by: state.created_by ?? 'ntt-operator',
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Deploy
  const client = await JiraClient.fromConnection(conn)
  const result = await deployProject(client, state)

  // Update project record with result
  await supabaseAdmin
    .from('projects_created')
    .update({
      status: result.success ? 'success' : 'failed',
      jira_project_id: result.jira_project_id,
      jira_project_url: result.jira_project_url,
      steps_completed: result.steps.filter(s => s.status === 'done').map(s => s.key),
      error_details: result.success ? null : { steps: result.steps, error: result.error },
    })
    .eq('id', projectRecord.id)

  // Increment template usage count
  if (state.template_id) {
    await supabaseAdmin.rpc('increment_template_usage', { template_id: state.template_id })
  }

  return NextResponse.json({
    data: {
      project_record_id: projectRecord.id,
      ...result,
    }
  }, { status: result.success ? 200 : 500 })
}
