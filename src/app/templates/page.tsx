'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, BookOpen, Edit3, Copy, Trash2,
  Globe, Lock, Star, ChevronRight, X, Check,
  Loader2, Tag
} from 'lucide-react'
import { useTemplates } from '@/hooks'
import type { Template } from '@/types'

function TemplateDetail({ template, onClose, onUse }: {
  template: Template
  onClose: () => void
  onUse: () => void
}) {
  const issueTypes = template.config?.issueTypes ?? []
  const customFields = template.config?.customFields ?? []
  const workflowStatuses = template.config?.workflow?.statuses ?? []

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="t-icon-lg">{template.icon || '📋'}</div>
            <div>
              <h2>{template.name}</h2>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                {template.tags.map(t => <span key={t} className="badge badge-muted">{t}</span>)}
                {template.is_global && <span className="badge badge-blue"><Globe size={9} /> Global</span>}
              </div>
            </div>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <p style={{ marginBottom: 20, fontSize: 13 }}>{template.description}</p>

          <div className="detail-grid">
            <div className="detail-block">
              <div className="detail-title">Issue types ({issueTypes.length})</div>
              {issueTypes.map(it => (
                <div key={it.name} className="detail-item">
                  <Check size={11} style={{ color: it.color || 'var(--brand-light)' }} />
                  {it.icon} {it.name}
                </div>
              ))}
              {issueTypes.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum configurado</div>
              )}
            </div>
            <div className="detail-block">
              <div className="detail-title">Custom fields ({customFields.length})</div>
              {customFields.map(f => (
                <div key={f.name} className="detail-item">
                  <Check size={11} style={{ color: 'var(--green)' }} />
                  {f.name} <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({f.type}{f.required ? ', obrigatório' : ''})</span>
                </div>
              ))}
              {customFields.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum configurado</div>
              )}
            </div>
            <div className="detail-block" style={{ gridColumn: '1 / -1' }}>
              <div className="detail-title">Workflow — statuses</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
                {workflowStatuses.map((s, i) => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="wf-tag">{s}</span>
                    {i < workflowStatuses.length - 1 && <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                ))}
                {workflowStatuses.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum configurado</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Fechar</button>
          <button className="btn btn-primary" onClick={onUse}>Usar este template →</button>
        </div>
      </div>
    </div>
  )
}

