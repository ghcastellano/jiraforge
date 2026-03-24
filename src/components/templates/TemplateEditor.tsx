'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Save, X, Copy, Plus, Trash2, ChevronRight,
  Loader2, AlertCircle, CheckCircle2, Layers,
  Settings, GitBranch, Zap, FileText
} from 'lucide-react'
import { useTenants } from '@/hooks'
import type {
  Template, TemplateConfig, IssueTypeConfig,
  CustomFieldConfig, WorkflowTransition, RuleType
} from '@/types'

// ─── Defaults ────────────────────────────────────────────
const STANDARD_HIERARCHY = ['Epic', 'Story', 'Subtask']
const ADVANCED_HIERARCHY = ['Initiative', 'Epic', 'Story', 'Subtask']

const EMPTY_CONFIG: TemplateConfig = {
  hierarchy: { levels: STANDARD_HIERARCHY, requiresPremium: false },
  issueTypes: [],
  customFields: [],
  workflow: { statuses: [], transitions: [] },
  automations: [],
  schemes: { permissionScheme: 'default', notificationScheme: 'default' },
}

const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Numero' },
  { value: 'select', label: 'Select' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'date', label: 'Data' },
  { value: 'user', label: 'Usuário' },
  { value: 'textarea', label: 'Textarea' },
] as const

const STATUS_CATEGORIES = [
  { value: 'TODO', label: 'A Fazer', color: 'var(--text-muted)' },
  { value: 'IN_PROGRESS', label: 'Em Progresso', color: 'var(--blue)' },
  { value: 'DONE', label: 'Concluido', color: 'var(--green)' },
] as const

const AUTOMATION_RULES: { type: RuleType; label: string; description: string }[] = [
  { type: 'story_bug_to_epic', label: 'Story/Bug → Epico Done', description: 'Quando todas as stories/bugs de um epico estao concluidas, move o epico para Done automaticamente.' },
  { type: 'epic_to_initiative', label: 'Epico → Iniciativa Done', description: 'Quando todos os epicos de uma iniciativa estao concluidos, move a iniciativa para Done.' },
  { type: 'sprint_close_notify', label: 'Sprint fechado com issues abertas', description: 'Notifica quando um sprint e fechado e ainda existem issues em aberto.' },
]

type Tab = 'general' | 'hierarchy' | 'fields' | 'workflow' | 'automations'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'general', label: 'Geral', icon: <FileText size={14} /> },
  { key: 'hierarchy', label: 'Hierarquia & Types', icon: <Layers size={14} /> },
  { key: 'fields', label: 'Custom Fields', icon: <Settings size={14} /> },
  { key: 'workflow', label: 'Workflow', icon: <GitBranch size={14} /> },
  { key: 'automations', label: 'Automacoes', icon: <Zap size={14} /> },
]

// ─── Status category map helper ──────────────────────────
interface StatusWithCategory {
  name: string
  category: 'TODO' | 'IN_PROGRESS' | 'DONE'
}

function categoryColor(cat: string) {
  if (cat === 'TODO') return 'var(--text-muted)'
  if (cat === 'IN_PROGRESS') return 'var(--blue)'
  return 'var(--green)'
}

function categoryBg(cat: string) {
  if (cat === 'TODO') return 'var(--bg-overlay)'
  if (cat === 'IN_PROGRESS') return 'var(--blue-bg)'
  return 'var(--green-bg)'
}

function categoryBorder(cat: string) {
  if (cat === 'TODO') return 'var(--border-light)'
  if (cat === 'IN_PROGRESS') return 'var(--blue-border)'
  return 'var(--green-border)'
}

// ═════════════════════════════════════════════════════════
// TemplateEditor Component
// ═════════════════════════════════════════════════════════

interface TemplateEditorProps {
  /** Existing template for editing; null for new */
  template?: Template | null
  /** Loading state while fetching template */
  loading?: boolean
  /** Fetch error */
  fetchError?: string | null
}

