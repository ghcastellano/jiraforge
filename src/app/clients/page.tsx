'use client'

import { useState, useEffect } from 'react'
import {
  Building2, Plus, Search, MoreHorizontal, CheckCircle2,
  XCircle, Clock, Wifi, WifiOff, Trash2, Edit3,
  ExternalLink, Key, Globe, AlertCircle, Loader2,
  ChevronDown, ChevronRight, FolderKanban, Zap, Copy
} from 'lucide-react'
import { useTenants, useConnections } from '@/hooks'
import type { Tenant, JiraConnection, CreateConnectionInput } from '@/types'

// ─── Status config ───────────────────────────────────────

const STATUS_CONFIG = {
  active:  { label: 'Ativo',    icon: CheckCircle2, cls: 'badge-green' },
  error:   { label: 'Erro',     icon: XCircle,      cls: 'badge-red'   },
  pending: { label: 'Pendente', icon: Clock,        cls: 'badge-amber' },
  expired: { label: 'Expirado', icon: AlertCircle,  cls: 'badge-amber' },
}

// ─── Components ───────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending
  const Icon = cfg.icon
  return (
    <span className={`badge ${cfg.cls}`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  )
}

function ConnectionCard({
  conn,
  onCheck,
  onDelete,
}: {
  conn: JiraConnection
  onCheck: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [checking, setChecking] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleCheck = async () => {
    setChecking(true)
    try {
      await onCheck(conn.id)
    } finally {
      setChecking(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(conn.id)
    } finally {
      setDeleting(false)
      setMenuOpen(false)
    }
  }

  return (
    <div className="conn-card">
      <div className="conn-left">
        <div className={`conn-icon ${conn.auth_type === 'oauth' ? 'oauth' : 'token'}`}>
          {conn.auth_type === 'oauth' ? <Globe size={14} /> : <Key size={14} />}
        </div>
        <div className="conn-info">
          <div className="conn-name">{conn.name}</div>
          <div className="conn-url">
            <code>{conn.jira_base_url.replace('https://', '')}</code>
            {conn.is_premium && <span className="badge badge-brand" style={{ fontSize: '10px', padding: '1px 6px' }}>Premium</span>}
          </div>
          {conn.status === 'error' && conn.last_error && (
            <div className="conn-error">
              <AlertCircle size={11} />
              {conn.last_error}
            </div>
          )}
        </div>
      </div>
      <div className="conn-right">
        <StatusBadge status={conn.status} />
        <button
          className="btn btn-sm"
          onClick={handleCheck}
          disabled={checking}
        >
          {checking
            ? <><Loader2 size={12} className="animate-spin" /> Testando…</>
            : <><Wifi size={12} /> Testar</>
          }
        </button>
        <div className="menu-wrap">
          <button className="btn btn-icon btn-sm" onClick={() => setMenuOpen(o => !o)}>
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div className="dropdown" onMouseLeave={() => setMenuOpen(false)}>
              <button className="dropdown-item">
                <Edit3 size={13} /> Editar
              </button>
              <button className="dropdown-item">
                <Copy size={13} /> Copiar URL
              </button>
              <button className="dropdown-item">
                <ExternalLink size={13} /> Abrir Jira
              </button>
              <div className="dropdown-divider" />
              <button className="dropdown-item danger" onClick={handleDelete} disabled={deleting}>
                {deleting
                  ? <><Loader2 size={13} className="animate-spin" /> Removendo…</>
                  : <><Trash2 size={13} /> Remover</>
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TenantRow({
  tenant,
  onAddConnection,
}: {
  tenant: Tenant
  onAddConnection: (tenantId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { connections, loading, reload, checkConnection, deleteConnection } = useConnections(expanded ? tenant.id : null)

  const activeConns = connections.filter(c => c.status === 'active').length
  const connCount = tenant.connections_count ?? connections.length

  // Auto-expand if tenant has connections
  useEffect(() => {
    if ((tenant.connections_count ?? 0) > 0 && !expanded) {
      setExpanded(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCheck = async (id: string) => {
    await checkConnection(id)
  }

  const handleDelete = async (id: string) => {
    await deleteConnection(id)
  }

  return (
    <div className="tenant-row animate-in">
      <div className="tenant-header" onClick={() => setExpanded(e => !e)}>
        <div className="tenant-left">
          <div className="expand-icon">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
          <div className="tenant-avatar">
            {tenant.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="tenant-meta">
            <div className="tenant-name">{tenant.name}</div>
            {tenant.description && (
              <div className="tenant-desc">{tenant.description}</div>
            )}
          </div>
        </div>
        <div className="tenant-stats">
          <div className="stat">
            <FolderKanban size={13} />
            <span>{tenant.projects_count ?? 0} projetos</span>
          </div>
          <div className="stat">
            <Zap size={13} />
            <span>{tenant.active_rules_count ?? 0} regras</span>
          </div>
          <div className="stat">
            {(expanded ? activeConns : connCount) > 0
              ? <><Wifi size={13} style={{ color: 'var(--green)' }} /><span style={{ color: 'var(--green)' }}>{expanded ? activeConns : connCount} conexão{(expanded ? activeConns : connCount) !== 1 ? 'ões' : ''}</span></>
              : <><WifiOff size={13} /><span>sem conexão</span></>
            }
          </div>
          <button
            className="btn btn-sm btn-primary"
            onClick={e => { e.stopPropagation(); onAddConnection(tenant.id) }}
          >
            <Plus size={12} /> Conexão
          </button>
        </div>
      </div>

      {expanded && (
        <div className="tenant-connections">
          {loading ? (
            <div className="conn-empty">
              <Loader2 size={18} className="animate-spin" />
              <span>Carregando conexões…</span>
            </div>
          ) : connections.length === 0 ? (
            <div className="conn-empty">
              <WifiOff size={18} />
              <span>Nenhuma conexão Jira. Adicione uma para poder criar projetos.</span>
              <button className="btn btn-sm btn-primary" onClick={() => onAddConnection(tenant.id)}>
                <Plus size={12} /> Adicionar conexão
              </button>
            </div>
          ) : (
            connections.map(c => (
              <ConnectionCard
                key={c.id}
                conn={c}
                onCheck={handleCheck}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Add Connection Modal ──────────────────────────────────

function AddConnectionModal({
  tenantId,
  tenantName,
  onClose,
  onSave,
}: {
  tenantId: string
  tenantName: string
  onClose: () => void
  onSave: (data: CreateConnectionInput) => Promise<void>
}) {
  const [authType, setAuthType] = useState<'api_token' | 'oauth'>('api_token')
  const [form, setForm] = useState({ name: '', jira_base_url: '', email: '', token: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handle = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload: CreateConnectionInput = {
        tenant_id: tenantId,
        name: form.name,
        jira_base_url: form.jira_base_url,
        auth_type: authType,
      }
      if (authType === 'api_token') {
        payload.jira_email = form.email
        payload.api_token = form.token
      }
      await onSave(payload)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar conexão')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Nova conexão Jira</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Cliente: <strong style={{ color: 'var(--text-secondary)' }}>{tenantName}</strong>
            </p>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="conn-error" style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 6 }}>
              <AlertCircle size={13} />
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Nome da conexão</label>
            <input type="text" placeholder="ex: Avangrid Production" value={form.name} onChange={handle('name')} />
            <span className="form-hint">Para identificar no JiraForge</span>
          </div>

          <div className="form-group">
            <label className="form-label">URL do Jira</label>
            <input type="url" placeholder="https://empresa.atlassian.net" value={form.jira_base_url} onChange={handle('jira_base_url')} />
          </div>

          <div className="form-group">
            <label className="form-label">Tipo de autenticação</label>
            <div className="auth-type-tabs">
              <button
                className={`auth-tab ${authType === 'api_token' ? 'active' : ''}`}
                onClick={() => setAuthType('api_token')}
              >
                <Key size={14} /> API Token
              </button>
              <button
                className={`auth-tab ${authType === 'oauth' ? 'active' : ''}`}
                onClick={() => setAuthType('oauth')}
              >
                <Globe size={14} /> OAuth 2.0
              </button>
            </div>
          </div>

          {authType === 'api_token' && (
            <>
              <div className="form-group">
                <label className="form-label">Email do service account</label>
                <input type="email" placeholder="ntt-service@empresa.com" value={form.email} onChange={handle('email')} />
              </div>
              <div className="form-group">
                <label className="form-label">API Token</label>
                <input type="password" placeholder="Gere em id.atlassian.com/manage-profile/security" value={form.token} onChange={handle('token')} />
                <span className="form-hint">Criptografado com AES-256-GCM antes de salvar</span>
              </div>
            </>
          )}

          {authType === 'oauth' && (
            <div className="oauth-info">
              <Globe size={16} style={{ color: 'var(--brand-light)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Fluxo OAuth 2.0 (3LO)
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Ao salvar, você será redirecionado para a tela de autorização do Jira do cliente.
                  O token será armazenado e renovado automaticamente.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving || !form.name || !form.jira_base_url}>
            {saving ? <><Loader2 size={13} className="animate-spin" /> Salvando…</> : 'Salvar conexão'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Tenant Modal ──────────────────────────────────────

function AddTenantModal({ onClose, onSave }: { onClose: () => void; onSave: (payload: { name: string; slug: string; description?: string }) => Promise<void> }) {
  const [form, setForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const slug = form.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave({ name: form.name, slug, description: form.description || undefined })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar cliente')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Novo cliente</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && (
            <div className="conn-error" style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 6 }}>
              <AlertCircle size={13} />
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Nome do cliente</label>
            <input
              type="text" placeholder="ex: Avangrid"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>
          {slug && (
            <div className="form-group">
              <label className="form-label">Slug (gerado automaticamente)</label>
              <div className="slug-preview"><code>{slug}</code></div>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Descrição <span style={{ color: 'var(--text-muted)' }}>(opcional)</span></label>
            <input
              type="text" placeholder="ex: Setor energia, time ágil Scrum"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            disabled={!form.name || saving}
            onClick={submit}
          >
            {saving ? <><Loader2 size={13} className="animate-spin" /> Criando…</> : 'Criar cliente'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────

export default function ClientsPage() {
  const { tenants, loading, error, reload, createTenant } = useTenants()
  const [search, setSearch] = useState('')
  const [addTenantOpen, setAddTenantOpen] = useState(false)
  const [addConnModal, setAddConnModal] = useState<{ tenantId: string; tenantName: string } | null>(null)

  // For stats, we use the connections hook for the currently-selected tenant in the modal,
  // but stats are computed from tenant-level counts returned by the API
  const totalConnections = tenants.reduce((sum, t) => sum + (t.connections_count ?? 0), 0)

  const filtered = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  // Connection creation handler - uses a temporary hook-like pattern
  const handleCreateConnection = async (payload: CreateConnectionInput) => {
    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Erro ao criar conexão')
    // Reload tenants to update counts
    reload()
  }

  if (loading) {
    return (
      <div className="clients-page">
        <div className="page-header">
          <div>
            <h1>Clientes</h1>
            <p>Gerencie os tenants e suas conexões com o Jira Cloud</p>
          </div>
        </div>
        <div className="empty-state">
          <Loader2 size={24} className="animate-spin" />
          <div className="empty-title">Carregando clientes…</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="clients-page">
        <div className="page-header">
          <div>
            <h1>Clientes</h1>
            <p>Gerencie os tenants e suas conexões com o Jira Cloud</p>
          </div>
        </div>
        <div className="empty-state">
          <div className="empty-icon"><AlertCircle size={20} /></div>
          <div className="empty-title">Erro ao carregar clientes</div>
          <div className="empty-desc">{error}</div>
          <button className="btn btn-primary" onClick={reload}>
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="clients-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Clientes</h1>
          <p>Gerencie os tenants e suas conexões com o Jira Cloud</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddTenantOpen(true)}>
          <Plus size={14} /> Novo cliente
        </button>
      </div>

      {/* Stats row */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-value">{tenants.length}</span>
          <span className="stat-label">Clientes</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalConnections}</span>
          <span className="stat-label">Conexões Jira</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">
            {tenants.reduce((sum, t) => sum + (t.projects_count ?? 0), 0)}
          </span>
          <span className="stat-label">Projetos</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">
            {tenants.reduce((sum, t) => sum + (t.active_rules_count ?? 0), 0)}
          </span>
          <span className="stat-label">Regras ativas</span>
        </div>
      </div>

      {/* Search */}
      <div className="search-row">
        <div className="search-input">
          <Search size={14} className="search-icon" />
          <input
            type="text" placeholder="Buscar clientes…"
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className="tenants-list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Building2 size={20} /></div>
            <div className="empty-title">Nenhum cliente encontrado</div>
            <div className="empty-desc">Crie o primeiro cliente para começar a configurar projetos Jira</div>
            <button className="btn btn-primary" onClick={() => setAddTenantOpen(true)}>
              <Plus size={14} /> Novo cliente
            </button>
          </div>
        ) : (
          filtered.map(t => (
            <TenantRow
              key={t.id}
              tenant={t}
              onAddConnection={(id) => setAddConnModal({ tenantId: id, tenantName: t.name })}
            />
          ))
        )}
      </div>

      {/* Modals */}
      {addTenantOpen && (
        <AddTenantModal
          onClose={() => setAddTenantOpen(false)}
          onSave={async (payload) => {
            await createTenant(payload)
          }}
        />
      )}

      {addConnModal && (
        <AddConnectionModal
          tenantId={addConnModal.tenantId}
          tenantName={addConnModal.tenantName}
          onClose={() => setAddConnModal(null)}
          onSave={handleCreateConnection}
        />
      )}

    </div>
  )
}
