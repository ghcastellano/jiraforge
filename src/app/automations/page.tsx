'use client'

import { useState } from 'react'
import {
  Zap, Plus, CheckCircle2, XCircle, Clock,
  ToggleLeft, ToggleRight, Trash2, ExternalLink,
  AlertCircle, Loader2, RefreshCw, X, ChevronRight,
  Activity, Wifi
} from 'lucide-react'

const RULE_LABELS: Record<string, { label: string; desc: string; icon: string }> = {
  story_bug_to_epic:    { label: 'Story/Bug → Épico Done',     desc: 'Quando todos os filhos de um épico estiverem Done, move o épico para Done automaticamente.',      icon: '📝' },
  epic_to_initiative:   { label: 'Épico → Iniciativa Done',    desc: 'Quando todos os épicos de uma iniciativa estiverem Done, move a iniciativa para Done.',            icon: '⚡' },
  sprint_close_notify:  { label: 'Sprint fechado c/ issues abertas', desc: 'Notifica via webhook quando um sprint é fechado com issues ainda em aberto.', icon: '🔔' },
}

const MOCK_RULES = [
  {
    id: '1', rule_type: 'story_bug_to_epic', active: true,
    tenant_id: '1', project_key: null,
    trigger_count: 47, last_triggered_at: '2025-03-20T09:14:00Z',
    last_error: null, webhook_id: '10023',
    connection: { id: 'c1', name: 'Avangrid Production', jira_base_url: 'https://avangrid.atlassian.net' },
    tenant: { name: 'Avangrid' },
  },
  {
    id: '2', rule_type: 'epic_to_initiative', active: true,
    tenant_id: '1', project_key: 'DAP',
    trigger_count: 12, last_triggered_at: '2025-03-19T16:30:00Z',
    last_error: null, webhook_id: '10024',
    connection: { id: 'c1', name: 'Avangrid Production', jira_base_url: 'https://avangrid.atlassian.net' },
    tenant: { name: 'Avangrid' },
  },
  {
    id: '3', rule_type: 'story_bug_to_epic', active: true,
    tenant_id: '2', project_key: null,
    trigger_count: 8, last_triggered_at: '2025-03-18T11:00:00Z',
    last_error: null, webhook_id: '10025',
    connection: { id: 'c2', name: 'Santander BR', jira_base_url: 'https://santander-br.atlassian.net' },
    tenant: { name: 'Santander' },
  },
  {
    id: '4', rule_type: 'epic_to_initiative', active: false,
    tenant_id: '2', project_key: null,
    trigger_count: 2, last_triggered_at: '2025-03-10T08:00:00Z',
    last_error: 'Webhook timeout — Jira não respondeu em 30s',
    webhook_id: '10026',
    connection: { id: 'c3', name: 'Santander ES', jira_base_url: 'https://santander-es.atlassian.net' },
    tenant: { name: 'Santander' },
  },
]

const MOCK_LOGS = [
  { id: '1', rule_id: '1', trigger_issue: 'AVNG-87', result: 'rolled_up', details: { parent: 'AVNG-14', children_count: 5 }, duration_ms: 312, created_at: '2025-03-20T09:14:00Z' },
  { id: '2', rule_id: '1', trigger_issue: 'AVNG-82', result: 'skipped',   details: { reason: '2 children still open' }, duration_ms: 180, created_at: '2025-03-20T08:30:00Z' },
  { id: '3', rule_id: '2', trigger_issue: 'DAP-31',  result: 'rolled_up', details: { parent: 'DAP-5', children_count: 3 }, duration_ms: 290, created_at: '2025-03-19T16:30:00Z' },
  { id: '4', rule_id: '4', trigger_issue: 'SANT-12', result: 'error',     details: { reason: 'Webhook timeout' }, duration_ms: 30000, created_at: '2025-03-10T08:00:00Z' },
]

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
  rule: typeof MOCK_RULES[0]
  onToggle: (id: string, active: boolean) => void
  onDelete: (id: string) => void
  onShowLogs: (id: string) => void
}) {
  const info = RULE_LABELS[rule.rule_type]
  const logs = MOCK_LOGS.filter(l => l.rule_id === rule.id)
  const lastLog = logs[0]

  return (
    <div className={`rule-card ${!rule.active ? 'inactive' : ''}`}>
      <div className="rule-header">
        <div className="rule-left">
          <div className="rule-icon">{info.icon}</div>
          <div>
            <div className="rule-name">{info.label}</div>
            <div className="rule-meta">
              <Wifi size={11} /> {rule.connection.name}
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
        <span className="flow-pill trigger">Issue transicionada → Done</span>
        <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
        <span className="flow-pill condition">todos irmãos Done?</span>
        <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
        <span className="flow-pill action">Pai → Done</span>
        <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto', fontSize: 11 }} onClick={() => onShowLogs(rule.id)}>
          <Activity size={11} /> Ver logs
        </button>
      </div>

      {lastLog && (
        <div className="rule-last">
          Último trigger: <strong>{lastLog.trigger_issue}</strong> →
          <span className={lastLog.result === 'rolled_up' ? 'text-green' : lastLog.result === 'error' ? 'text-red' : 'text-muted'}>
            {' '}{lastLog.result === 'rolled_up' ? '✓ roll-up executado' : lastLog.result === 'skipped' ? '— ignorado' : '✕ erro'}
          </span>
          <span className="muted"> · {lastLog.duration_ms}ms · {new Date(lastLog.created_at).toLocaleDateString('pt-BR')}</span>
        </div>
      )}
    </div>
  )
}