function NewTemplateModal({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (data: { name: string; description: string; icon: string; tags: string[] }) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', icon: '📋', tags: '' })
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
      await onCreate({ name: form.name, description: form.description, icon: form.icon, tags })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar template')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Novo template</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 12, marginBottom: 18 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Icone</label>
              <input type="text" value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} style={{ textAlign: 'center', fontSize: 20 }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Nome</label>
              <input type="text" placeholder="ex: Meu Template Scrum" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Descricao</label>
            <textarea placeholder="Descreva quando usar este template..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ height: 72 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Tags <span style={{ color: 'var(--text-muted)' }}>(separadas por virgula)</span></label>
            <input type="text" placeholder="Scrum, Premium, Enterprise" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
          </div>
          {error && (
            <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 8 }}>{error}</div>
          )}
          <div className="info-note">
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Apos criar, voce podera configurar os issue types, custom fields e workflow dentro do template.
            </span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !form.name}>
            {saving ? <><Loader2 size={13} className="animate-spin" /> Criando...</> : 'Criar template'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TemplatesPage() {
  const router = useRouter()
  const { templates, loading, reload, createTemplate } = useTemplates()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'global' | 'custom'>('all')
  const [detail, setDetail] = useState<Template | null>(null)
  const [newOpen, setNewOpen] = useState(false)

  const filtered = templates.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
    const matchFilter = filter === 'all' || (filter === 'global' ? t.is_global : !t.is_global)
    return matchSearch && matchFilter
  })

  const handleCreate = async (data: { name: string; description: string; icon: string; tags: string[] }) => {
    await createTemplate({
      name: data.name,
      description: data.description || undefined,
      icon: data.icon || undefined,
      is_global: true,
      config: {
        hierarchy: { levels: [], requiresPremium: false },
        issueTypes: [],
        customFields: [],
        workflow: { statuses: [], transitions: [] },
        automations: [],
      },
      tags: data.tags,
      created_by: 'ntt-data-user',
    })
  }

  if (loading) {
    return (
      <div className="templates-page">
        <div className="page-header">
          <div>
            <h1>Templates</h1>
            <p>Biblioteca global NTT DATA — reutilize configuracoes completas de projeto</p>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80 }}>
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--brand)' }} />
          <span style={{ marginLeft: 12, color: 'var(--text-muted)' }}>Carregando templates...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="templates-page">
      <div className="page-header">
        <div>
          <h1>Templates</h1>
          <p>Biblioteca global NTT DATA — reutilize configuracoes completas de projeto</p>
        </div>
        <button className="btn btn-primary" onClick={() => setNewOpen(true)}>
          <Plus size={14} /> Novo template
        </button>
      </div>

      <div className="toolbar">
        <div className="search-input" style={{ maxWidth: 320 }}>
          <Search size={14} className="search-icon" />
          <input type="text" placeholder="Buscar templates..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="filter-tabs">
          {(['all', 'global', 'custom'] as const).map(f => (
            <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Todos' : f === 'global' ? <><Globe size={12} /> Globais</> : <><Lock size={12} /> Privados</>}
            </button>
          ))}
        </div>
      </div>

      <div className="templates-grid">
        {filtered.map(t => {
          const issueTypes = t.config?.issueTypes ?? []
          const customFields = t.config?.customFields ?? []
          const workflowStatuses = t.config?.workflow?.statuses ?? []

          return (
            <div key={t.id} className="template-card card card-hover" onClick={() => setDetail(t)}>
              <div className="tc-header">
                <div className="tc-icon">{t.icon || '📋'}</div>
                <div className="tc-badges">
                  {t.is_global
                    ? <span className="badge badge-blue"><Globe size={9} /> Global</span>
                    : <span className="badge badge-muted"><Lock size={9} /> Privado</span>
                  }
                  {t.used_count > 0 && (
                    <span className="badge badge-brand"><Star size={9} /> {t.used_count}x</span>
                  )}
                </div>
              </div>
              <div className="tc-name">{t.name}</div>
              <div className="tc-desc">{t.description}</div>
              <div className="tc-tags">
                {t.tags.map(tag => <span key={tag} className="badge badge-muted">{tag}</span>)}
              </div>
              <div className="tc-summary">
                <span><BookOpen size={11} /> {issueTypes.length} types</span>
                <span><Tag size={11} /> {customFields.length} fields</span>
                <span>{workflowStatuses.length} statuses</span>
              </div>
              <div className="tc-actions" onClick={e => e.stopPropagation()}>
                <button className="btn btn-sm btn-ghost"><Edit3 size={12} /></button>
                <button className="btn btn-sm btn-ghost"><Copy size={12} /></button>
                <button className="btn btn-sm btn-ghost"><Trash2 size={12} style={{ color: 'var(--red)' }} /></button>
                <button className="btn btn-sm btn-primary" style={{ marginLeft: 'auto' }}
                  onClick={() => setDetail(t)}>
                  Ver <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )
        })}

        <div className="template-card card new-card" onClick={() => setNewOpen(true)}>
          <div className="new-card-inner">
            <div className="new-card-icon"><Plus size={20} /></div>
            <div className="new-card-label">Criar template</div>
            <div className="new-card-hint">em branco ou a partir de um existente</div>
          </div>
        </div>
      </div>

      {detail && (
        <TemplateDetail
          template={detail}
          onClose={() => setDetail(null)}
          onUse={() => { setDetail(null); router.push(`/builder?template=${detail.id}`) }}
        />
      )}
      {newOpen && <NewTemplateModal onClose={() => setNewOpen(false)} onCreate={handleCreate} />}

    </div>
  )
}
