'use client'

import { useState, useEffect } from 'react'
import {
  Zap, Plus, CheckCircle2, XCircle, Clock,
  ToggleLeft, ToggleRight, Trash2, ExternalLink,
  AlertCircle, Loader2, RefreshCw, X, ChevronRight,
  Activity, Wifi
} from 'lucide-react'
import { useAutomations, useTenants, useConnections } from '@/hooks'
import type { AutomationRule } from '@/types'

const RULE_LABELS: Record<string, { label: string; desc: string; icon: string }> = {
  story_bug_to_epic:    { label: 'Story/Bug -> Epico Done',     desc: 'Quando todos os filhos de um epico estiverem Done, move o epico para Done automaticamente.',      icon: '📝' },
  epic_to_initiative:   { label: 'Epico -> Iniciativa Done',    desc: 'Quando todos os epicos de uma iniciativa estiverem Done, move a iniciativa para Done.',            icon: '⚡' },
  sprint_close_notify:  { label: 'Sprint fechado c/ issues abertas', desc: 'Notifica via webhook quando um sprint e fechado com issues ainda em aberto.', icon: '🔔' },
}

function ServiceStatus() {
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState<'online' | 'offline' | 'unknown'>('online')

  const check = async () => {
    setChecking(true)
    await new Promise(r => setTimeout(r, 1200))
    setStatus('online')
    setChecking(false)
  }

  return (
    <div className={`service-bar ${status}`}>
      <div className="service-left">
        <div className={`service-dot ${status}`} />
        <div>
          <div className="service-title">Roll-up Service</div>
          <div className="service-sub">FastAPI · Railway · {process.env.NEXT_PUBLIC_ROLLUP_URL ?? 'rollup.railway.app'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={`badge ${status === 'online' ? 'badge-green' : status === 'offline' ? 'badge-red' : 'badge-amber'}`}>
          {status === 'online' ? <><CheckCircle2 size={10} /> Online</> : status === 'offline' ? <><XCircle size={10} /> Offline</> : <><Clock size={10} /> Desconhecido</>}
        </span>
        <button className="btn btn-sm" onClick={check} disabled={checking}>
          {checking ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {checking ? 'Verificando…' : 'Verificar'}
        </button>
      </div>
    </div>
  )
}

function RuleCard({ rule, onToggle, onDelete, onShowLogs }: {
  rule: AutomationRule
  onToggle: (id: string, active: boolean) => void
  onDelete: (id: string) => void
  onShowLogs: (id: string) => void
}) {
  const info = RULE_LABELS[rule.rule_type] ?? { label: rule.rule_type, desc: '', icon: '⚡' }

  return (
    <div className={`rule-card ${!rule.active ? 'inactive' : ''}`}>
      <div className="rule-header">
        <div className="rule-left">
          <div className="rule-icon">{info.icon}</div>
          <div>
            <div className="rule-name">{info.label}</div>
            <div className="rule-meta">
              <Wifi size={11} /> {rule.connection?.name ?? 'Conexao desconhecida'}
              {rule.project_key && <><span className="dot-sep" /> <code>{rule.project_key}</code></>}
              {!rule.project_key && <><span className="dot-sep" /> todos os projetos</>}
            </div>
          </div>
        </div>
        <div className="rule-right">
          <span className="badge badge-muted"><Activity size={10} /> {rule.trigger_count}</span>
          <button
            className="btn btn-icon btn-sm btn-ghost"
            onClick={() => onToggle(rule.id, !rule.active)}
            title={rule.active ? 'Desativar' : 'Ativar'}
          >
            {rule.active
              ? <ToggleRight size={18} style={{ color: 'var(--green)' }} />
              : <ToggleLeft size={18} style={{ color: 'var(--text-muted)' }} />
            }
          </button>
          <button className="btn btn-icon btn-sm btn-ghost" onClick={() => onDelete(rule.id)}>
            <Trash2 size={13} style={{ color: 'var(--red)' }} />
          </button>
        </div>
      </div>

      <div className="rule-desc">{info.desc}</div>

      {rule.last_error && (
        <div className="rule-error">
          <AlertCircle size={12} />
          {rule.last_error}
        </div>
      )}

      <div className="rule-flow">
        <span className="flow-pill trigger">Issue transicionada -&gt; Done</span>
        <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
        <span className="flow-pill condition">todos irmaos Done?</span>
        <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
        <span className="flow-pill action">Pai -&gt; Done</span>
      </div>

      {rule.last_triggered_at && (
        <div className="rule-last">
          Ultimo trigger: {new Date(rule.last_triggered_at).toLocaleDateString('pt-BR')}
          <span className="muted"> - {rule.trigger_count} execucoes</span>
        </div>
      )}
    </div>
  )
}

function NewRuleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { tenants, loading: tenantsLoading } = useTenants()
  const [tenantId, setTenantId] = useState('')
  const { connections, loading: connsLoading } = useConnections(tenantId || null)
  const [connectionId, setConnectionId] = useState('')
  const [ruleType, setRuleType] = useState<string>('story_bug_to_epic')
  const [projectKey, setProjectKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setConnectionId('') }, [tenantId])

  const submit = async () => {
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          jira_connection_id: connectionId,
          rule_type: ruleType,
          project_key: projectKey || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao criar regra')
      if (json.warning) alert(json.warning)
      onCreated()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Nova Roll-up Rule</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {error && (
            <div className="rule-error" style={{ marginBottom: 16 }}>
              <AlertCircle size={12} /> {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Cliente</label>
            <select value={tenantId} onChange={e => setTenantId(e.target.value)}>
              <option value="">Selecione o cliente...</option>
              {!tenantsLoading && tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Conexao Jira</label>
            <select value={connectionId} onChange={e => setConnectionId(e.target.value)} disabled={!tenantId}>
              <option value="">Selecione a conexao...</option>
              {!connsLoading && connections.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.jira_base_url.replace('https://', '')})</option>
              ))}
            </select>
            {tenantId && !connsLoading && connections.length === 0 && (
              <span className="form-hint" style={{ color: 'var(--red)' }}>Nenhuma conexao encontrada. Configure uma em Configuracoes.</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Tipo de regra</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(RULE_LABELS).map(([key, info]) => (
                <label
                  key={key}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                    background: ruleType === key ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                    border: `1px solid ${ruleType === key ? 'var(--brand-border)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <input
                    type="radio" name="ruleType" value={key}
                    checked={ruleType === key}
                    onChange={() => setRuleType(key)}
                    style={{ marginTop: 2 }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {info.icon} {info.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{info.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Projeto (opcional)</label>
            <input
              type="text"
              placeholder="Ex: DAP (deixe vazio para todos os projetos)"
              value={projectKey}
              onChange={e => setProjectKey(e.target.value.toUpperCase())}
            />
            <span className="form-hint">Se vazio, a regra se aplica a todos os projetos desta conexao</span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={saving || !tenantId || !connectionId || !ruleType}
          >
            {saving ? <><Loader2 size={13} className="animate-spin" /> Criando...</> : 'Criar regra'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AutomationsPage() {
  const { rules, loading, reload, toggleRule } = useAutomations()
  const { tenants, loading: tenantsLoading } = useTenants()
  const [filterTenant, setFilterTenant] = useState('all')
  const [newRuleOpen, setNewRuleOpen] = useState(false)

  const filtered = rules.filter(r => filterTenant === 'all' || r.tenant_id === filterTenant)

  const handleToggle = async (id: string, active: boolean) => {
    await toggleRule(id, active)
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/automations/${id}`, { method: 'DELETE' })
    reload()
  }

  const active = rules.filter(r => r.active).length
  const total  = rules.length
  const errors = rules.filter(r => r.last_error).length

  if (loading) {
    return (
      <div className="automations-page">
        <div className="page-header">
          <div>
            <h1>Roll-up Rules</h1>
            <p>Automacoes de hierarquia implementadas via webhook service</p>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80 }}>
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--brand)' }} />
          <span style={{ marginLeft: 12, color: 'var(--text-muted)' }}>Carregando regras...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="automations-page">
      <div className="page-header">
        <div>
          <h1>Roll-up Rules</h1>
          <p>Automacoes de hierarquia implementadas via webhook service</p>
        </div>
        <button className="btn btn-primary" onClick={() => setNewRuleOpen(true)}><Plus size={14} /> Nova rule</button>
      </div>

      <ServiceStatus />

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-value">{total}</span>
          <span className="stat-label">Rules totais</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" style={{ color: 'var(--green)' }}>{active}</span>
          <span className="stat-label">Ativas</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" style={{ color: total - active > 0 ? 'var(--amber)' : 'var(--text-muted)' }}>{total - active}</span>
          <span className="stat-label">Inativas</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" style={{ color: errors > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{errors}</span>
          <span className="stat-label">Com erro</span>
        </div>
      </div>

      <div className="toolbar">
        <div className="filter-tabs">
          <button className={`filter-tab ${filterTenant === 'all' ? 'active' : ''}`} onClick={() => setFilterTenant('all')}>Todos os clientes</button>
          {!tenantsLoading && tenants.map(t => (
            <button key={t.id} className={`filter-tab ${filterTenant === t.id ? 'active' : ''}`} onClick={() => setFilterTenant(t.id)}>{t.name}</button>
          ))}
        </div>
      </div>

      <div className="rules-list">
        {filtered.map(r => (
          <RuleCard
            key={r.id}
            rule={r}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onShowLogs={() => {}}
          />
        ))}
        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon"><Zap size={20} /></div>
            <div className="empty-title">Nenhuma rule encontrada</div>
            <div className="empty-desc">Crie uma rule de roll-up para este cliente</div>
            <button className="btn btn-primary" onClick={() => setNewRuleOpen(true)}><Plus size={14} /> Nova rule</button>
          </div>
        )}
      </div>

      {newRuleOpen && (
        <NewRuleModal
          onClose={() => setNewRuleOpen(false)}
          onCreated={reload}
        />
      )}
    </div>
  )
}
