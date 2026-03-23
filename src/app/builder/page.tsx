'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Check, ChevronRight, Plus, Trash2, GripVertical,
  Loader2, Zap, AlertTriangle, ExternalLink, RefreshCw,
  ArrowLeft, Rocket, Shield
} from 'lucide-react'
import { useTenants, useConnections, useTemplates } from '@/hooks'
import type {
  Template, IssueTypeConfig, CustomFieldConfig,
  WorkflowStatus, WorkflowTransition,
} from '@/types'

// ─── Types ────────────────────────────────────────────────

type Step = { key: string; label: string }

const STEPS: Step[] = [
  { key: 'template',    label: 'Template'    },
  { key: 'project',     label: 'Projeto'     },
  { key: 'issuetypes',  label: 'Issue Types' },
  { key: 'fields',      label: 'Fields'      },
  { key: 'workflow',    label: 'Workflow'     },
  { key: 'schemes',     label: 'Schemes'     },
  { key: 'review',      label: 'Review'      },
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

// ─── Step 1: Template ─────────────────────────────────────

function StepTemplate({
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
          <h3>Escolha um template</h3>
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
      <div className="step-header">
        <h3>Escolha um template</h3>
        <p>Ponto de partida — tudo pode ser customizado nos proximos steps</p>
      </div>
      <div className="template-grid">
        {templates.map(t => {
          const isPremium = t.config?.hierarchy?.requiresPremium
          return (
            <div
              key={t.id}
              className={`template-card ${selected === t.id ? 'selected' : ''}`}
              onClick={() => onSelect(t.id)}
            >
              <div className="template-icon">{t.icon || '📋'}</div>
              <div className="template-name">{t.name}</div>
              <div className="template-desc">{t.description || ''}</div>
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
          Nenhum template encontrado. Crie um na pagina de Templates.
        </div>
      )}
    </div>
  )
}

// ─── Step 2: Project ──────────────────────────────────────

function StepProject({
  form,
  onChange,
  tenants,
  tenantsLoading,
  connections,
  connectionsLoading,
  enableAdvancedRoadmaps,
  onToggleAdvancedRoadmaps,
}: {
  form: Record<string, string>
  onChange: (k: string, v: string) => void
  tenants: { id: string; name: string }[]
  tenantsLoading: boolean
  connections: { id: string; name: string; jira_base_url: string; is_premium: boolean }[]
  connectionsLoading: boolean
  enableAdvancedRoadmaps: boolean
  onToggleAdvancedRoadmaps: (v: boolean) => void
}) {
  const selectedConnection = connections.find(c => c.id === form.connection_id)

  return (
    <div className="step-content">
      <div className="step-header">
        <h3>Dados do projeto</h3>
        <p>Informacoes basicas que serao enviadas para o Jira</p>
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
          {selectedConnection && !selectedConnection.is_premium && enableAdvancedRoadmaps && (
            <span className="form-hint" style={{ color: 'var(--red)' }}>
              Advanced Roadmaps requer Jira Premium
            </span>
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
          <label className="form-label">Tipo de projeto</label>
          <div
            className={`scheme-row ${enableAdvancedRoadmaps ? 'selected' : ''}`}
            onClick={() => onToggleAdvancedRoadmaps(!enableAdvancedRoadmaps)}
            style={{
              cursor: 'pointer',
              padding: '10px 14px',
              border: enableAdvancedRoadmaps ? '1px solid var(--brand-light)' : '1px solid var(--border)',
              borderRadius: 8,
              background: enableAdvancedRoadmaps ? 'var(--brand-light)08' : 'transparent',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={16} style={{ color: enableAdvancedRoadmaps ? 'var(--brand-light)' : 'var(--text-muted)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                  Advanced Roadmaps (Premium)
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Hierarquia 3 niveis com Scrum
                </div>
              </div>
              <div style={{
                width: 18, height: 18, borderRadius: 4,
                border: enableAdvancedRoadmaps ? '2px solid var(--brand-light)' : '2px solid var(--border)',
                background: enableAdvancedRoadmaps ? 'var(--brand-light)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {enableAdvancedRoadmaps && <Check size={11} style={{ color: '#fff' }} />}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Descricao <span style={{ color: 'var(--text-muted)' }}>(opcional)</span></label>
        <textarea
          placeholder="Breve descricao do projeto"
          value={form.description}
          onChange={e => onChange('description', e.target.value)}
          style={{ height: 72 }}
        />
      </div>

      {enableAdvancedRoadmaps && (
        <div className="form-group">
          <label className="form-label">Hierarquia (Advanced Roadmaps)</label>
          <div className="hierarchy-row">
            {['Iniciativa', 'Epico', 'US / Bug', 'Subtask'].map((level, i, arr) => (
              <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="hier-pill">{level}</span>
                {i < arr.length - 1 && <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Step 3: Issue Types ──────────────────────────────────

function StepIssueTypes({ types, setTypes }: {
  types: (IssueTypeConfig & { id: string })[]
  setTypes: (t: (IssueTypeConfig & { id: string })[]) => void
}) {
  const addIssueType = () => {
    setTypes([...types, {
      id: generateId(),
      name: 'Novo tipo',
      level: 0,
      color: '#6366f1',
      icon: '📌',
    }])
  }

  const removeIssueType = (id: string) => {
    setTypes(types.filter(t => t.id !== id))
  }

  const updateIssueType = (id: string, field: string, value: string | number) => {
    setTypes(types.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  const levelLabel = (level: number) => {
    if (level >= 3) return 'Roadmaps'
    if (level === 0) return 'Sistema'
    return 'Padrao'
  }

  return (
    <div className="step-content">
      <div className="step-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3>Issue types</h3>
          <p>Hierarquia completa para Advanced Roadmaps</p>
        </div>
        <button className="btn btn-sm btn-primary" onClick={addIssueType}>
          <Plus size={12} /> Adicionar
        </button>
      </div>

      <div className="list-section">
        {types.map((it) => (
          <div key={it.id} className="list-row">
            <GripVertical size={14} style={{ color: 'var(--text-muted)', cursor: 'grab', flexShrink: 0 }} />
            <div className="it-icon" style={{ background: it.color + '22', border: `1px solid ${it.color}44` }}>
              <span style={{ fontSize: 14 }}>{it.icon}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                type="text"
                value={it.name}
                onChange={e => updateIssueType(it.id, 'name', e.target.value)}
                style={{
                  fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                  background: 'transparent', border: 'none', padding: 0,
                  outline: 'none', width: '100%',
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                Nivel
                <select
                  value={it.level}
                  onChange={e => updateIssueType(it.id, 'level', parseInt(e.target.value))}
                  style={{ fontSize: 11, padding: '1px 4px', background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)' }}
                >
                  {[0, 1, 2, 3].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <span className={`badge ${levelLabel(it.level) === 'Roadmaps' ? 'badge-amber' : levelLabel(it.level) === 'Sistema' ? 'badge-green' : 'badge-brand'}`}>
              {levelLabel(it.level)}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-icon btn-sm btn-ghost" onClick={() => removeIssueType(it.id)}>
                <Trash2 size={12} style={{ color: 'var(--red)' }} />
              </button>
            </div>
          </div>
        ))}
        {types.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Nenhum issue type configurado. Clique em Adicionar.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Step 4: Custom Fields ────────────────────────────────

function StepFields({ fields, setFields, issueTypeNames }: {
  fields: (CustomFieldConfig & { id: string })[]
  setFields: (f: (CustomFieldConfig & { id: string })[]) => void
  issueTypeNames: string[]
}) {
  const addField = () => {
    setFields([...fields, {
      id: generateId(),
      name: 'Novo campo',
      type: 'text',
      required: false,
      scope: [],
    }])
  }

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id))
  }

  const updateField = (id: string, field: string, value: unknown) => {
    setFields(fields.map(f => f.id === id ? { ...f, [field]: value } : f))
  }

  return (
    <div className="step-content">
      <div className="step-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3>Custom fields</h3>
          <p>Campos adicionais alem dos padrao do Jira</p>
        </div>
        <button className="btn btn-sm btn-primary" onClick={addField}><Plus size={12} /> Adicionar</button>
      </div>

      <div className="list-section">
        {fields.map(f => (
          <div key={f.id} className="list-row">
            <div style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 13 }}>{FIELD_TYPE_ICONS[f.type] ?? '📝'}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="text"
                  value={f.name}
                  onChange={e => updateField(f.id, 'name', e.target.value)}
                  style={{
                    fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                    background: 'transparent', border: 'none', padding: 0, outline: 'none',
                  }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={e => updateField(f.id, 'required', e.target.checked)}
                    style={{ width: 12, height: 12 }}
                  />
                  <span style={{ color: f.required ? 'var(--red)' : 'var(--text-muted)' }}>obrigatorio</span>
                </label>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                <select
                  value={f.type}
                  onChange={e => updateField(f.id, 'type', e.target.value)}
                  style={{ fontSize: 11, padding: '1px 4px', background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)' }}
                >
                  {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <span>Escopo:</span>
                {issueTypeNames.map(name => (
                  <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={f.scope.includes(name)}
                      onChange={e => {
                        const newScope = e.target.checked
                          ? [...f.scope, name]
                          : f.scope.filter(s => s !== name)
                        updateField(f.id, 'scope', newScope)
                      }}
                      style={{ width: 10, height: 10 }}
                    />
                    {name}
                  </label>
                ))}
              </div>
            </div>
            <button className="btn btn-icon btn-sm btn-ghost" onClick={() => removeField(f.id)}>
              <Trash2 size={12} style={{ color: 'var(--red)' }} />
            </button>
          </div>
        ))}
        {fields.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Nenhum campo customizado. Clique em Adicionar.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Step 5: Workflow ─────────────────────────────────────

function StepWorkflow({ statuses, transitions, setStatuses, setTransitions }: {
  statuses: (WorkflowStatus & { id: string })[]
  transitions: (WorkflowTransition & { id: string })[]
  setStatuses: (s: (WorkflowStatus & { id: string })[]) => void
  setTransitions: (t: (WorkflowTransition & { id: string })[]) => void
}) {
  const addStatus = () => {
    const name = prompt('Nome do status:')
    if (!name) return
    setStatuses([...statuses, { id: generateId(), name, category: inferCategory(name) }])
  }

  const removeStatus = (id: string) => {
    const s = statuses.find(s => s.id === id)
    if (!s) return
    setStatuses(statuses.filter(st => st.id !== id))
    setTransitions(transitions.filter(t => t.from !== s.name && t.to !== s.name))
  }

  const addTransition = () => {
    const statusNames = statuses.map(s => s.name)
    if (statusNames.length < 2) return
    setTransitions([...transitions, {
      id: generateId(),
      from: statusNames[0],
      to: statusNames[1],
      name: 'Nova transition',
    }])
  }

  const removeTransition = (id: string) => {
    setTransitions(transitions.filter(t => t.id !== id))
  }

  const updateTransition = (id: string, field: string, value: string) => {
    setTransitions(transitions.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  const statusNames = ['*', ...statuses.map(s => s.name)]

  return (
    <div className="step-content">
      <div className="step-header">
        <h3>Workflow designer</h3>
        <p>Statuses e transitions que definem como as issues se movem</p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Statuses ({statuses.length})
          </div>
          <button className="btn btn-sm" onClick={addStatus}><Plus size={12} /> Status</button>
        </div>
        <div className="workflow-canvas">
          {statuses.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                className="status-bubble"
                style={{ borderColor: (CATEGORY_COLOR[s.category] || 'var(--border)') + '60', color: CATEGORY_COLOR[s.category] || 'var(--text-muted)', position: 'relative' }}
              >
                {s.name}
                <button
                  onClick={() => removeStatus(s.id)}
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
              {i < statuses.length - 1 && (
                <div style={{ width: 24, height: 1, background: 'var(--border-light)', flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Transitions ({transitions.length})
          </div>
          <button className="btn btn-sm" onClick={addTransition}><Plus size={12} /> Transition</button>
        </div>
        <div className="list-section">
          {transitions.map((t) => (
            <div key={t.id} className="list-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                <select
                  value={t.from}
                  onChange={e => updateTransition(t.id, 'from', e.target.value)}
                  style={{ fontSize: 12, padding: '2px 6px', background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 4 }}
                >
                  {statusNames.map(n => <option key={n} value={n}>{n === '*' ? 'Qualquer' : n}</option>)}
                </select>
                <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
                <select
                  value={t.to}
                  onChange={e => updateTransition(t.id, 'to', e.target.value)}
                  style={{ fontSize: 12, padding: '2px 6px', background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 4 }}
                >
                  {statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
                <input
                  type="text"
                  value={t.name}
                  onChange={e => updateTransition(t.id, 'name', e.target.value)}
                  style={{ fontSize: 12, color: 'var(--text-muted)', background: 'transparent', border: 'none', padding: 0, outline: 'none', width: 100 }}
                  placeholder="Nome..."
                />
              </div>
              <button className="btn btn-icon btn-sm btn-ghost" onClick={() => removeTransition(t.id)}>
                <Trash2 size={12} style={{ color: 'var(--red)' }} />
              </button>
            </div>
          ))}
          {transitions.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Nenhuma transition configurada.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Step 6: Schemes ──────────────────────────────────────

function StepSchemes({ schemes, setSchemes }: {
  schemes: { screenScheme: string; permissionScheme: string; notificationScheme: string; fieldConfiguration: string }
  setSchemes: (s: { screenScheme: string; permissionScheme: string; notificationScheme: string; fieldConfiguration: string }) => void
}) {
  const items = [
    { key: 'screenScheme',        label: 'Screen scheme',         hint: 'Create / Edit / View screens por issue type',       opts: ['auto', 'existing'],   labels: ['Gerar automaticamente', 'Usar existente'] },
    { key: 'permissionScheme',    label: 'Permission scheme',      hint: 'Quem pode criar, editar, transicionar',             opts: ['default', 'custom'],  labels: ['NTT DATA Default', 'Criar novo'] },
    { key: 'notificationScheme',  label: 'Notification scheme',    hint: 'Emails por evento',                                opts: ['default', 'custom'],  labels: ['NTT DATA Default', 'Criar novo'] },
    { key: 'fieldConfiguration',  label: 'Field configuration',    hint: 'Campos obrigatorios / opcionais',                  opts: ['auto', 'custom'],     labels: ['Gerar automaticamente', 'Customizar'] },
  ] as const

  return (
    <div className="step-content">
      <div className="step-header">
        <h3>Schemes &amp; permissoes</h3>
        <p>Configuracoes administrativas — defaults recomendados para uso interno</p>
      </div>

      {items.map(item => (
        <div key={item.key} className="scheme-row">
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{item.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.hint}</div>
          </div>
          <select
            style={{ width: 'auto', minWidth: 180, fontSize: 12 }}
            value={schemes[item.key as keyof typeof schemes]}
            onChange={e => setSchemes({ ...schemes, [item.key]: e.target.value })}
          >
            {item.opts.map((o, i) => <option key={o} value={o}>{item.labels[i]}</option>)}
          </select>
        </div>
      ))}
    </div>
  )
}

// ─── Step 7: Review & Deploy ──────────────────────────────

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

function StepReview({
  form,
  issueTypes,
  fields,
  statuses,
  transitions,
  enableAdvancedRoadmaps,
  onDeploy,
  deploying,
  deployResult,
  deployError,
  jiraBaseUrl,
}: {
  form: Record<string, string>
  issueTypes: { name: string }[]
  fields: { name: string }[]
  statuses: { name: string }[]
  transitions: { name: string }[]
  enableAdvancedRoadmaps: boolean
  onDeploy: () => void
  deploying: boolean
  deployResult: DeployResult | null
  deployError: string | null
  jiraBaseUrl: string
}) {
  return (
    <div className="step-content">
      <div className="step-header">
        <h3>Review &amp; Deploy</h3>
        <p>Tudo pronto para criar no Jira Cloud</p>
      </div>

      {!deploying && !deployResult && !deployError && (
        <>
          <div className="review-grid">
            <div className="review-block">
              <div className="review-block-title">Projeto</div>
              <div className="review-item"><div className="dot blue" />{form.project_name || '(sem nome)'}</div>
              <div className="review-item"><div className="dot blue" /><code>{form.project_key || 'KEY'}</code> - Scrum</div>
              {enableAdvancedRoadmaps && (
                <div className="review-item"><div className="dot blue" />Advanced Roadmaps ativado</div>
              )}
            </div>
            <div className="review-block">
              <div className="review-block-title">Issue types ({issueTypes.length})</div>
              {issueTypes.length > 0 && (
                <div className="review-item"><div className="dot purple" />{issueTypes.map(t => t.name).join(', ')}</div>
              )}
              {enableAdvancedRoadmaps && (
                <div className="review-item"><div className="dot purple" />Hierarquia 3 niveis</div>
              )}
            </div>
            <div className="review-block">
              <div className="review-block-title">Custom fields ({fields.length})</div>
              {fields.length > 0 && (
                <div className="review-item"><div className="dot green" />{fields.map(f => f.name).join(' - ')}</div>
              )}
            </div>
            <div className="review-block">
              <div className="review-block-title">Workflow ({statuses.length} statuses, {transitions.length} transitions)</div>
              {statuses.length > 0 && (
                <div className="review-item"><div className="dot blue" />{statuses.map(s => s.name).join(' -> ')}</div>
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
          {(deployResult?.steps ?? Object.keys(DEPLOY_STEP_LABELS).map(key => ({ key, label: DEPLOY_STEP_LABELS[key], status: 'pending' }))).map((step, i) => {
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
  const [enableAdvancedRoadmaps, setEnableAdvancedRoadmaps] = useState(false)

  const [issueTypes, setIssueTypes] = useState<(IssueTypeConfig & { id: string })[]>([])
  const [fields, setFields] = useState<(CustomFieldConfig & { id: string })[]>([])
  const [statuses, setStatuses] = useState<(WorkflowStatus & { id: string })[]>([])
  const [transitions, setTransitions] = useState<(WorkflowTransition & { id: string })[]>([])
  const [schemes, setSchemes] = useState({
    screenScheme: 'auto',
    permissionScheme: 'default',
    notificationScheme: 'default',
    fieldConfiguration: 'auto',
  })

  const [form, setForm] = useState({
    tenant_id: '', connection_id: '',
    project_name: '', project_key: '', project_type: 'scrum', description: '',
  })
  const [deploying, setDeploying] = useState(false)
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null)
  const [deployError, setDeployError] = useState<string | null>(null)

  // ─── Connection hook depends on selected tenant ─────────
  const { connections, loading: connectionsLoading } = useConnections(form.tenant_id || null)

  // ─── Auto-select template from URL param ────────────────
  useEffect(() => {
    if (templateParam && templates.length > 0 && !selectedTemplate) {
      const found = templates.find(t => t.id === templateParam)
      if (found) {
        setSelectedTemplate(found.id)
        applyTemplate(found)
      }
    }
  }, [templateParam, templates]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Apply template config to builder state ─────────────
  const applyTemplate = useCallback((template: Template) => {
    const cfg = template.config
    if (!cfg) return

    // Issue types
    if (cfg.issueTypes?.length) {
      setIssueTypes(cfg.issueTypes.map(it => ({ ...it, id: generateId() })))
    }

    // Custom fields
    if (cfg.customFields?.length) {
      setFields(cfg.customFields.map(f => ({ ...f, id: generateId() })))
    }

    // Workflow
    if (cfg.workflow) {
      if (cfg.workflow.statuses?.length) {
        setStatuses(cfg.workflow.statuses.map(name => ({
          id: generateId(),
          name,
          category: inferCategory(name),
        })))
      }
      if (cfg.workflow.transitions?.length) {
        setTransitions(cfg.workflow.transitions.map(t => ({ ...t, id: generateId() })))
      }
    }

    // Hierarchy / Advanced Roadmaps
    if (cfg.hierarchy?.requiresPremium) {
      setEnableAdvancedRoadmaps(true)
    }

    // Schemes
    if (cfg.schemes) {
      setSchemes(prev => ({
        ...prev,
        permissionScheme: cfg.schemes?.permissionScheme || 'default',
        notificationScheme: cfg.schemes?.notificationScheme || 'default',
      }))
    }
  }, [])

  // ─── Handle template selection ──────────────────────────
  const handleSelectTemplate = (id: string) => {
    setSelectedTemplate(id)
    const template = templates.find(t => t.id === id)
    if (template) {
      applyTemplate(template)
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
    return true
  }

  // ─── Deploy ─────────────────────────────────────────────
  const handleDeploy = async () => {
    setDeploying(true)
    setDeployResult(null)
    setDeployError(null)

    try {
      const res = await fetch('/api/projects/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: form.tenant_id,
          jira_connection_id: form.connection_id,
          template_id: selectedTemplate || undefined,
          project_name: form.project_name,
          project_key: form.project_key,
          project_type: 'scrum',
          description: form.description,
          enableAdvancedRoadmaps,
          issueTypes: issueTypes.map(({ id, ...rest }) => rest),
          customFields: fields.map(({ id, ...rest }) => rest),
          workflow: {
            statuses: statuses.map(s => s.name),
            transitions: transitions.map(({ id, ...rest }) => rest),
          },
          schemes: {
            screenScheme: schemes.screenScheme,
            permissionScheme: schemes.permissionScheme,
            notificationScheme: schemes.notificationScheme,
            fieldConfiguration: schemes.fieldConfiguration,
          },
          hierarchy: enableAdvancedRoadmaps
            ? { levels: ['Iniciativa', 'Epico', 'Story', 'Subtask'], requiresPremium: true }
            : { levels: ['Epico', 'Story', 'Subtask'], requiresPremium: false },
          created_by: 'ntt-data-user',
        }),
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
          <StepTemplate
            selected={selectedTemplate}
            onSelect={handleSelectTemplate}
            templates={templates}
            loading={templatesLoading}
          />
        )
      case 1:
        return (
          <StepProject
            form={form}
            onChange={updateForm}
            tenants={tenants}
            tenantsLoading={tenantsLoading}
            connections={connections}
            connectionsLoading={connectionsLoading}
            enableAdvancedRoadmaps={enableAdvancedRoadmaps}
            onToggleAdvancedRoadmaps={setEnableAdvancedRoadmaps}
          />
        )
      case 2:
        return <StepIssueTypes types={issueTypes} setTypes={setIssueTypes} />
      case 3:
        return (
          <StepFields
            fields={fields}
            setFields={setFields}
            issueTypeNames={issueTypes.map(t => t.name)}
          />
        )
      case 4:
        return (
          <StepWorkflow
            statuses={statuses}
            transitions={transitions}
            setStatuses={setStatuses}
            setTransitions={setTransitions}
          />
        )
      case 5:
        return <StepSchemes schemes={schemes} setSchemes={setSchemes} />
      case 6:
        return (
          <StepReview
            form={form}
            issueTypes={issueTypes}
            fields={fields}
            statuses={statuses}
            transitions={transitions}
            enableAdvancedRoadmaps={enableAdvancedRoadmaps}
            onDeploy={handleDeploy}
            deploying={deploying}
            deployResult={deployResult}
            deployError={deployError}
            jiraBaseUrl={jiraBaseUrl}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="builder-page">
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div>
          <h1>Novo projeto</h1>
          <p>Configure e crie um projeto completo no Jira do cliente</p>
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
