'use client'

import { useState, useEffect } from 'react'
import {
  Settings, Key, Globe, Wifi, WifiOff, Plus, Trash2, Building2,
  CheckCircle2, XCircle, Clock, AlertCircle, Loader2,
  RefreshCw, Shield, Server, ExternalLink, Copy, Eye, EyeOff
} from 'lucide-react'
import { useTenants, useConnections } from '@/hooks'
import type { JiraConnection } from '@/types'

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  active:  { label: 'Ativo',    icon: CheckCircle2, cls: 'badge-green' },
  error:   { label: 'Erro',     icon: XCircle,      cls: 'badge-red'   },
  pending: { label: 'Pendente', icon: Clock,        cls: 'badge-amber' },
  expired: { label: 'Expirado', icon: AlertCircle,  cls: 'badge-amber' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  const Icon = cfg.icon
  return <span className={`badge ${cfg.cls}`}><Icon size={10} /> {cfg.label}</span>
}

function AddConnectionModal({ tenantId, tenantName, onClose, onSaved }: {
  tenantId: string
  tenantName: string
  onClose: () => void
  onSaved: () => void
}) {
  const [authType, setAuthType] = useState<'api_token' | 'oauth'>('api_token')
  const [form, setForm] = useState({ name: '', jira_base_url: '', email: '', token: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showToken, setShowToken] = useState(false)

  const handle = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          name: form.name,
          jira_base_url: form.jira_base_url,
          auth_type: authType,
          ...(authType === 'api_token' ? { jira_email: form.email, api_token: form.token } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar conexão')
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setSaving(false)
    }
  }

  const canSave = form.name && form.jira_base_url && (authType === 'oauth' || (form.email && form.token))

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
          <button className="btn btn-icon btn-ghost" onClick={onClose}>
            <XCircle size={16} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="rule-error" style={{ marginBottom: 16 }}>
              <AlertCircle size={12} /> {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Nome da conexão</label>
            <input type="text" placeholder="ex: Avangrid Production" value={form.name} onChange={handle('name')} autoFocus />
            <span className="form-hint">Identificador interno no JiraForge</span>
          </div>

          <div className="form-group">
            <label className="form-label">URL do Jira Cloud</label>
            <input type="url" placeholder="https://empresa.atlassian.net" value={form.jira_base_url} onChange={handle('jira_base_url')} />
          </div>

          <div className="form-group">
            <label className="form-label">Tipo de autenticação</label>
            <div className="auth-type-tabs">
              <button className={`auth-tab ${authType === 'api_token' ? 'active' : ''}`} onClick={() => setAuthType('api_token')}>
                <Key size={14} /> API Token
              </button>
              <button className={`auth-tab ${authType === 'oauth' ? 'active' : ''}`} onClick={() => setAuthType('oauth')}>
                <Globe size={14} /> OAuth 2.0
              </button>
            </div>
          </div>

          {authType === 'api_token' && (
            <>
              <div className="form-group">
                <label className="form-label">Email do service account</label>
                <input type="email" placeholder="ntt-service@empresa.com" value={form.email} onChange={handle('email')} />
                <span className="form-hint">Email da conta Atlassian que possui o API token</span>
              </div>
              <div className="form-group">
                <label className="form-label">API Token</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showToken ? 'text' : 'password'}
                    placeholder="Cole o token gerado em id.atlassian.com"
                    value={form.token}
                    onChange={handle('token')}
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    className="btn btn-icon btn-ghost btn-sm"
                    style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                    onClick={() => setShowToken(s => !s)}
                  >
                    {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <span className="form-hint">
                  Gere em <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener" style={{ color: 'var(--brand)' }}>id.atlassian.com</a> — criptografado com AES-256-GCM
                </span>
              </div>
            </>
          )}

          {authType === 'oauth' && (
            <div className="oauth-info">
              <Globe size={16} style={{ color: 'var(--brand)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Fluxo OAuth 2.0 (3LO)
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Ao salvar, você será redirecionado para autorizar o acesso ao Jira do cliente.
                  O token será armazenado criptografado e renovado automaticamente.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving || !canSave}>
            {saving ? <><Loader2 size={13} className="animate-spin" /> Salvando...</> : 'Salvar conexão'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ConnectionRow({ conn, onCheck, onDelete }: {
  conn: JiraConnection
  onCheck: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [checking, setChecking] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleCheck = async () => {
    setChecking(true)
    try { await onCheck(conn.id) } finally { setChecking(false) }
  }

  const handleDelete = async () => {
    if (!confirm(`Remover conexão "${conn.name}"?`)) return
    setDeleting(true)
    try { await onDelete(conn.id) } finally { setDeleting(false) }
  }

  return (
    <div className="conn-card">
      <div className="conn-left">
        <div className={`conn-icon ${conn.auth_type === 'oauth' ? 'oauth' : 'token'}`}>
          {conn.auth_type === 'oauth' ? <Globe size={14} /> : <Key size={14} />}
        </div>
        <div className="conn-info" style={{ minWidth: 0 }}>
          <div className="conn-name">{conn.name}</div>
          <div className="conn-url">
            <code>{conn.jira_base_url.replace('https://', '')}</code>
            {conn.is_premium && <span className="badge badge-brand" style={{ fontSize: 10, padding: '1px 6px' }}>Premium</span>}
          </div>
          {conn.last_error && (
            <div className="conn-error"><AlertCircle size={11} /> {conn.last_error}</div>
          )}
          {conn.last_checked_at && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
              Verificado: {new Date(conn.last_checked_at).toLocaleString('pt-BR')}
            </div>
          )}
        </div>
      </div>
      <div className="conn-right">
        <StatusBadge status={conn.status} />
        <button className="btn btn-sm" onClick={handleCheck} disabled={checking}>
          {checking ? <><Loader2 size={12} className="animate-spin" /> Testando...</> : <><RefreshCw size={12} /> Testar</>}
        </button>
        <button className="btn btn-sm btn-icon" onClick={handleDelete} disabled={deleting} title="Remover">
          {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} style={{ color: 'var(--red)' }} />}
        </button>
      </div>
    </div>
  )
}

function TenantConnectionsSection({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const { connections, loading, reload, checkConnection, deleteConnection } = useConnections(tenantId)
  const [addOpen, setAddOpen] = useState(false)

  const handleCheck = async (id: string) => {
    await checkConnection(id)
  }

  const handleDelete = async (id: string) => {
    await deleteConnection(id)
  }

  const activeCount = connections.filter(c => c.status === 'active').length
  const errorCount = connections.filter(c => c.status === 'error' || c.status === 'expired').length

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="card-title">{tenantName}</span>
          <span className="badge badge-muted">{connections.length} conexão{connections.length !== 1 ? 'ões' : ''}</span>
          {activeCount > 0 && <span className="badge badge-green">{activeCount} ativa{activeCount !== 1 ? 's' : ''}</span>}
          {errorCount > 0 && <span className="badge badge-red">{errorCount} com erro</span>}
        </div>
        <button className="btn btn-sm btn-primary" onClick={() => setAddOpen(true)}>
          <Plus size={12} /> Nova conexão
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>
          <Loader2 size={14} className="animate-spin" /> Carregando conexões...
        </div>
      ) : connections.length === 0 ? (
        <div className="conn-empty">
          <WifiOff size={16} />
          <span>Nenhuma conexão Jira configurada. Adicione uma para criar projetos.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {connections.map(c => (
            <ConnectionRow key={c.id} conn={c} onCheck={handleCheck} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {addOpen && (
        <AddConnectionModal
          tenantId={tenantId}
          tenantName={tenantName}
          onClose={() => setAddOpen(false)}
          onSaved={reload}
        />
      )}
    </div>
  )
}

export default function SettingsPage() {
  const { tenants, loading: tenantsLoading } = useTenants()
  const [tab, setTab] = useState<'connections' | 'security' | 'about'>('connections')

  return (
    <div className="settings-page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <div>
          <h1>Configurações</h1>
          <p>Gerencie conexões Jira, segurança e preferências do sistema</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="filter-tabs" style={{ marginBottom: 24 }}>
        <button className={`filter-tab ${tab === 'connections' ? 'active' : ''}`} onClick={() => setTab('connections')}>
          <Wifi size={13} /> Conexões Jira
        </button>
        <button className={`filter-tab ${tab === 'security' ? 'active' : ''}`} onClick={() => setTab('security')}>
          <Shield size={13} /> Segurança
        </button>
        <button className={`filter-tab ${tab === 'about' ? 'active' : ''}`} onClick={() => setTab('about')}>
          <Server size={13} /> Sobre
        </button>
      </div>

      {/* Connections Tab */}
      {tab === 'connections' && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 4 }}>Conexões Jira por cliente</h3>
            <p style={{ fontSize: 13 }}>
              Cada cliente (tenant) pode ter múltiplas conexões Jira Cloud. As credenciais são criptografadas com AES-256-GCM.
            </p>
          </div>

          {tenantsLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
              <Loader2 size={14} className="animate-spin" /> Carregando clientes...
            </div>
          ) : tenants.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Building2 size={20} /></div>
              <div className="empty-title">Nenhum cliente cadastrado</div>
              <div className="empty-desc">Crie um cliente primeiro na página de Clientes para depois adicionar conexões Jira.</div>
              <a href="/clients" className="btn btn-primary"><Plus size={14} /> Ir para Clientes</a>
            </div>
          ) : (
            tenants.map(t => (
              <TenantConnectionsSection key={t.id} tenantId={t.id} tenantName={t.name} />
            ))
          )}

          <div className="card" style={{ marginTop: 20 }}>
            <h3 style={{ marginBottom: 8 }}>Como configurar uma conexão</h3>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <p><strong>1. API Token (recomendado)</strong></p>
              <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
                <li>Acesse <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener" style={{ color: 'var(--brand)' }}>id.atlassian.com/manage-profile/security</a></li>
                <li>Clique em "Create API token"</li>
                <li>Copie o token e cole na conexão junto com o email da conta</li>
                <li>O token é criptografado antes de ser salvo no banco</li>
              </ul>
              <p><strong>2. OAuth 2.0 (em breve)</strong></p>
              <ul style={{ paddingLeft: 20 }}>
                <li>Requer configuração de um Atlassian OAuth App</li>
                <li>Tokens são renovados automaticamente</li>
                <li>Ideal para ambientes com múltiplos usuários</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {tab === 'security' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={18} style={{ color: 'var(--brand)' }} />
              </div>
              <div>
                <h3>Criptografia de credenciais</h3>
                <p style={{ fontSize: 12 }}>Todas as credenciais Jira são criptografadas antes de salvar</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Algoritmo', value: 'AES-256-GCM' },
                { label: 'Derivação de chave', value: 'PBKDF2 (100k iter)' },
                { label: 'IV', value: 'Único por credencial' },
                { label: 'Chave mestra', value: 'Env var (server-only)' },
              ].map(item => (
                <div key={item.label} style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 8 }}>Row Level Security (RLS)</h3>
            <p style={{ fontSize: 13, marginBottom: 12 }}>
              O banco de dados Supabase usa RLS para isolar dados entre tenants.
              Apenas o service role (usado pelo backend Next.js) tem acesso total.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['tenants', 'tenant_users', 'jira_connections', 'templates', 'projects_created', 'automation_rules', 'automation_logs'].map(table => (
                <span key={table} className="badge badge-green"><Shield size={9} /> {table}</span>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 8 }}>API Interna</h3>
            <p style={{ fontSize: 13 }}>
              O endpoint <code>/api/connections/[id]/credentials</code> requer o header <code>x-internal-key</code> para acessar credenciais descriptografadas.
              Usado apenas pelo serviço de roll-up (Railway).
            </p>
          </div>
        </div>
      )}

      {/* About Tab */}
      {tab === 'about' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 12 }}>JiraForge</h3>
            <p style={{ fontSize: 13, marginBottom: 16 }}>
              Plataforma interna NTT DATA para configuração e criação de projetos Jira Cloud com suporte multi-tenant.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Versão', value: '0.1.0' },
                { label: 'Framework', value: 'Next.js 14' },
                { label: 'Banco de dados', value: 'Supabase (PostgreSQL)' },
                { label: 'Deploy', value: 'Vercel' },
                { label: 'Jira API', value: 'REST API 3.0' },
                { label: 'Roll-up Service', value: 'FastAPI (Railway)' },
              ].map(item => (
                <div key={item.label} style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 8 }}>Links úteis</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Repositório GitHub', url: 'https://github.com/ghcastellano/jiraforge' },
                { label: 'Supabase Dashboard', url: 'https://supabase.com/dashboard/project/ushisrvmgyixiievelgt' },
                { label: 'Vercel Dashboard', url: 'https://vercel.com/gustavos-projects-287c5dd3/jiraforge-complete' },
                { label: 'Atlassian API Docs', url: 'https://developer.atlassian.com/cloud/jira/platform/rest/v3/' },
              ].map(link => (
                <a key={link.label} href={link.url} target="_blank" rel="noopener" className="btn" style={{ justifyContent: 'flex-start' }}>
                  <ExternalLink size={13} /> {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
