import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'
import { JiraClient } from '@/lib/jira/client'

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenant_id')
  const connectionId = req.nextUrl.searchParams.get('connection_id')

  let query = supabaseAdmin
    .from('automation_rules')
    .select('*, connection:jira_connections(id, name, jira_base_url)')
    .order('created_at', { ascending: false })

  if (tenantId) query = query.eq('tenant_id', tenantId)
  if (connectionId) query = query.eq('jira_connection_id', connectionId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!body.tenant_id || !body.jira_connection_id || !body.rule_type) {
    return NextResponse.json({ error: 'tenant_id, jira_connection_id, rule_type required' }, { status: 400 })
  }

  // Fetch connection
  const { data: conn } = await supabaseAdmin
    .from('jira_connections')
    .select('*')
    .eq('id', body.jira_connection_id)
    .eq('tenant_id', body.tenant_id)
    .single()

  if (!conn) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })

  // Generate webhook URL and secret
  const webhookSecret = crypto.randomUUID().replace(/-/g, '')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jiraforge.vercel.app'

  // Insert rule first to get ID
  const { data: rule, error: ruleErr } = await supabaseAdmin
    .from('automation_rules')
    .insert({
      tenant_id: body.tenant_id,
      jira_connection_id: body.jira_connection_id,
      project_key: body.project_key ?? null,
      rule_type: body.rule_type,
      config: body.config ?? {},
      webhook_secret: webhookSecret,
      active: true,
    })
    .select()
    .single()

  if (ruleErr) return NextResponse.json({ error: ruleErr.message }, { status: 500 })

  // Register webhook in Jira
  const rollupUrl = process.env.ROLLUP_SERVICE_URL ?? `${appUrl}/api/webhook`
  const webhookUrl = `${rollupUrl}/${body.tenant_id}/${rule.id}`

  try {
    const client = await JiraClient.fromConnection(conn)
    const webhookRes = await client.registerWebhook({
      name: `JiraForge Roll-up: ${rule.rule_type}`,
      url: webhookUrl,
      events: ['jira:issue_updated'],
      filters: body.project_key
        ? { 'issue-related-events-section': `project = ${body.project_key}` }
        : undefined,
    })

    const webhookId = String(
      webhookRes.webhookRegistrationResult?.[0]?.createdWebhookId ?? ''
    )

    await supabaseAdmin
      .from('automation_rules')
      .update({ webhook_id: webhookId, webhook_url: webhookUrl })
      .eq('id', rule.id)

    return NextResponse.json({ data: { ...rule, webhook_id: webhookId, webhook_url: webhookUrl } }, { status: 201 })
  } catch (err) {
    // Rule created but webhook registration failed — return partial success
    const msg = err instanceof Error ? err.message : 'Webhook registration failed'
    return NextResponse.json({
      data: rule,
      warning: `Rule saved but webhook registration failed: ${msg}. Register manually or retry.`,
    }, { status: 201 })
  }
}
