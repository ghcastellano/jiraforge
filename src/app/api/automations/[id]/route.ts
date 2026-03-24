import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'

// Allowed fields for PATCH updates (prevent mass assignment)
const ALLOWED_PATCH_FIELDS = ['active', 'config', 'project_key'] as const

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
    .from('automation_rules')
    .update(update)
    .eq('id', params.id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = req.nextUrl.searchParams.get('tenant_id')
  if (!tenantId) return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('automation_rules')
    .delete()
    .eq('id', params.id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: { deleted: true } })
}
