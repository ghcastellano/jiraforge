'use client'

import { useState } from 'react'
import {
  Check, ChevronRight, Plus, Trash2, GripVertical,
  Loader2, Zap, AlertTriangle, ExternalLink, RefreshCw,
  ArrowLeft, Rocket
} from 'lucide-react'

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

const TEMPLATES = [
  { id: '1', name: 'Scrum + Advanced Roadmaps', icon: '🚀', desc: 'Iniciativa → Épico → US/Bug · 3 níveis · Jira Premium', premium: true, tags: ['Scrum','Roadmaps'] },
  { id: '2', name: 'Kanban simples', icon: '📋', desc: 'Fluxo contínuo sem sprints', premium: false, tags: ['Kanban'] },
  { id: '3', name: 'SAFe-lite', icon: '⚡', desc: 'Portfolio → Programa → Time · escala', premium: true, tags: ['SAFe','Enterprise'] },
  { id: '4', name: 'Suporte / ITSM', icon: '🔧', desc: 'Incidentes, mudanças, SLAs', premium: false, tags: ['ITSM'] },
  { id: '5', name: 'Data Project', icon: '📊', desc: 'Pipelines, datasets, dashboards', premium: false, tags: ['Data'] },
  { id: '6', name: 'Em branco', icon: '✨', desc: 'Configuração livre do zero', premium: false, tags: [] },
]

const DEFAULT_ISSUE_TYPES = [
  { id: '1', name: 'Iniciativa', level: 3, color: '#f59e0b', icon: '🎯', tag: 'Roadmaps' },
  { id: '2', name: 'Épico',      level: 2, color: '#a89cf7', icon: '⚡', tag: 'Padrão'   },
  { id: '3', name: 'User Story', level: 1, color: '#3b82f6', icon: '📝', tag: 'Padrão'   },
  { id: '4', name: 'Bug',        level: 1, color: '#ef4444', icon: '🐛', tag: 'Padrão'   },
  { id: '5', name: 'Subtask',    level: 0, color: '#22c55e', icon: '✅', tag: 'Sistema'  },
]

const DEFAULT_FIELDS = [
  { id: '1', name: 'OKR Key Result', type: 'text',   required: true,  scope: ['Iniciativa'] },
  { id: '2', name: 'Story Points',   type: 'number', required: false, scope: ['Épico','User Story','Bug'] },
  { id: '3', name: 'Squad',          type: 'select', required: false, scope: ['Épico','User Story'] },
  { id: '4', name: 'Severidade',     type: 'select', required: false, scope: ['Bug'] },
]

const DEFAULT_STATUSES = [
  { id: '1', name: 'Backlog',      category: 'TODO'        },
  { id: '2', name: 'Em progresso', category: 'IN_PROGRESS' },
  { id: '3', name: 'Em revisão',   category: 'IN_PROGRESS' },
  { id: '4', name: 'Done',         category: 'DONE'        },
  { id: '5', name: 'Bloqueado',    category: 'IN_PROGRESS' },
]

const DEFAULT_TRANSITIONS = [
  { from: 'Backlog',      to: 'Em progresso', name: 'Iniciar'   },
  { from: 'Em progresso', to: 'Em revisão',   name: 'Revisar'   },
  { from: 'Em revisão',   to: 'Done',         name: 'Aprovar'   },
  { from: 'Em revisão',   to: 'Em progresso', name: 'Reprovar'  },
  { from: '*',            to: 'Bloqueado',    name: 'Bloquear'  },
  { from: 'Bloqueado',    to: 'Em progresso', name: 'Desbloquear' },
]