export default function TemplateEditor({ template, loading, fetchError }: TemplateEditorProps) {
  const router = useRouter()
  const { tenants, loading: tenantsLoading } = useTenants()
  const isEdit = !!template

  // ── Form state ─────────────────────────────────────────
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('📋')
  const [tagsInput, setTagsInput] = useState('')
  const [isGlobal, setIsGlobal] = useState(true)
  const [tenantId, setTenantId] = useState('')
  const [config, setConfig] = useState<TemplateConfig>(EMPTY_CONFIG)

  // ── Status categories (not stored in TemplateConfig.workflow.statuses which is string[]) ──
  const [statusCategories, setStatusCategories] = useState<StatusWithCategory[]>([])

  // ── UI state ───────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // ── Populate form when template loads ──────────────────
  useEffect(() => {
    if (!template) return
    setName(template.name)
    setDescription(template.description || '')
    setIcon(template.icon || '📋')
    setTagsInput(template.tags.join(', '))
    setIsGlobal(template.is_global)
    setTenantId(template.tenant_id || '')
    setConfig(template.config || EMPTY_CONFIG)

    // Build status categories from statuses array
    const statuses = template.config?.workflow?.statuses ?? []
    setStatusCategories(statuses.map((s, i) => ({
      name: s,
      category: i === 0 ? 'TODO' : i === statuses.length - 1 ? 'DONE' : 'IN_PROGRESS',
    })))
  }, [template])

  // ── Derived values ─────────────────────────────────────
  const tags = useMemo(() => tagsInput.split(',').map(t => t.trim()).filter(Boolean), [tagsInput])
  const issueTypeNames = useMemo(() => config.issueTypes.map(it => it.name), [config.issueTypes])

  // ── Config updaters ────────────────────────────────────
  const updateHierarchy = (levels: string[], requiresPremium: boolean) => {
    setConfig(c => ({ ...c, hierarchy: { levels, requiresPremium } }))
  }

  const updateIssueType = (idx: number, patch: Partial<IssueTypeConfig>) => {
    setConfig(c => ({
      ...c,
      issueTypes: c.issueTypes.map((it, i) => i === idx ? { ...it, ...patch } : it),
    }))
  }

  const removeIssueType = (idx: number) => {
    setConfig(c => ({
      ...c,
      issueTypes: c.issueTypes.filter((_, i) => i !== idx),
    }))
  }

  const addIssueType = () => {
    setConfig(c => ({
      ...c,
      issueTypes: [...c.issueTypes, { name: '', level: 1, color: '#6366f1', icon: '📌' }],
    }))
  }

  const updateCustomField = (idx: number, patch: Partial<CustomFieldConfig>) => {
    setConfig(c => ({
      ...c,
      customFields: c.customFields.map((f, i) => i === idx ? { ...f, ...patch } : f),
    }))
  }

  const removeCustomField = (idx: number) => {
    setConfig(c => ({
      ...c,
      customFields: c.customFields.filter((_, i) => i !== idx),
    }))
  }

  const addCustomField = () => {
    setConfig(c => ({
      ...c,
      customFields: [...c.customFields, { name: '', type: 'text', required: false, scope: [] }],
    }))
  }

  const addStatus = () => {
    setStatusCategories(s => [...s, { name: '', category: 'TODO' }])
  }

  const updateStatus = (idx: number, patch: Partial<StatusWithCategory>) => {
    setStatusCategories(s => s.map((st, i) => i === idx ? { ...st, ...patch } : st))
  }

  const removeStatus = (idx: number) => {
    setStatusCategories(s => s.filter((_, i) => i !== idx))
  }

  const statusNames = useMemo(() => statusCategories.map(s => s.name).filter(Boolean), [statusCategories])

  const updateTransition = (idx: number, patch: Partial<WorkflowTransition>) => {
    setConfig(c => ({
      ...c,
      workflow: {
        ...c.workflow,
        transitions: c.workflow.transitions.map((t, i) => i === idx ? { ...t, ...patch } : t),
      },
    }))
  }

  const removeTransition = (idx: number) => {
    setConfig(c => ({
      ...c,
      workflow: {
        ...c.workflow,
        transitions: c.workflow.transitions.filter((_, i) => i !== idx),
      },
    }))
  }

  const addTransition = () => {
    setConfig(c => ({
      ...c,
      workflow: {
        ...c.workflow,
        transitions: [...c.workflow.transitions, { from: '*', to: '', name: '' }],
      },
    }))
  }

  const toggleAutomation = (rule: RuleType) => {
    setConfig(c => ({
      ...c,
      automations: c.automations.includes(rule)
        ? c.automations.filter(r => r !== rule)
        : [...c.automations, rule],
    }))
  }

  // ── Save ───────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) {
      setFeedback({ type: 'error', message: 'Nome do template e obrigatorio.' })
      setActiveTab('general')
      return
    }

    setSaving(true)
    setFeedback(null)

    // Sync statuses from statusCategories into config
    const finalConfig: TemplateConfig = {
      ...config,
      workflow: {
        ...config.workflow,
        statuses: statusCategories.map(s => s.name).filter(Boolean),
      },
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      icon: icon.trim() || undefined,
      is_global: isGlobal,
      tenant_id: isGlobal ? undefined : tenantId || undefined,
      config: finalConfig,
      tags,
      created_by: 'ntt-data-user',
    }

    try {
      const url = isEdit ? `/api/templates/${template!.id}` : '/api/templates'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar')

      setFeedback({ type: 'success', message: isEdit ? 'Template atualizado com sucesso!' : 'Template criado com sucesso!' })
      setTimeout(() => router.push('/templates'), 1200)
    } catch (e) {
      setFeedback({ type: 'error', message: e instanceof Error ? e.message : 'Erro ao salvar template' })
    } finally {
      setSaving(false)
    }
  }

  // ── Duplicate ──────────────────────────────────────────
  const handleDuplicate = async () => {
    if (!template) return
    setSaving(true)
    setFeedback(null)
    try {
      const res = await fetch(`/api/templates/${template.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${template.name} (copia)`, created_by: 'ntt-data-user' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao duplicar')
      setFeedback({ type: 'success', message: 'Template duplicado! Redirecionando...' })
      setTimeout(() => router.push(`/templates/${json.data.id}/edit`), 1200)
    } catch (e) {
      setFeedback({ type: 'error', message: e instanceof Error ? e.message : 'Erro ao duplicar' })
    } finally {
      setSaving(false)
    }
  }

  // ── Loading / Error states ─────────────────────────────
  if (loading) {
    return (
      <div className="builder-page">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80 }}>
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--brand)' }} />
          <span style={{ marginLeft: 12, color: 'var(--text-muted)' }}>Carregando template...</span>
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="builder-page">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 80, gap: 12 }}>
          <AlertCircle size={32} style={{ color: 'var(--red)' }} />
          <span style={{ color: 'var(--red)', fontSize: 14 }}>{fetchError}</span>
          <button className="btn" onClick={() => router.push('/templates')}>Voltar</button>
        </div>
      </div>
    )
  }

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════

  return (
    <div className="builder-page">
      {/* ── Header ──────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1>{isEdit ? 'Editar template' : 'Novo template'}</h1>
          <p>{isEdit ? `Editando "${template!.name}"` : 'Configure um novo template de projeto Jira'}</p>
        </div>
        {isEdit && (
          <button className="btn" onClick={handleDuplicate} disabled={saving}>
            <Copy size={14} /> Duplicar
          </button>
        )}
      </div>

      {/* ── Feedback ────────────────────────────────── */}
      {feedback && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            marginBottom: 16,
            fontSize: 13,
            background: feedback.type === 'success' ? 'var(--green-bg)' : 'var(--red-bg)',
            border: `1px solid ${feedback.type === 'success' ? 'var(--green-border)' : 'var(--red-border)'}`,
            color: feedback.type === 'success' ? 'var(--green)' : 'var(--red)',
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {feedback.message}
        </div>
      )}

      {/* ── Tab Navigation ──────────────────────────── */}
      <div className="filter-tabs" style={{ marginBottom: 16 }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`filter-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ─────────────────────────────── */}
      <div className="builder-card">
        <div className="step-content" style={{ paddingBottom: 24 }}>

          {/* ═══ TAB: GENERAL ═══ */}
          {activeTab === 'general' && (
            <div className="animate-in">
              <div className="step-header">
                <h3>Informacoes gerais</h3>
                <p>Nome, descricao e escopo do template</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 12, marginBottom: 18 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Icone</label>
                  <input
                    type="text"
                    value={icon}
                    onChange={e => setIcon(e.target.value)}
                    style={{ textAlign: 'center', fontSize: 22, padding: '8px 4px' }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Nome do template *</label>
                  <input
                    type="text"
                    placeholder="ex: Scrum Enterprise"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Descricao</label>
                <textarea
                  placeholder="Quando e como este template deve ser usado..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  style={{ height: 80 }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tags <span style={{ color: 'var(--text-muted)' }}>(separadas por virgula)</span></label>
                <input
                  type="text"
                  placeholder="Scrum, Premium, Enterprise"
                  value={tagsInput}
                  onChange={e => setTagsInput(e.target.value)}
                />
                {tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                    {tags.map(t => <span key={t} className="badge badge-muted">{t}</span>)}
                  </div>
                )}
              </div>

              <div className="divider" />

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={isGlobal}
                    onChange={e => setIsGlobal(e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Template global NTT DATA</span>
                </label>
                <div className="form-hint">
                  Templates globais ficam disponiveis para todos os clientes. Desmarque para vincular a um cliente especifico.
                </div>
              </div>

              {!isGlobal && (
                <div className="form-group animate-in">
                  <label className="form-label">Cliente (tenant)</label>
                  {tenantsLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                      <Loader2 size={13} className="animate-spin" /> Carregando clientes...
                    </div>
                  ) : (
                    <select value={tenantId} onChange={e => setTenantId(e.target.value)}>
                      <option value="">Selecionar cliente...</option>
                      {tenants.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══ TAB: HIERARCHY & ISSUE TYPES ═══ */}
          {activeTab === 'hierarchy' && (
            <div className="animate-in">
              <div className="step-header">
                <h3>Hierarquia & Issue Types</h3>
                <p>Defina os niveis de hierarquia e tipos de issue do template</p>
              </div>

              {/* Hierarchy toggle */}
              <div className="form-group">
                <label className="form-label">Niveis de hierarquia</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className={`filter-tab ${!config.hierarchy.requiresPremium && config.hierarchy.levels.length <= 3 ? 'active' : ''}`}
                    onClick={() => updateHierarchy(STANDARD_HIERARCHY, false)}
                  >
                    Standard
                  </button>
                  <button
                    className={`filter-tab ${config.hierarchy.levels.length > 3 || config.hierarchy.requiresPremium ? 'active' : ''}`}
                    onClick={() => updateHierarchy(ADVANCED_HIERARCHY, true)}
                  >
                    Advanced Roadmaps
                  </button>
                </div>
              </div>

              {/* Visual preview */}
              <div className="hierarchy-row" style={{ marginBottom: 16 }}>
                {config.hierarchy.levels.map((level, i) => (
                  <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="hier-pill">{level}</span>
                    {i < config.hierarchy.levels.length - 1 && <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                ))}
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={config.hierarchy.requiresPremium}
                    onChange={e => updateHierarchy(config.hierarchy.levels, e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  <span style={{ color: 'var(--text-secondary)' }}>Requer Jira Premium</span>
                </label>
              </div>

              <div className="divider" />

              {/* Issue types list */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <label className="form-label" style={{ margin: 0 }}>Issue Types ({config.issueTypes.length})</label>
                <button className="btn btn-sm" onClick={addIssueType}><Plus size={12} /> Adicionar</button>
              </div>

              <div className="list-section">
                {config.issueTypes.length === 0 && (
                  <div className="info-note" style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum issue type configurado. Clique em "Adicionar" para comecar.</span>
                  </div>
                )}
                {config.issueTypes.map((it, idx) => (
                  <div key={idx} className="list-row" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <div
                      className="it-icon"
                      style={{ background: it.color + '22', color: it.color, fontSize: 16 }}
                    >
                      {it.icon || '📌'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 180 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Nome do tipo"
                          value={it.name}
                          onChange={e => updateIssueType(idx, { name: e.target.value })}
                          style={{ flex: 1 }}
                        />
                        <input
                          type="text"
                          placeholder="🎯"
                          value={it.icon}
                          onChange={e => updateIssueType(idx, { icon: e.target.value })}
                          style={{ width: 48, textAlign: 'center', fontSize: 16 }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <label className="form-label" style={{ fontSize: 10, margin: 0 }}>Level</label>
                          <select
                            value={it.level}
                            onChange={e => updateIssueType(idx, { level: Number(e.target.value) })}
                          >
                            {config.hierarchy.levels.map((l, i) => (
                              <option key={l} value={i}>{i} - {l}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ width: 100 }}>
                          <label className="form-label" style={{ fontSize: 10, margin: 0 }}>Cor</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="color"
                              value={it.color}
                              onChange={e => updateIssueType(idx, { color: e.target.value })}
                              style={{ width: 28, height: 28, padding: 0, border: 'none', cursor: 'pointer', background: 'none' }}
                            />
                            <input
                              type="text"
                              value={it.color}
                              onChange={e => updateIssueType(idx, { color: e.target.value })}
                              style={{ width: 70, fontFamily: "'DM Mono', monospace", fontSize: 11 }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <button className="btn btn-sm btn-ghost" onClick={() => removeIssueType(idx)}>
                      <Trash2 size={13} style={{ color: 'var(--red)' }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ TAB: CUSTOM FIELDS ═══ */}
          {activeTab === 'fields' && (
            <div className="animate-in">
              <div className="step-header">
                <h3>Custom Fields</h3>
                <p>Campos personalizados que serao criados no Jira</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <label className="form-label" style={{ margin: 0 }}>Campos ({config.customFields.length})</label>
                <button className="btn btn-sm" onClick={addCustomField}><Plus size={12} /> Adicionar campo</button>
              </div>

              <div className="list-section">
                {config.customFields.length === 0 && (
                  <div className="info-note" style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum custom field configurado.</span>
                  </div>
                )}
                {config.customFields.map((field, idx) => (
                  <div key={idx} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10, padding: 14 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Nome do campo"
                        value={field.name}
                        onChange={e => updateCustomField(idx, { name: e.target.value })}
                        style={{ flex: 1 }}
                      />
                      <select
                        value={field.type}
                        onChange={e => updateCustomField(idx, { type: e.target.value as CustomFieldConfig['type'] })}
                        style={{ width: 140 }}
                      >
                        {FIELD_TYPES.map(ft => (
                          <option key={ft.value} value={ft.value}>{ft.label}</option>
                        ))}
                      </select>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={e => updateCustomField(idx, { required: e.target.checked })}
                          style={{ width: 'auto' }}
                        />
                        Obrigatorio
                      </label>
                      <button className="btn btn-sm btn-ghost" onClick={() => removeCustomField(idx)}>
                        <Trash2 size={13} style={{ color: 'var(--red)' }} />
                      </button>
                    </div>

                    {/* Scope checkboxes */}
                    {issueTypeNames.length > 0 && (
                      <div>
                        <label className="form-label" style={{ fontSize: 10, marginBottom: 4 }}>Escopo (issue types)</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {issueTypeNames.map(itName => (
                            <label key={itName} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={field.scope.includes(itName)}
                                onChange={e => {
                                  const newScope = e.target.checked
                                    ? [...field.scope, itName]
                                    : field.scope.filter(s => s !== itName)
                                  updateCustomField(idx, { scope: newScope })
                                }}
                                style={{ width: 'auto' }}
                              />
                              {itName}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Options for select/multiselect */}
                    {(field.type === 'select' || field.type === 'multiselect') && (
                      <div>
                        <label className="form-label" style={{ fontSize: 10, marginBottom: 4 }}>Opcoes (separadas por virgula)</label>
                        <input
                          type="text"
                          placeholder="Opcao 1, Opcao 2, Opcao 3"
                          value={(field.options || []).join(', ')}
                          onChange={e => {
                            const opts = e.target.value.split(',').map(o => o.trim()).filter(Boolean)
                            updateCustomField(idx, { options: opts })
                          }}
                        />
                      </div>
                    )}

                    {/* Description */}
                    <div>
                      <label className="form-label" style={{ fontSize: 10, marginBottom: 4 }}>Descricao (opcional)</label>
                      <input
                        type="text"
                        placeholder="Descricao do campo..."
                        value={field.description || ''}
                        onChange={e => updateCustomField(idx, { description: e.target.value || undefined })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ TAB: WORKFLOW ═══ */}
          {activeTab === 'workflow' && (
            <div className="animate-in">
              <div className="step-header">
                <h3>Workflow</h3>
                <p>Defina os statuses e transicoes do fluxo de trabalho</p>
              </div>

              {/* ── Statuses ──────────────────────────── */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <label className="form-label" style={{ margin: 0 }}>Statuses ({statusCategories.length})</label>
                <button className="btn btn-sm" onClick={addStatus}><Plus size={12} /> Adicionar status</button>
              </div>

              {/* Visual flow preview */}
              {statusCategories.length > 0 && (
                <div className="workflow-canvas" style={{ marginBottom: 16 }}>
                  {statusCategories.filter(s => s.name).map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div
                        className="status-bubble"
                        style={{
                          background: categoryBg(s.category),
                          color: categoryColor(s.category),
                          borderColor: categoryBorder(s.category),
                        }}
                      >
                        {s.name}
                      </div>
                      {i < statusCategories.filter(st => st.name).length - 1 && (
                        <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="list-section" style={{ marginBottom: 24 }}>
                {statusCategories.length === 0 && (
                  <div className="info-note" style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum status configurado.</span>
                  </div>
                )}
                {statusCategories.map((status, idx) => (
                  <div key={idx} className="list-row">
                    <input
                      type="text"
                      placeholder="Nome do status"
                      value={status.name}
                      onChange={e => updateStatus(idx, { name: e.target.value })}
                      style={{ flex: 1 }}
                    />
                    <select
                      value={status.category}
                      onChange={e => updateStatus(idx, { category: e.target.value as StatusWithCategory['category'] })}
                      style={{ width: 160 }}
                    >
                      {STATUS_CATEGORIES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    <button className="btn btn-sm btn-ghost" onClick={() => removeStatus(idx)}>
                      <Trash2 size={13} style={{ color: 'var(--red)' }} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="divider" />

              {/* ── Transitions ────────────────────────── */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 20 }}>
                <label className="form-label" style={{ margin: 0 }}>Transicoes ({config.workflow.transitions.length})</label>
                <button className="btn btn-sm" onClick={addTransition}><Plus size={12} /> Adicionar transicao</button>
              </div>

              <div className="list-section">
                {config.workflow.transitions.length === 0 && (
                  <div className="info-note" style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhuma transicao configurada.</span>
                  </div>
                )}
                {config.workflow.transitions.map((trans, idx) => (
                  <div key={idx} className="list-row" style={{ gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" style={{ fontSize: 10, margin: 0 }}>De</label>
                      <select
                        value={trans.from}
                        onChange={e => updateTransition(idx, { from: e.target.value })}
                      >
                        <option value="*">Any (qualquer)</option>
                        {statusNames.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--text-muted)', marginTop: 16 }} />
                    <div style={{ flex: 1 }}>
                      <label className="form-label" style={{ fontSize: 10, margin: 0 }}>Para</label>
                      <select
                        value={trans.to}
                        onChange={e => updateTransition(idx, { to: e.target.value })}
                      >
                        <option value="">Selecionar...</option>
                        {statusNames.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" style={{ fontSize: 10, margin: 0 }}>Nome</label>
                      <input
                        type="text"
                        placeholder="ex: Iniciar"
                        value={trans.name}
                        onChange={e => updateTransition(idx, { name: e.target.value })}
                      />
                    </div>
                    <button className="btn btn-sm btn-ghost" style={{ marginTop: 16 }} onClick={() => removeTransition(idx)}>
                      <Trash2 size={13} style={{ color: 'var(--red)' }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ TAB: AUTOMATIONS ═══ */}
          {activeTab === 'automations' && (
            <div className="animate-in">
              <div className="step-header">
                <h3>Automacoes</h3>
                <p>Regras de automacao que serao ativadas ao criar projetos com este template</p>
              </div>

              <div className="list-section">
                {AUTOMATION_RULES.map(rule => {
                  const checked = config.automations.includes(rule.type)
                  return (
                    <div
                      key={rule.type}
                      className="list-row"
                      style={{
                        cursor: 'pointer',
                        borderColor: checked ? 'var(--brand-border)' : undefined,
                        background: checked ? 'var(--brand-dim)' : undefined,
                      }}
                      onClick={() => toggleAutomation(rule.type)}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAutomation(rule.type)}
                        style={{ width: 'auto', flexShrink: 0 }}
                        onClick={e => e.stopPropagation()}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>
                          {rule.label}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                          {rule.description}
                        </div>
                      </div>
                      <code style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{rule.type}</code>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────── */}
        <div className="builder-footer">
          <button className="btn" onClick={() => router.push('/templates')}>
            <X size={14} /> Cancelar
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving
                ? <><Loader2 size={13} className="animate-spin" /> Salvando...</>
                : <><Save size={14} /> Salvar template</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
