import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'
import type { Template } from '@/types'

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenant_id')

  let query = supabaseAdmin
    .from('templates')
    .select('*')
    .order('used_count', { ascending: false })

  if (tenantId) {
    // global templates + tenant-specific ones
    query = query.or(`is_global.eq.true,tenant_id.eq.${tenantId}`)
  } else {
    query = query.eq('is_global', true)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<Template> & { created_by: string }

  const { data, error } = await supabaseAdmin
    .from('templates')
    .insert({
      name: body.name,
      description: body.description,
      icon: body.icon ?? '📋',
      is_global: body.is_global ?? false,
      tenant_id: body.tenant_id ?? null,
      config: body.config,
      tags: body.tags ?? [],
      created_by: body.created_by ?? 'ntt-operator',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