const CATEGORY_COLOR: Record<string, string> = {
  TODO: 'var(--text-muted)',
  IN_PROGRESS: 'var(--brand-light)',
  DONE: 'var(--green)',
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

function StepTemplate({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <div className="step-content">
      <div className="step-header">
        <h3>Escolha um template</h3>
        <p>Ponto de partida — tudo pode ser customizado nos próximos steps</p>
      </div>
      <div className="template-grid">
        {TEMPLATES.map(t => (
          <div
            key={t.id}
            className={`template-card ${selected === t.id ? 'selected' : ''}`}
            onClick={() => onSelect(t.id)}
          >
            <div className="template-icon">{t.icon}</div>
            <div className="template-name">{t.name}</div>
            <div className="template-desc">{t.desc}</div>
            <div className="template-tags">
              {t.tags.map(tag => (
                <span key={tag} className="badge badge-muted">{tag}</span>
              ))}
              {t.premium && <span className="badge badge-amber">Premium</span>}
            </div>
            {selected === t.id && (
              <div className="template-check"><Check size={12} /></div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Step 2: Project ──────────────────────────────────────

function StepProject({ form, onChange, tenants }: {
  form: Record<string, string>
  onChange: (k: string, v: string) => void
  tenants: { id: string; name: string; connections: { id: string; name: string }[] }[]
}) {
  const selectedTenant = tenants.find(t => t.id === form.tenant_id)

  return (
    <div className="step-content">
      <div className="step-header">
        <h3>Dados do projeto</h3>
        <p>Informações básicas que serão enviadas para o Jira</p>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Cliente (tenant)</label>
          <select value={form.tenant_id} onChange={e => onChange('tenant_id', e.target.value)}>
            <option value="">Selecione o cliente…</option>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Conexão Jira</label>
          <select
            value={form.connection_id}
            onChange={e => onChange('connection_id', e.target.value)}
            disabled={!selectedTenant}
          >
            <option value="">Selecione a conexão…</option>
            {selectedTenant?.connections.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
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
          <span className="form-hint">Máx. 10 chars, maiúsculas, sem espaços</span>
        </div>
        <div className="form-group">
          <label className="form-label">Tipo de projeto</label>
          <select value={form.project_type} onChange={e => onChange('project_type', e.target.value)}>
            <option value="scrum">Scrum (com sprints)</option>
            <option value="kanban">Kanban</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Descrição <span style={{ color: 'var(--text-muted)' }}>(opcional)</span></label>
        <textarea
          placeholder="Breve descrição do projeto"
          value={form.description}
          onChange={e => onChange('description', e.target.value)}
          style={{ height: 72 }}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Hierarquia (Advanced Roadmaps)</label>
        <div className="hierarchy-row">
          {['Iniciativa', 'Épico', 'User Story / Bug'].map((level, i, arr) => (
            <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="hier-pill">{level}</span>
              {i < arr.length - 1 && <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Step 3: Issue Types ──────────────────────────────────

function StepIssueTypes({ types, setTypes }: {
  types: typeof DEFAULT_ISSUE_TYPES
  setTypes: (t: typeof DEFAULT_ISSUE_TYPES) => void
}) {
  return (
    <div className="step-content">
      <div className="step-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3>Issue types</h3>
          <p>Hierarquia completa para Advanced Roadmaps</p>
        </div>
        <button className="btn btn-sm btn-primary">
          <Plus size={12} /> Adicionar
        </button>
      </div>

      <div className="list-section">
        {types.map((it, i) => (
          <div key={it.id} className="list-row">
            <GripVertical size={14} style={{ color: 'var(--text-muted)', cursor: 'grab', flexShrink: 0 }} />
            <div className="it-icon" style={{ background: it.color + '22', border: `1px solid ${it.color}44` }}>
              <span style={{ fontSize: 14 }}>{it.icon}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{it.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Nível {it.level}</div>
            </div>
            <span className={`badge ${it.tag === 'Roadmaps' ? 'badge-amber' : it.tag === 'Sistema' ? 'badge-green' : 'badge-brand'}`}>
              {it.tag}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-icon btn-sm btn-ghost"><Trash2 size={12} style={{ color: 'var(--red)' }} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Step 4: Custom Fields ────────────────────────────────

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Texto', number: 'Número', select: 'Select',
  multiselect: 'Multi-select', date: 'Data', user: 'Usuário',
}

function StepFields({ fields }: { fields: typeof DEFAULT_FIELDS }) {
  return (
    <div className="step-content">
      <div className="step-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3>Custom fields</h3>
          <p>Campos adicionais além dos padrão do Jira</p>
        </div>
        <button className="btn btn-sm btn-primary"><Plus size={12} /> Adicionar</button>
      </div>

      <div className="list-section">
        {fields.map(f => (
          <div key={f.id} className="list-row">
            <div style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 13 }}>
                {{ text: '🔤', number: '🔢', select: '📋', date: '📅', user: '👤' }[f.type] ?? '📝'}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{f.name}</span>
                {f.required && <span className="badge badge-red" style={{ fontSize: 10 }}>obrigatório</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {FIELD_TYPE_LABELS[f.type]} · {f.scope.join(', ')}
              </div>
            </div>
            <button className="btn btn-icon btn-sm btn-ghost"><Trash2 size={12} style={{ color: 'var(--red)' }} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Step 5: Workflow ─────────────────────────────────────

function StepWorkflow({ statuses, transitions }: {
  statuses: typeof DEFAULT_STATUSES
  transitions: typeof DEFAULT_TRANSITIONS
}) {
  return (
    <div className="step-content">
      <div className="step-header">
        <h3>Workflow designer</h3>
        <p>Statuses e transitions que definem como as issues se movem</p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Statuses
        </div>
        <div className="workflow-canvas">
          {statuses.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="status-bubble" style={{ borderColor: CATEGORY_COLOR[s.category] + '60', color: CATEGORY_COLOR[s.category] }}>
                {s.name}
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
          <button className="btn btn-sm"><Plus size={12} /> Transition</button>
        </div>
        <div className="list-section">
          {transitions.map((t, i) => (
            <div key={i} className="list-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                <span className="trans-pill from">{t.from === '*' ? 'Qualquer' : t.from}</span>
                <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
                <span className="trans-pill to">{t.to}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>"{t.name}"</span>
              </div>
              <button className="btn btn-icon btn-sm btn-ghost"><Trash2 size={12} style={{ color: 'var(--red)' }} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Step 6: Schemes ──────────────────────────────────────

function StepSchemes() {
  return (
    <div className="step-content">
      <div className="step-header">
        <h3>Schemes &amp; permissões</h3>
        <p>Configurações administrativas — defaults recomendados para uso interno</p>
      </div>

      {[
        { label: 'Screen scheme',         hint: 'Create / Edit / View screens por issue type',       opts: ['Gerar automaticamente', 'Usar existente'] },
        { label: 'Permission scheme',      hint: 'Quem pode criar, editar, transicionar',             opts: ['NTT DATA Default', 'Criar novo'] },
        { label: 'Notification scheme',    hint: 'Emails por evento',                                opts: ['NTT DATA Default', 'Criar novo'] },
        { label: 'Field configuration',    hint: 'Campos obrigatórios / opcionais',                  opts: ['Gerar automaticamente', 'Customizar'] },
      ].map(item => (
        <div key={item.label} className="scheme-row">
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{item.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.hint}</div>
          </div>
          <select style={{ width: 'auto', minWidth: 180, fontSize: 12 }}>
            {item.opts.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      ))}
    </div>
  )
}

// ─── Step 7: Review & Deploy ──────────────────────────────

function StepReview({
  form,
  onDeploy,
  deploying,
  deployResult,
}: {
  form: Record<string, string>
  onDeploy: () => void
  deploying: boolean
  deployResult: { success?: boolean; steps?: { key: string; label: string; status: string; error?: string }[] } | null
}) {
  return (
    <div className="step-content">
      <div className="step-header">
        <h3>Review &amp; Deploy</h3>
        <p>Tudo pronto para criar no Jira Cloud</p>
      </div>

      {!deploying && !deployResult && (
        <>
          <div className="review-grid">
            <div className="review-block">
              <div className="review-block-title">Projeto</div>
              <div className="review-item"><div className="dot blue" />{form.project_name || '(sem nome)'}</div>
              <div className="review-item"><div className="dot blue" /><code>{form.project_key || 'KEY'}</code> · {form.project_type}</div>
              <div className="review-item"><div className="dot blue" />Advanced Roadmaps ativado</div>
            </div>
            <div className="review-block">
              <div className="review-block-title">Issue types (5)</div>
              <div className="review-item"><div className="dot purple" />Iniciativa, Épico, User Story</div>
              <div className="review-item"><div className="dot purple" />Bug, Subtask</div>
              <div className="review-item"><div className="dot purple" />Hierarquia 3 níveis</div>
            </div>
            <div className="review-block">
              <div className="review-block-title">Custom fields (4)</div>
              <div className="review-item"><div className="dot green" />OKR Key Result · Story Points</div>
              <div className="review-item"><div className="dot green" />Squad · Severidade</div>
            </div>
            <div className="review-block">
              <div className="review-block-title">Workflow (5 statuses)</div>
              <div className="review-item"><div className="dot blue" />Backlog → Em progresso</div>
              <div className="review-item"><div className="dot blue" />→ Em revisão → Done</div>
              <div className="review-item"><div className="dot blue" />+ Bloqueado (qualquer)</div>
            </div>
          </div>

          <div className="api-note">
            <Zap size={13} style={{ color: 'var(--brand-light)', flexShrink: 0 }} />
            <span>Serão executadas ~13 chamadas à Jira API em sequência. O processo leva cerca de 15–30 segundos.</span>
          </div>

          <button className="deploy-btn" onClick={onDeploy}>
            <Rocket size={16} /> Criar projeto no Jira Cloud
          </button>
        </>
      )}

      {deploying && (
        <div className="deploy-progress">
          {[
            { key: 'project',     label: 'Criando projeto' },
            { key: 'issue_types', label: 'Criando issue types' },
            { key: 'workflow',    label: 'Configurando workflow' },
            { key: 'fields',      label: 'Criando custom fields' },
            { key: 'screens',     label: 'Configurando screens' },
            { key: 'schemes',     label: 'Aplicando schemes' },
          ].map((step, i) => (
            <div key={step.key} className="progress-step">
              <div className="progress-dot">
                {i === 1 ? <Loader2 size={13} className="animate-spin" style={{ color: 'var(--brand-light)' }} />
                 : i < 1 ? <Check size={12} style={{ color: 'var(--green)' }} />
                 : <div style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--bg-overlay)', border: '1px solid var(--border)' }} />}
              </div>
              <span style={{ fontSize: 13, color: i <= 1 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {deployResult && (
        <div className={`deploy-result ${deployResult.success ? 'success' : 'error'}`}>
          {deployResult.success ? (
            <>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--green)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Check size={18} /> Projeto criado com sucesso!
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                O projeto <code>{form.project_key}</code> foi criado no Jira com todos os issue types, custom fields, workflow e schemes configurados.
              </div>
              <button className="btn btn-sm" style={{ marginTop: 12 }}>
                <ExternalLink size={12} /> Abrir no Jira
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--red)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} /> Erro durante o deploy
              </div>
              <button className="btn btn-sm" style={{ marginTop: 8 }}>
                <RefreshCw size={12} /> Tentar novamente
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────

const MOCK_TENANTS_SIMPLE = [
  { id: '1', name: 'Avangrid', connections: [{ id: 'c1', name: 'Avangrid Production' }] },
  { id: '2', name: 'Santander', connections: [{ id: 'c2', name: 'Santander BR' }, { id: 'c3', name: 'Santander ES' }] },
]

export default function BuilderPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedTemplate, setSelectedTemplate] = useState('1')
  const [issueTypes, setIssueTypes] = useState(DEFAULT_ISSUE_TYPES)
  const [form, setForm] = useState({
    tenant_id: '1', connection_id: 'c1',
    project_name: '', project_key: '', project_type: 'scrum', description: '',
  })
  const [deploying, setDeploying] = useState(false)
  const [deployResult, setDeployResult] = useState<{ success: boolean } | null>(null)

  const updateForm = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const canProceed = () => {
    if (currentStep === 0) return !!selectedTemplate
    if (currentStep === 1) return !!form.project_name && !!form.project_key && !!form.tenant_id
    return true
  }

  const handleDeploy = async () => {
    setDeploying(true)
    await new Promise(r => setTimeout(r, 3000))
    setDeploying(false)
    setDeployResult({ success: true })
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0: return <StepTemplate selected={selectedTemplate} onSelect={setSelectedTemplate} />
      case 1: return <StepProject form={form} onChange={updateForm} tenants={MOCK_TENANTS_SIMPLE} />
      case 2: return <StepIssueTypes types={issueTypes} setTypes={setIssueTypes} />
      case 3: return <StepFields fields={DEFAULT_FIELDS} />
      case 4: return <StepWorkflow statuses={DEFAULT_STATUSES} transitions={DEFAULT_TRANSITIONS} />
      case 5: return <StepSchemes />
      case 6: return <StepReview form={form} onDeploy={handleDeploy} deploying={deploying} deployResult={deployResult} />
      default: return null
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
                  Próximo <ChevronRight size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
