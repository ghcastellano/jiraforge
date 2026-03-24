import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // Fetch original
  const { data: original, error: fetchErr } = await supabaseAdmin
    .from('templates')
    .select('*')
    .eq('id', params.id)
    .single()

  if (fetchErr || !original) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))

  // Create duplicate
  const { data, error } = await supabaseAdmin
    .from('templates')
    .insert({
      name: body.name || `${original.name} (cópia)`,
      description: original.description,
      icon: original.icon,
      is_global: body.is_global ?? original.is_global,
      tenant_id: body.tenant_id ?? original.tenant_id,
      config: original.config,
      tags: original.tags,
      created_by: body.created_by ?? 'ntt-operator',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
