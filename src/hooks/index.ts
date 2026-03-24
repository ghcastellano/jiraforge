'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Tenant, JiraConnection, Template, AutomationRule, ProjectCreated } from '@/types'

// ─── Generic fetcher ──────────────────────────────────────
async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  return json.data as T
}

// ─── useTenants ───────────────────────────────────────────
export function useTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetcher<Tenant[]>('/api/tenants')
      setTenants(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const createTenant = async (payload: { name: string; slug: string; description?: string }) => {
    const res = await fetch('/api/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    setTenants(ts => [...ts, json.data])
    return json.data as Tenant
  }

  return { tenants, loading, error, reload: load, createTenant }
}

// ─── useConnections ───────────────────────────────────────
export function useConnections(tenantId: string | null) {
  const [connections, setConnections] = useState<JiraConnection[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const data = await fetcher<JiraConnection[]>(`/api/connections?tenant_id=${tenantId}`)
      setConnections(data)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const createConnection = async (payload: object) => {
    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    setConnections(cs => [...cs, json.data])
    return json.data as JiraConnection
  }

  const checkConnection = async (id: string) => {
    const res = await fetch(`/api/connections/${id}/check`, { method: 'POST' })
    const json = await res.json()
    setConnections(cs => cs.map(c => c.id === id ? { ...c, status: json.data?.status ?? c.status } : c))
    return json
  }

  const deleteConnection = async (id: string) => {
    await fetch(`/api/connections/${id}?tenant_id=${tenantId}`, { method: 'DELETE' })
    setConnections(cs => cs.filter(c => c.id !== id))
  }

  return { connections, loading, reload: load, createConnection, checkConnection, deleteConnection }
}

// ─── useTemplates ─────────────────────────────────────────
export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetcher<Template[]>('/api/templates')
      setTemplates(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const createTemplate = async (payload: {
    name: string
    description?: string
    icon?: string
    is_global: boolean
    tenant_id?: string
    config: import('@/types').TemplateConfig
    tags: string[]
    created_by: string
  }) => {
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    setTemplates(ts => [...ts, json.data])
    return json.data as Template
  }

  const updateTemplate = async (id: string, payload: Partial<Template>) => {
    const res = await fetch(`/api/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    setTemplates(ts => ts.map(t => t.id === id ? json.data : t))
    return json.data as Template
  }

  const deleteTemplate = async (id: string) => {
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error)
    }
    setTemplates(ts => ts.filter(t => t.id !== id))
  }

  const duplicateTemplate = async (id: string, overrides?: { name?: string; is_global?: boolean; tenant_id?: string; created_by?: string }) => {
    const res = await fetch(`/api/templates/${id}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(overrides ?? {}),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    setTemplates(ts => [...ts, json.data])
    return json.data as Template
  }

  return { templates, loading, reload: load, createTemplate, updateTemplate, deleteTemplate, duplicateTemplate }
}

// ─── useTemplate (single) ────────────────────────────────
export function useTemplate(id: string | null) {
  const [template, setTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      setError(null)
      const data = await fetcher<Template>(`/api/templates/${id}`)
      setTemplate(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar template')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  return { template, loading, error, reload: load }
}

// ─── useProjects ──────────────────────────────────────────
export function useProjects(tenantId?: string) {
  const [projects, setProjects] = useState<ProjectCreated[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const url = tenantId ? `/api/projects?tenant_id=${tenantId}` : '/api/projects'
    fetcher<ProjectCreated[]>(url).then(setProjects).finally(() => setLoading(false))
  }, [tenantId])

  return { projects, loading }
}

// ─── useAutomations ───────────────────────────────────────
export function useAutomations(tenantId?: string) {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const url = tenantId ? `/api/automations?tenant_id=${tenantId}` : '/api/automations'
    const data = await fetcher<AutomationRule[]>(url)
    setRules(data)
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const toggleRule = async (id: string, active: boolean) => {
    await fetch(`/api/automations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
    setRules(rs => rs.map(r => r.id === id ? { ...r, active } : r))
  }

  return { rules, loading, reload: load, toggleRule }
}