function LogsModal({ ruleId, onClose }: { ruleId: string; onClose: () => void }) {
  const logs = MOCK_LOGS.filter(l => l.rule_id === ruleId)
  const info = RULE_LABELS[MOCK_RULES.find(r => r.id === ruleId)?.rule_type ?? '']

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Logs de execução</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{info?.label}</p>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {logs.length === 0
            ? <div className="empty-state"><div className="empty-icon"><Activity size={18} /></div><div className="empty-title">Sem logs ainda</div></div>
            : logs.map(log => (
              <div key={log.id} className={`log-row ${log.result}`}>
                <div className={`log-dot ${log.result}`} />
                <div style={{ flex: 1 }}>
                  <div className="log-title">
                    <strong>{log.trigger_issue}</strong>
                    <span className={`badge ${log.result === 'rolled_up' ? 'badge-green' : log.result === 'error' ? 'badge-red' : 'badge-muted'}`}>
                      {log.result === 'rolled_up' ? 'Roll-up executado' : log.result === 'skipped' ? 'Ignorado' : 'Erro'}
                    </span>
                  </div>
                  <div className="log-detail">
                    {log.result === 'rolled_up' && `Pai: ${(log.details as { parent: string }).parent} · ${(log.details as { children_count: number }).children_count} filhos concluídos`}
                    {log.result === 'skipped' && (log.details as { reason: string }).reason}
                    {log.result === 'error' && (log.details as { reason: string }).reason}
                    <span className="muted"> · {log.duration_ms}ms · {new Date(log.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

export default function AutomationsPage() {
  const [rules, setRules] = useState(MOCK_RULES)
  const [logsModal, setLogsModal] = useState<string | null>(null)
  const [filterTenant, setFilterTenant] = useState('all')

  const tenants = [...new Map(rules.map(r => [r.tenant_id, r.tenant.name])).entries()]

  const filtered = rules.filter(r => filterTenant === 'all' || r.tenant_id === filterTenant)

  const toggle = (id: string, active: boolean) =>
    setRules(rs => rs.map(r => r.id === id ? { ...r, active } : r))

  const del = (id: string) => setRules(rs => rs.filter(r => r.id !== id))

  const active = rules.filter(r => r.active).length
  const total  = rules.length
  const errors = rules.filter(r => r.last_error).length

  return (
    <div className="automations-page">
      <div className="page-header">
        <div>
          <h1>Roll-up Rules</h1>
          <p>Automações de hierarquia implementadas via webhook service</p>
        </div>
        <button className="btn btn-primary"><Plus size={14} /> Nova rule</button>
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
        <div className="stat-card">
          <span className="stat-value">{MOCK_LOGS.filter(l => l.result === 'rolled_up').length}</span>
          <span className="stat-label">Roll-ups executados</span>
        </div>
      </div>

      <div className="toolbar">
        <div className="filter-tabs">
          <button className={`filter-tab ${filterTenant === 'all' ? 'active' : ''}`} onClick={() => setFilterTenant('all')}>Todos os clientes</button>
          {tenants.map(([id, name]) => (
            <button key={id} className={`filter-tab ${filterTenant === id ? 'active' : ''}`} onClick={() => setFilterTenant(id)}>{name}</button>
          ))}
        </div>
      </div>

      <div className="rules-list">
        {filtered.map(r => (
          <RuleCard
            key={r.id}
            rule={r}
            onToggle={toggle}
            onDelete={del}
            onShowLogs={setLogsModal}
          />
        ))}
        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon"><Zap size={20} /></div>
            <div className="empty-title">Nenhuma rule encontrada</div>
            <div className="empty-desc">Crie uma rule de roll-up para este cliente</div>
            <button className="btn btn-primary"><Plus size={14} /> Nova rule</button>
          </div>
        )}
      </div>

      {logsModal && <LogsModal ruleId={logsModal} onClose={() => setLogsModal(null)} />}

      <style jsx>{`
        .automations-page { max-width: 860px; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
        .page-header h1 { margin-bottom: 4px; }
        .page-header p { font-size: 13px; color: var(--text-muted); }

        .service-bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; border-radius: var(--radius-md);
          border: 1px solid; margin-bottom: 20px;
          background: var(--green-bg); border-color: var(--green-border);
        }
        .service-bar.offline { background: var(--red-bg); border-color: var(--red-border); }
        .service-left { display: flex; align-items: center; gap: 12px; }
        .service-dot { width: 8px; height: 8px; border-radius: 50%; }
        .service-dot.online { background: var(--green); box-shadow: 0 0 6px var(--green); animation: pulse 2s ease infinite; }
        .service-dot.offline { background: var(--red); }
        .service-title { font-size: 13px; font-weight: 500; color: var(--text-primary); }
        .service-sub { font-size: 11px; color: var(--text-muted); }

        .stats-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
        .stat-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px 16px; display: flex; flex-direction: column; gap: 3px; }
        .stat-value { font-size: 22px; font-weight: 600; color: var(--text-primary); line-height: 1; }
        .stat-label { font-size: 11px; color: var(--text-muted); }

        .toolbar { margin-bottom: 16px; }
        .filter-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
        .filter-tab { display: flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: var(--radius-md); font-size: 12px; font-weight: 500; background: none; border: 1px solid transparent; color: var(--text-muted); cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .filter-tab:hover { background: var(--bg-elevated); color: var(--text-secondary); }
        .filter-tab.active { background: var(--brand-dim); border-color: var(--brand-border); color: var(--brand-light); }

        .rules-list { display: flex; flex-direction: column; gap: 10px; }

        .rule-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 16px; transition: border-color 0.15s; }
        .rule-card:hover { border-color: var(--border-light); }
        .rule-card.inactive { opacity: 0.6; }

        .rule-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
        .rule-left { display: flex; align-items: flex-start; gap: 10px; }
        .rule-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .rule-icon { width: 32px; height: 32px; border-radius: 8px; background: var(--brand-dim); border: 1px solid var(--brand-border); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
        .rule-name { font-size: 14px; font-weight: 500; color: var(--text-primary); }
        .rule-meta { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-muted); margin-top: 2px; }
        .dot-sep::before { content: '·'; }

        .rule-desc { font-size: 12px; color: var(--text-muted); margin-bottom: 10px; }

        .rule-error { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--red); background: var(--red-bg); border: 1px solid var(--red-border); border-radius: var(--radius-md); padding: 8px 10px; margin-bottom: 10px; }

        .rule-flow { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 10px 12px; background: var(--bg-elevated); border-radius: var(--radius-md); }
        .flow-pill { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; }
        .flow-pill.trigger   { background: var(--blue-bg);   color: var(--blue);         border: 1px solid var(--blue-border); }
        .flow-pill.condition { background: var(--amber-bg);  color: var(--amber);         border: 1px solid var(--amber-border); }
        .flow-pill.action    { background: var(--green-bg);  color: var(--green);         border: 1px solid var(--green-border); }

        .rule-last { font-size: 11px; color: var(--text-muted); margin-top: 8px; }
        .text-green { color: var(--green); }
        .text-red { color: var(--red); }
        .text-muted { color: var(--text-muted); }
        .muted { color: var(--text-muted); }

        /* Logs modal */
        .modal-lg { max-width: 560px; }
        .log-row { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
        .log-row:last-child { border-bottom: none; }
        .log-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
        .log-dot.rolled_up { background: var(--green); }
        .log-dot.skipped   { background: var(--text-muted); }
        .log-dot.error     { background: var(--red); }
        .log-title { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
        .log-detail { font-size: 11px; color: var(--text-muted); }

        /* Modals */
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px; }
        .modal { background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: var(--radius-xl); width: 100%; max-width: 480px; box-shadow: 0 20px 60px rgba(0,0,0,0.6); animation: fadeIn 0.15s ease; }
        .modal-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 20px 20px 0; }
        .modal-body { padding: 20px; }
        .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 0 20px 20px; }

        @media (max-width: 640px) { .stats-row { grid-template-columns: repeat(3, 1fr); } }
      `}</style>
    </div>
  )
}
