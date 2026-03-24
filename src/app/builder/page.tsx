'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Check, ChevronRight, ChevronDown, Plus, Loader2, Zap,
  AlertTriangle, ExternalLink, RefreshCw, ArrowLeft, Rocket,
  Shield, Eye, Pencil,
} from 'lucide-react'
import { useTenants, useConnections, useTemplates } from '@/hooks'
import type {
  Template, TemplateConfig, IssueTypeConfig, CustomFieldConfig,
  WorkflowTransition,
} from '@/types'

// ─── Types ────────────────────────────────────────────────

type Step = { key: string; label: string }

const STEPS: Step[] = [
  { key: 'template', label: 'Template' },
  { key: 'client',   label: 'Cliente'  },
  { key: 'review',   label: 'Revisar'  },
  { key: 'deploy',   label: 'Deploy'   },
]

const CATEGORY_COLOR: Record<string, string> = {
  TODO: 'var(--text-muted)',
  IN_PROGRESS: 'var(--brand-light)',
  DONE: 'var(--green)',
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Texto', number: 'Numero', select: 'Select',
  multiselect: 'Multi-select', date: 'Data', user: 'Usuario',
  textarea: 'Textarea',
}

const FIELD_TYPE_ICONS: Record<string, string> = {
  text: '🔤', number: '🔢', select: '📋', date: '📅', user: '👤',
  multiselect: '📋', textarea: '📝',
}

// ─── Helpers ──────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

function inferCategory(name: string): 'TODO' | 'IN_PROGRESS' | 'DONE' {
  const lower = name.toLowerCase()
  if (lower.includes('done') || lower.includes('closed') || lower.includes('conclu')) return 'DONE'
  if (lower.includes('backlog') || lower.includes('todo') || lower.includes('aberto')) return 'TODO'
  return 'IN_PROGRESS'
}

// ─── Step Indicator ───────────────────────────────────────

function StepIndicator({ steps, current }: { steps: Step[]; current: number }) {
  return (
    <div className="step-indicator">
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={s.key} className="step-item">
            <div className={`step-dot ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
              {done ? <Check size={11} /> : <span>{i + 1}</span>}
            </div>
            <span className={`step-label ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div className={`step-line ${done ? 'done' : ''}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Section Toggle (for review/customize) ───────────────

function SectionToggle({
  title,
  count,
  customizing,
  onToggle,
  readOnlyContent,
  editContent,
}: {
  title: string
  count?: number
  customizing: boolean
  onToggle: (v: boolean) => void
  readOnlyContent: React.ReactNode
  editContent: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 10,
      marginBottom: 12,
      overflow: 'hidden',
    }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px',
          background: 'var(--bg-overlay)',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronDown
          size={14}
          style={{
            color: 'var(--text-muted)',
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.15s',
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
          {title}
          {count !== undefined && (
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>({count})</span>
          )}
        </span>
        <button
          className={`btn btn-sm ${customizing ? 'btn-primary' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggle(!customizing) }}
          style={{ fontSize: 11, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          {customizing ? <><Pencil size={10} /> Customizando</> : <><Eye size={10} /> Template</>}
        </button>
      </div>
      {expanded && (
        <div style={{ padding: '12px 16px' }}>
          {customizing ? editContent : readOnlyContent}
        </div>
      )}
    </div>
  )
}

// ─── Step 1: Selecionar Template ─────────────────────────

function StepSelectTemplate({
  selected,
  onSelect,
  templates,
  loading,
}: {
  selected: string
  onSelect: (id: string) => void
  templates: Template[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="step-content">
        <div className="step-header">
          <h3>Selecionar template</h3>
          <p>Carregando templates...</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--brand-light)' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="step-content">
      <div className="step-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3>Selecionar template</h3>
          <p>Reutilize um template existente — tudo pode ser ajustado no passo de revisao</p>
        </div>
        <Link href="/templates/new" className="btn btn-sm" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus size={12} /> Criar novo template
        </Link>
      </div>
      <div className="template-grid">
        {templates.map(t => {
          const isPremium = t.config?.hierarchy?.requiresPremium
          const issueCount = t.config?.issueTypes?.length ?? 0
          const fieldCount = t.config?.customFields?.length ?? 0
          return (
            <div
              key={t.id}
              className={`template-card ${selected === t.id ? 'selected' : ''}`}
              onClick={() => onSelect(t.id)}
            >
              <div className="template-icon">{t.icon || '📋'}</div>
              <div className="template-name">{t.name}</div>
              <div className="template-desc">{t.description || ''}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                {issueCount} issue type{issueCount !== 1 ? 's' : ''} · {fieldCount} campo{fieldCount !== 1 ? 's' : ''}
              </div>
              <div className="template-tags">
                {t.tags.map(tag => (
                  <span key={tag} className="badge badge-muted">{tag}</span>
                ))}
                {isPremium && <span className="badge badge-amber">Premium</span>}
              </div>
              {selected === t.id && (
                <div className="template-check"><Check size={12} /></div>
              )}
            </div>
          )
        })}
      </div>
      {templates.length === 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
          Nenhum template encontrado. <Link href="/templates/new" style={{ color: 'var(--brand-light)' }}>Crie um template</Link> para comecar.
        </div>
      )}
    </div>
  )
}

// ─── Step 2: Selecionar Cliente & Conexao ────────────────

function StepClientConnection({
  form,
  onChange,
  tenants,
  tenantsLoading,
  connections,
  connectionsLoading,
}: {
  form: { tenant_id: string; connection_id: string; project_name: string; project_key: string; description: string }
  onChange: (k: string, v: string) => void
  tenants: { id: string; name: string }[]
  tenantsLoading: boolean
  connections: { id: string; name: string; jira_base_url: string; is_premium: boolean; status: string }[]
  connectionsLoading: boolean
}) {
  const selectedConnection = connections.find(c => c.id === form.connection_id)

  return (
    <div className="step-content">
      <div className="step-header">
        <h3>Cliente &amp; Conexao</h3>
        <p>Selecione o cliente e a conexao Jira onde o projeto sera criado</p>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Cliente (tenant)</label>
          <select value={form.tenant_id} onChange={e => onChange('tenant_id', e.target.value)}>
            <option value="">Selecione o cliente...</option>
            {tenantsLoading && <option disabled>Carregando...</option>}
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Conexao Jira</label>
          <select
            value={form.connection_id}
            onChange={e => onChange('connection_id', e.target.value)}
            disabled={!form.tenant_id}
          >
            <option value="">Selecione a conexao...</option>
            {connectionsLoading && <option disabled>Carregando...</option>}
            {connections.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} {c.is_premium ? '(Premium)' : ''}
              </option>
            ))}
          </select>
          {selectedConnection && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <div style={{
                width: 8, height: 8, borderRadius: 4,
                background: selectedConnection.status === 'active' ? 'var(--green)' :
                             selectedConnection.status === 'error' ? 'var(--red)' : 'var(--text-muted)',
              }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {selectedConnection.status === 'active' ? 'Conectado' :
                 selectedConnection.status === 'error' ? 'Erro de conexao' :
                 selectedConnection.status === 'expired' ? 'Token expirado' : 'Pendente'}
              </span>
              {selectedConnection.is_premium && (
                <span className="badge badge-amber" style={{ fontSize: 10, padding: '1px 6px' }}>
                  <Shield size={9} style={{ marginRight: 2 }} /> Premium
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Nome do projeto</label>
        <input
          type="text" placeholder="ex: Autonomous Intelligence Platform"
          value={form.project_name}
          onChange={e => onChange('project_name', e.target.value)}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Chave (KEY)</label>
          <input
            type="text"
            placeholder="AIN"
            value={form.project_key}
            onChange={e => onChange('project_key', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
            style={{ fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.05em' }}
          />
          <span className="form-hint">Max. 10 chars, maiusculas, sem espacos</span>
        </div>
        <div className="form-group">
          <label className="form-label">Descricao <span style={{ color: 'var(--text-muted)' }}>(opcional)</span></label>
          <input
            type="text"
            placeholder="Breve descricao do projeto"
            value={form.description}
            onChange={e => onChange('description', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Step 3: Revisar & Customizar ────────────────────────

function StepReviewCustomize({
  template,
  overrides,
  customizing,
  setCustomizing,
  setOverrides,
}: {
  template: Template
  overrides: TemplateOverrides
  customizing: Record<string, boolean>
  setCustomizing: (s: Record<string, boolean>) => void
  setOverrides: (o: TemplateOverrides) => void
}) {
  const cfg = template.config

  // ── Hierarchy (read-only always from template) ──
  const hierarchyContent = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {cfg.hierarchy.levels.map((level, i, arr) => (
        <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="hier-pill">{level}</span>
          {i < arr.length - 1 && <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
        </div>
      ))}
      {cfg.hierarchy.requiresPremium && (
        <span className="badge badge-amber" style={{ marginLeft: 8, fontSize: 10 }}>
          <Shield size={9} /> Premium
        </span>
      )}
    </div>
  )

  // ── Issue Types ──
  const issueTypesData = customizing.issueTypes ? overrides.issueTypes : cfg.issueTypes
  const issueTypesReadOnly = (
    <div className="list-section">
      {cfg.issueTypes.map((it, i) => (
        <div key={i} className="list-row">
          <div className="it-icon" style={{ background: it.color + '22', border: `1px solid ${it.color}44` }}>
            <span style={{ fontSize: 14 }}>{it.icon}</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{it.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Nivel {it.level}</div>
          </div>
        </div>
      ))}
    </div>
  )
  const issueTypesEdit = (
    <div className="list-section">
      {overrides.issueTypes.map((it, idx) => (
        <div key={idx} className="list-row">
          <div className="it-icon" style={{ background: it.color + '22', border: `1px solid ${it.color}44` }}>
            <span style={{ fontSize: 14 }}>{it.icon}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              type="text" value={it.name}
              onChange={e => {
                const next = [...overrides.issueTypes]
                next[idx] = { ...next[idx], name: e.target.value }
                setOverrides({ ...overrides, issueTypes: next })
              }}
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', background: 'transparent', border: 'none', padding: 0, outline: 'none', width: '100%' }}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              Nivel
              <select
                value={it.level}
                onChange={e => {
                  const next = [...overrides.issueTypes]
                  next[idx] = { ...next[idx], level: parseInt(e.target.value) }
                  setOverrides({ ...overrides, issueTypes: next })
                }}
                style={{ fontSize: 11, padding: '1px 4px', background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)' }}
              >
                {[0, 1, 2, 3].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <button
            className="btn btn-icon btn-sm btn-ghost"
            onClick={() => {
              const next = overrides.issueTypes.filter((_, i) => i !== idx)
              setOverrides({ ...overrides, issueTypes: next })
            }}
          >
            <span style={{ color: 'var(--red)', fontSize: 12 }}>x</span>
          </button>
        </div>
      ))}
      <button
        className="btn btn-sm"
        style={{ marginTop: 8 }}
        onClick={() => setOverrides({
          ...overrides,
          issueTypes: [...overrides.issueTypes, { name: 'Novo tipo', level: 0, color: '#6366f1', icon: '📌' }],
        })}
      >
        <Plus size={12} /> Adicionar
      </button>
    </div>
  )

  // ── Custom Fields ──
  const fieldsReadOnly = (
    <div className="list-section">
      {cfg.customFields.map((f, i) => (
        <div key={i} className="list-row">
          <div style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 13 }}>{FIELD_TYPE_ICONS[f.type] ?? '📝'}</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              {f.name} {f.required && <span style={{ color: 'var(--red)', fontSize: 11 }}>*</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {FIELD_TYPE_LABELS[f.type] || f.type} · Escopo: {f.scope.length > 0 ? f.scope.join(', ') : 'Todos'}
            </div>
          </div>
        </div>
      ))}
      {cfg.customFields.length === 0 && (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Nenhum campo customizado no template.
        </div>
      )}
    </div>
  )
  const fieldsEdit = (
    <div className="list-section">
      {overrides.customFields.map((f, idx) => (
        <div key={idx} className="list-row">
          <div style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 13 }}>{FIELD_TYPE_ICONS[f.type] ?? '📝'}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="text" value={f.name}
                onChange={e => {
                  const next = [...overrides.customFields]
                  next[idx] = { ...next[idx], name: e.target.value }
                  setOverrides({ ...overrides, customFields: next })
                }}
                style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', background: 'transparent', border: 'none', padding: 0, outline: 'none' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
                <input
                  type="checkbox" checked={f.required}
                  onChange={e => {
                    const next = [...overrides.customFields]
                    next[idx] = { ...next[idx], required: e.target.checked }
                    setOverrides({ ...overrides, customFields: next })
                  }}
                  style={{ width: 12, height: 12 }}
                />
                <span style={{ color: f.required ? 'var(--red)' : 'var(--text-muted)' }}>obrigatorio</span>
              </label>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <select
                value={f.type}
                onChange={e => {
                  const next = [...overrides.customFields]
                  next[idx] = { ...next[idx], type: e.target.value as CustomFieldConfig['type'] }
                  setOverrides({ ...overrides, customFields: next })
                }}
                style={{ fontSize: 11, padding: '1px 4px', background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)' }}
              >
                {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            className="btn btn-icon btn-sm btn-ghost"
            onClick={() => {
              const next = overrides.customFields.filter((_, i) => i !== idx)
              setOverrides({ ...overrides, customFields: next })
            }}
          >
            <span style={{ color: 'var(--red)', fontSize: 12 }}>x</span>
          </button>
        </div>
      ))}
      <button
        className="btn btn-sm"
        style={{ marginTop: 8 }}
        onClick={() => setOverrides({
          ...overrides,
          customFields: [...overrides.customFields, { name: 'Novo campo', type: 'text', required: false, scope: [] }],
        })}
      >
        <Plus size={12} /> Adicionar
      </button>
    </div>
  )

  // ── Workflow ──
  const workflowStatuses = cfg.workflow.statuses
  const workflowTransitions = cfg.workflow.transitions
  const workflowReadOnly = (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Statuses ({workflowStatuses.length})
        </div>
        <div className="workflow-canvas">
          {workflowStatuses.map((name, i) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                className="status-bubble"
                style={{
                  borderColor: (CATEGORY_COLOR[inferCategory(name)] || 'var(--border)') + '60',
                  color: CATEGORY_COLOR[inferCategory(name)] || 'var(--text-muted)',
                }}
              >
                {name}
              </div>
              {i < workflowStatuses.length - 1 && (
                <div style={{ width: 24, height: 1, background: 'var(--border-light)', flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Transitions ({workflowTransitions.length})
        </div>
        <div className="list-section">
          {workflowTransitions.map((t, i) => (
            <div key={i} className="list-row">
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {t.from === '*' ? 'Qualquer' : t.from}
              </span>
              <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{t.to}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>({t.name})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
  const workflowEdit = (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Statuses ({overrides.workflowStatuses.length})
          </div>
          <button className="btn btn-sm" onClick={() => {
            const name = prompt('Nome do status:')
            if (!name) return
            setOverrides({
              ...overrides,
              workflowStatuses: [...overrides.workflowStatuses, name],
            })
          }}>
            <Plus size={12} /> Status
          </button>
        </div>
        <div className="workflow-canvas">
          {overrides.workflowStatuses.map((name, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                className="status-bubble"
                style={{
                  borderColor: (CATEGORY_COLOR[inferCategory(name)] || 'var(--border)') + '60',
                  color: CATEGORY_COLOR[inferCategory(name)] || 'var(--text-muted)',
                  position: 'relative',
                }}
              >
                {name}
                <button
                  onClick={() => {
                    const next = overrides.workflowStatuses.filter((_, idx) => idx !== i)
                    const nextTransitions = overrides.workflowTransitions.filter(t => t.from !== name && t.to !== name)
                    setOverrides({ ...overrides, workflowStatuses: next, workflowTransitions: nextTransitions })
                  }}
                  style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 14, height: 14, borderRadius: 7,
                    background: 'var(--red)', color: '#fff',
                    border: 'none', fontSize: 9, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1,
                  }}
                >x</button>
              </div>
              {i < overrides.workflowStatuses.length - 1 && (
                <div style={{ width: 24, height: 1, background: 'var(--border-light)', flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Transitions ({overrides.workflowTransitions.length})
          </div>
          <button
            className="btn btn-sm"
            onClick={() => {
              if (overrides.workflowStatuses.length < 2) return
              setOverrides({
                ...overrides,
                workflowTransitions: [...overrides.workflowTransitions, {
                  from: overrides.workflowStatuses[0],
                  to: overrides.workflowStatuses[1],
                  name: 'Nova transition',
                }],
              })
            }}
          >
            <Plus size={12} /> Transition
          </button>
        </div>
        <div className="list-section">
          {overrides.workflowTransitions.map((t, idx) => {
            const statusNames = ['*', ...overrides.workflowStatuses]
            return (
              <div key={idx} className="list-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                  <select
                    value={t.from}
                    onChange={e => {
                      const next = [...overrides.workflowTransitions]
                      next[idx] = { ...next[idx], from: e.target.value }
                      setOverrides({ ...overrides, workflowTransitions: next })
                    }}
                    style={{ fontSize: 12, padding: '2px 6px', background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 4 }}
                  >
                    {statusNames.map(n => <option key={n} value={n}>{n === '*' ? 'Qualquer' : n}</option>)}
                  </select>
                  <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
                  <select
                    value={t.to}
                    onChange={e => {
                      const next = [...overrides.workflowTransitions]
                      next[idx] = { ...next[idx], to: e.target.value }
                      setOverrides({ ...overrides, workflowTransitions: next })
                    }}
                    style={{ fontSize: 12, padding: '2px 6px', background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 4 }}
                  >
                    {overrides.workflowStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input
                    type="text" value={t.name}
                    onChange={e => {
                      const next = [...overrides.workflowTransitions]
                      next[idx] = { ...next[idx], name: e.target.value }
                      setOverrides({ ...overrides, workflowTransitions: next })
                    }}
                    style={{ fontSize: 12, color: 'var(--text-muted)', background: 'transparent', border: 'none', padding: 0, outline: 'none', width: 100 }}
                    placeholder="Nome..."
                  />
                </div>
                <button
                  className="btn btn-icon btn-sm btn-ghost"
                  onClick={() => {
                    const next = overrides.workflowTransitions.filter((_, i) => i !== idx)
                    setOverrides({ ...overrides, workflowTransitions: next })
                  }}
                >
                  <span style={{ color: 'var(--red)', fontSize: 12 }}>x</span>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  // ── Automations ──
  const automationsReadOnly = (
    <div className="list-section">
      {(cfg.automations ?? []).map((rule, i) => (
        <div key={i} className="list-row">
          <Zap size={14} style={{ color: 'var(--brand-light)' }} />
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{rule}</span>
        </div>
      ))}
      {(!cfg.automations || cfg.automations.length === 0) && (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Nenhuma automacao configurada no template.
        </div>
      )}
    </div>
  )

  return (
    <div className="step-content">
      <div className="step-header">
        <h3>Revisar &amp; Customizar</h3>
        <p>Por padrao tudo vem do template <strong>{template.name}</strong>. Clique em &ldquo;Customizar&rdquo; para ajustar por secao.</p>
      </div>

      {/* Hierarchy — always read-only from template */}
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 10,
        marginBottom: 12,
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px',
          background: 'var(--bg-overlay)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
            Hierarquia
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>({cfg.hierarchy.levels.length} niveis)</span>
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Definido pelo template</span>
        </div>
        <div style={{ padding: '12px 16px' }}>
          {hierarchyContent}
        </div>
      </div>

      <SectionToggle
        title="Issue Types"
        count={issueTypesData.length}
        customizing={!!customizing.issueTypes}
        onToggle={v => setCustomizing({ ...customizing, issueTypes: v })}
        readOnlyContent={issueTypesReadOnly}
        editContent={issueTypesEdit}
      />

      <SectionToggle
        title="Custom Fields"
        count={(customizing.customFields ? overrides.customFields : cfg.customFields).length}
        customizing={!!customizing.customFields}
        onToggle={v => setCustomizing({ ...customizing, customFields: v })}
        readOnlyContent={fieldsReadOnly}
        editContent={fieldsEdit}
      />

      <SectionToggle
        title="Workflow"
        count={undefined}
        customizing={!!customizing.workflow}
        onToggle={v => setCustomizing({ ...customizing, workflow: v })}
        readOnlyContent={workflowReadOnly}
        editContent={workflowEdit}
      />

      <SectionToggle
        title="Automacoes"
        count={(cfg.automations ?? []).length}
        customizing={false}
        onToggle={() => {}}
        readOnlyContent={automationsReadOnly}
        editContent={automationsReadOnly}
      />
    </div>
  )
}

// ─── Step 4: Deploy ──────────────────────────────────────

interface DeployResult {
  success: boolean
  jira_project_url?: string
  jira_project_id?: string
  project_record_id?: string
  steps?: { key: string; label: string; status: string; error?: string }[]
  error?: string
}

const DEPLOY_STEP_LABELS: Record<string, string> = {
  project: 'Criando projeto',
  issue_types: 'Criando issue types',
  hierarchy: 'Configurando hierarquia',
  workflow: 'Configurando workflow',
  fields: 'Criando custom fields',
  screens: 'Configurando screens',
  schemes: 'Aplicando schemes',
}

function StepDeploy({
  template,
  form,
  overrides,
  customizing,
  onDeploy,
  deploying,
  deployResult,
  deployError,
  jiraBaseUrl,
}: {
  template: Template
  form: { project_name: string; project_key: string; description: string; tenant_id: string; connection_id: string }
  overrides: TemplateOverrides
  customizing: Record<string, boolean>
  onDeploy: () => void
  deploying: boolean
  deployResult: DeployResult | null
  deployError: string | null
  jiraBaseUrl: string
}) {
  const cfg = template.config
  const finalIssueTypes = customizing.issueTypes ? overrides.issueTypes : cfg.issueTypes
  const finalFields = customizing.customFields ? overrides.customFields : cfg.customFields
  const finalStatuses = customizing.workflow ? overrides.workflowStatuses : cfg.workflow.statuses
  const finalTransitions = customizing.workflow ? overrides.workflowTransitions : cfg.workflow.transitions

  return (
    <div className="step-content">
      <div className="step-header">
        <h3>Deploy</h3>
        <p>Tudo pronto para criar no Jira Cloud</p>
      </div>

      {!deploying && !deployResult && !deployError && (
        <>
          <div className="review-grid">
            <div className="review-block">
              <div className="review-block-title">Template</div>
              <div className="review-item"><div className="dot blue" />{template.icon || '📋'} {template.name}</div>
            </div>
            <div className="review-block">
              <div className="review-block-title">Projeto</div>
              <div className="review-item"><div className="dot blue" />{form.project_name || '(sem nome)'}</div>
              <div className="review-item"><div className="dot blue" /><code>{form.project_key || 'KEY'}</code> - Scrum</div>
              {cfg.hierarchy.requiresPremium && (
                <div className="review-item"><div className="dot blue" />Advanced Roadmaps ativado</div>
              )}
            </div>
            <div className="review-block">
              <div className="review-block-title">
                Issue types ({finalIssueTypes.length})
                {customizing.issueTypes && <span style={{ fontSize: 10, color: 'var(--brand-light)', marginLeft: 6 }}>customizado</span>}
              </div>
              {finalIssueTypes.length > 0 && (
                <div className="review-item"><div className="dot purple" />{finalIssueTypes.map(t => t.name).join(', ')}</div>
              )}
            </div>
            <div className="review-block">
              <div className="review-block-title">
                Custom fields ({finalFields.length})
                {customizing.customFields && <span style={{ fontSize: 10, color: 'var(--brand-light)', marginLeft: 6 }}>customizado</span>}
              </div>
              {finalFields.length > 0 && (
                <div className="review-item"><div className="dot green" />{finalFields.map(f => f.name).join(' - ')}</div>
              )}
            </div>
            <div className="review-block">
              <div className="review-block-title">
                Workflow ({finalStatuses.length} statuses, {finalTransitions.length} transitions)
                {customizing.workflow && <span style={{ fontSize: 10, color: 'var(--brand-light)', marginLeft: 6 }}>customizado</span>}
              </div>
              {finalStatuses.length > 0 && (
                <div className="review-item"><div className="dot blue" />{finalStatuses.join(' -> ')}</div>
              )}
            </div>
          </div>

          <div className="api-note">
            <Zap size={13} style={{ color: 'var(--brand-light)', flexShrink: 0 }} />
            <span>Serao executadas ~13 chamadas a Jira API em sequencia. O processo leva cerca de 15-30 segundos.</span>
          </div>

          <button className="deploy-btn" onClick={onDeploy}>
            <Rocket size={16} /> Criar projeto no Jira Cloud
          </button>
        </>
      )}

      {deploying && (
        <div className="deploy-progress">
          {(deployResult?.steps ?? Object.keys(DEPLOY_STEP_LABELS).map(key => ({ key, label: DEPLOY_STEP_LABELS[key], status: 'pending' }))).map((step) => {
            const s = typeof step === 'object' && 'status' in step ? step : { key: step, label: DEPLOY_STEP_LABELS[(step as { key: string }).key] || '', status: 'pending' }
            return (
              <div key={s.key} className="progress-step">
                <div className="progress-dot">
                  {s.status === 'done' ? <Check size={12} style={{ color: 'var(--green)' }} />
                   : s.status === 'in_progress' ? <Loader2 size={13} className="animate-spin" style={{ color: 'var(--brand-light)' }} />
                   : s.status === 'error' ? <AlertTriangle size={12} style={{ color: 'var(--red)' }} />
                   : <div style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--bg-overlay)', border: '1px solid var(--border)' }} />}
                </div>
                <span style={{ fontSize: 13, color: s.status !== 'pending' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {s.label || DEPLOY_STEP_LABELS[s.key] || s.key}
                </span>
              </div>
            )
          })}
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
            <Loader2 size={14} className="animate-spin" /> Executando deploy...
          </div>
        </div>
      )}

      {deployResult && !deploying && (
        <div className={`deploy-result ${deployResult.success ? 'success' : 'error'}`}>
          {deployResult.success ? (
            <>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--green)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Check size={18} /> Projeto criado com sucesso!
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                O projeto <code>{form.project_key}</code> foi criado no Jira com todos os issue types, custom fields, workflow e schemes configurados.
              </div>
              {(deployResult.jira_project_url || jiraBaseUrl) && (
                <a
                  href={deployResult.jira_project_url || `${jiraBaseUrl}/browse/${form.project_key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm"
                  style={{ marginTop: 12, textDecoration: 'none' }}
                >
                  <ExternalLink size={12} /> Abrir no Jira
                </a>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--red)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} /> Erro durante o deploy
              </div>
              {deployResult.error && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontFamily: 'var(--font-mono, monospace)' }}>
                  {deployResult.error}
                </div>
              )}
              {deployResult.steps && (
                <div style={{ fontSize: 12, marginBottom: 8 }}>
                  {deployResult.steps.filter(s => s.status === 'error').map(s => (
                    <div key={s.key} style={{ color: 'var(--red)' }}>
                      {s.label}: {s.error || 'falhou'}
                    </div>
                  ))}
                </div>
              )}
              <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={onDeploy}>
                <RefreshCw size={12} /> Tentar novamente
              </button>
            </>
          )}
        </div>
      )}

      {deployError && !deploying && !deployResult && (
        <div className="deploy-result error">
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--red)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} /> Erro de conexao
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{deployError}</div>
          <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={onDeploy}>
            <RefreshCw size={12} /> Tentar novamente
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Override State Type ─────────────────────────────────

interface TemplateOverrides {
  issueTypes: IssueTypeConfig[]
  customFields: CustomFieldConfig[]
  workflowStatuses: string[]
  workflowTransitions: WorkflowTransition[]
}

// ─── Inner Page (needs useSearchParams inside Suspense) ──

function BuilderPageInner() {
  const searchParams = useSearchParams()
  const templateParam = searchParams.get('template')

  // ─── API hooks ──────────────────────────────────────────
  const { tenants, loading: tenantsLoading } = useTenants()
  const { templates, loading: templatesLoading } = useTemplates()

  // ─── Wizard state ───────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedTemplate, setSelectedTemplate] = useState('')

  const [form, setForm] = useState({
    tenant_id: '', connection_id: '',
    project_name: '', project_key: '', description: '',
  })

  // Overrides: local editable copy of template config sections
  const [overrides, setOverrides] = useState<TemplateOverrides>({
    issueTypes: [],
    customFields: [],
    workflowStatuses: [],
    workflowTransitions: [],
  })

  // Which sections are being customized (overridden)
  const [customizing, setCustomizing] = useState<Record<string, boolean>>({
    issueTypes: false,
    customFields: false,
    workflow: false,
  })

  const [deploying, setDeploying] = useState(false)
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null)
  const [deployError, setDeployError] = useState<string | null>(null)

  // ─── Connection hook depends on selected tenant ─────────
  const { connections, loading: connectionsLoading } = useConnections(form.tenant_id || null)

  // ─── Resolve selected template object ───────────────────
  const template = templates.find(t => t.id === selectedTemplate) ?? null

  // ─── Auto-select template from URL param ────────────────
  useEffect(() => {
    if (templateParam && templates.length > 0 && !selectedTemplate) {
      const found = templates.find(t => t.id === templateParam)
      if (found) {
        setSelectedTemplate(found.id)
        initOverrides(found)
      }
    }
  }, [templateParam, templates]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Initialize overrides from template config ──────────
  const initOverrides = useCallback((tmpl: Template) => {
    const cfg = tmpl.config
    if (!cfg) return
    setOverrides({
      issueTypes: cfg.issueTypes ? [...cfg.issueTypes] : [],
      customFields: cfg.customFields ? [...cfg.customFields] : [],
      workflowStatuses: cfg.workflow?.statuses ? [...cfg.workflow.statuses] : [],
      workflowTransitions: cfg.workflow?.transitions ? [...cfg.workflow.transitions] : [],
    })
    // Reset all customizing flags
    setCustomizing({ issueTypes: false, customFields: false, workflow: false })
  }, [])

  // ─── Handle template selection ──────────────────────────
  const handleSelectTemplate = (id: string) => {
    setSelectedTemplate(id)
    const tmpl = templates.find(t => t.id === id)
    if (tmpl) {
      initOverrides(tmpl)
    }
  }

  // ─── Reset connection when tenant changes ───────────────
  useEffect(() => {
    setForm(f => ({ ...f, connection_id: '' }))
  }, [form.tenant_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateForm = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // ─── Resolve selected connection's jira_base_url ────────
  const selectedConnection = connections.find(c => c.id === form.connection_id)
  const jiraBaseUrl = selectedConnection?.jira_base_url || ''

  const canProceed = () => {
    if (currentStep === 0) return !!selectedTemplate
    if (currentStep === 1) return !!form.project_name && !!form.project_key && !!form.tenant_id && !!form.connection_id
    if (currentStep === 2) return !!template
    return true
  }

  // ─── Build final payload resolving overrides ────────────
  const buildPayload = () => {
    if (!template) return null
    const cfg = template.config

    const finalIssueTypes = customizing.issueTypes ? overrides.issueTypes : cfg.issueTypes
    const finalFields = customizing.customFields ? overrides.customFields : cfg.customFields
    const finalStatuses = customizing.workflow ? overrides.workflowStatuses : cfg.workflow.statuses
    const finalTransitions = customizing.workflow ? overrides.workflowTransitions : cfg.workflow.transitions

    return {
      tenant_id: form.tenant_id,
      jira_connection_id: form.connection_id,
      template_id: template.id,
      project_name: form.project_name,
      project_key: form.project_key,
      project_type: 'scrum',
      description: form.description,
      issueTypes: finalIssueTypes,
      customFields: finalFields,
      workflow: {
        statuses: finalStatuses,
        transitions: finalTransitions,
      },
      schemes: {
        screenScheme: 'auto',
        permissionScheme: cfg.schemes?.permissionScheme || 'default',
        notificationScheme: cfg.schemes?.notificationScheme || 'default',
        fieldConfiguration: 'auto',
      },
      hierarchy: cfg.hierarchy,
      created_by: 'ntt-data-user',
    }
  }

  // ─── Deploy ─────────────────────────────────────────────
  const handleDeploy = async () => {
    const payload = buildPayload()
    if (!payload) return

    setDeploying(true)
    setDeployResult(null)
    setDeployError(null)

    try {
      const res = await fetch('/api/projects/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok) {
        setDeployError(json.error || `HTTP ${res.status}`)
        setDeploying(false)
        return
      }

      setDeployResult(json.data as DeployResult)
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : 'Erro de rede')
    } finally {
      setDeploying(false)
    }
  }

  // ─── Render step ────────────────────────────────────────
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <StepSelectTemplate
            selected={selectedTemplate}
            onSelect={handleSelectTemplate}
            templates={templates}
            loading={templatesLoading}
          />
        )
      case 1:
        return (
          <StepClientConnection
            form={form}
            onChange={updateForm}
            tenants={tenants}
            tenantsLoading={tenantsLoading}
            connections={connections}
            connectionsLoading={connectionsLoading}
          />
        )
      case 2:
        return template ? (
          <StepReviewCustomize
            template={template}
            overrides={overrides}
            customizing={customizing}
            setCustomizing={setCustomizing}
            setOverrides={setOverrides}
          />
        ) : (
          <div className="step-content">
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
              Nenhum template selecionado. Volte ao passo 1.
            </div>
          </div>
        )
      case 3:
        return template ? (
          <StepDeploy
            template={template}
            form={form}
            overrides={overrides}
            customizing={customizing}
            onDeploy={handleDeploy}
            deploying={deploying}
            deployResult={deployResult}
            deployError={deployError}
            jiraBaseUrl={jiraBaseUrl}
          />
        ) : null
      default:
        return null
    }
  }

  return (
    <div className="builder-page">
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div>
          <h1>Novo projeto</h1>
          <p>Selecione um template, escolha o cliente, revise e crie no Jira</p>
        </div>
      </div>

      <div className="builder-layout">
        <StepIndicator steps={STEPS} current={currentStep} />

        <div className="builder-card">
          {renderStep()}

          {!deploying && !deployResult && (
            <div className="builder-footer">
              <button
                className="btn"
                onClick={() => setCurrentStep(s => s - 1)}
                disabled={currentStep === 0}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <ArrowLeft size={14} /> Voltar
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {currentStep + 1} / {STEPS.length}
              </span>
              {currentStep < STEPS.length - 1 && (
                <button
                  className="btn btn-primary"
                  onClick={() => setCurrentStep(s => s + 1)}
                  disabled={!canProceed()}
                >
                  Proximo <ChevronRight size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page (wraps inner in Suspense for useSearchParams) ──

export default function BuilderPage() {
  return (
    <Suspense fallback={
      <div className="builder-page">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--brand-light)' }} />
        </div>
      </div>
    }>
      <BuilderPageInner />
    </Suspense>
  )
}
