'use client'

import { useState } from 'react'
import { Activity, CheckCircle2, XCircle, Clock, FolderKanban, Zap, Search, Filter } from 'lucide-react'

const MOCK_ACTIVITY = [
  { id: '1',  type: 'rollup',  result: 'success', msg: 'Épico AVNG-14 movido para Done — todos os 5 stories concluídos',            tenant: 'Avangrid',  project: 'DAP',  time: '2025-03-20T09:14:00Z', ms: 312 },
  { id: '2',  type: 'rollup',  result: 'skipped', msg: 'Issue AVNG-82 processada — 2 irmãos ainda em aberto, roll-up ignorado',     tenant: 'Avangrid',  project: 'DAP',  time: '2025-03-20T08:30:00Z', ms: 180 },
  { id: '3',  type: 'deploy',  result: 'success', msg: 'Projeto AIN criado com sucesso no Jira (13 steps, ~18s)',                   tenant: 'NTT DATA',  project: 'AIN',  time: '2025-03-20T07:00:00Z', ms: 18400 },
  { id: '4',  type: 'rollup',  result: 'success', msg: 'Iniciativa AIN-2 movida para Done — todos os 3 épicos concluídos',          tenant: 'NTT DATA',  project: 'AIN',  time: '2025-03-19T16:30:00Z', ms: 290 },
  { id: '5',  type: 'deploy',  result: 'success', msg: 'Projeto DAP criado com sucesso no Jira (13 steps, ~22s)',                   tenant: 'Avangrid',  project: 'DAP',  time: '2025-03-18T14:00:00Z', ms: 22100 },
  { id: '6',  type: 'rollup',  result: 'success', msg: 'Épico SANT-9 movido para Done — todos os 4 stories concluídos',            tenant: 'Santander', project: 'RCP',  time: '2025-03-18T11:00:00Z', ms: 245 },
  { id: '7',  type: 'deploy',  result: 'partial', msg: 'Projeto RCP criado parcialmente — erro ao aplicar permission scheme',       tenant: 'Santander', project: 'RCP',  time: '2025-03-12T09:00:00Z', ms: 12000 },
  { id: '8',  type: 'rollup',  result: 'error',   msg: 'Webhook timeout ao processar SANT-8 — Jira não respondeu em 30s',          tenant: 'Santander', project: 'SANT', time: '2025-03-10T08:00:00Z', ms: 30000 },
  { id: '9',  type: 'connection', result: 'success', msg: 'Conexão Avangrid Production verificada — token ativo',                  tenant: 'Avangrid',  project: null,   time: '2025-03-20T06:00:00Z', ms: 420 },
  { id: '10', type: 'connection', result: 'error',   msg: 'Conexão Santander ES com erro — token expirado',                        tenant: 'Santander', project: null,   time: '2025-03-18T06:00:00Z', ms: 1200 },
]

const TYPE_CONFIG = {
  rollup:     { label: 'Roll-up',   icon: Zap,           color: 'brand' },
  deploy:     { label: 'Deploy',    icon: FolderKanban,  color: 'blue'  },
  connection: { label: 'Conexão',   icon: Activity,      color: 'amber' },
}

const RESULT_CONFIG = {
  success: { icon: CheckCircle2, cls: 'badge-green',  label: 'Sucesso'  },
  skipped: { icon: Clock,        cls: 'badge-muted',  label: 'Ignorado' },
  partial: { icon: Clock,        cls: 'badge-amber',  label: 'Parcial'  },
  error:   { icon: XCircle,      cls: 'badge-red',    label: 'Erro'     },
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

export default function ActivityPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [resultFilter, setResultFilter] = useState('all')

  const filtered = MOCK_ACTIVITY.filter(a => {
    const matchSearch = a.msg.toLowerCase().includes(search.toLowerCase()) ||
      a.tenant.toLowerCase().includes(search.toLowerCase()) ||
      (a.project ?? '').toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || a.type === typeFilter
    const matchResult = resultFilter === 'all' || a.result === resultFilter
    return matchSearch && matchType && matchResult
  })

  return (
    <div className="activity-page">
      <div className="page-header">
        <div>
          <h1>Atividade</h1>
          <p>Log de todos os eventos — deploys, roll-ups, health checks</p>
        </div>
      </div>

      {/* Filters */}
      <div className="toolbar">
        <div className="search-input">
          <Search size={14} className="search-icon" />
          <input type="text" placeholder="Buscar eventos…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Filter size={13} style={{ color: 'var(--text-muted)' }} />
          <select style={{ width: 'auto', fontSize: 12 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">Todos os tipos</option>
            <option value="rollup">Roll-up</option>
            <option value="deploy">Deploy</option>
            <option value="connection">Conexão</option>
          </select>
          <select style={{ width: 'auto', fontSize: 12 }} value={resultFilter} onChange={e => setResultFilter(e.target.value)}>
            <option value="all">Todos os resultados</option>
            <option value="success">Sucesso</option>
            <option value="skipped">Ignorado</option>
            <option value="partial">Parcial</option>
            <option value="error">Erro</option>
          </select>
        </div>
      </div>

      {/* Log table */}
      <div className="log-table card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Activity size={20} /></div>
            <div className="empty-title">Nenhum evento encontrado</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Evento</th>
                <th>Tipo</th>
                <th>Cliente</th>
                <th>Projeto</th>
                <th>Duração</th>
                <th>Resultado</th>
                <th>Quando</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const typeCfg = TYPE_CONFIG[a.type as keyof typeof TYPE_CONFIG]
                const resCfg = RESULT_CONFIG[a.result as keyof typeof RESULT_CONFIG]
                const TypeIcon = typeCfg.icon
                const ResIcon = resCfg.icon
                return (
                  <tr key={a.id}>
                    <td style={{ maxWidth: 340 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>{a.msg}</div>
                    </td>
                    <td>
                      <span className={`badge badge-${typeCfg.color === 'brand' ? 'brand' : typeCfg.color === 'blue' ? 'blue' : 'amber'}`}>
                        <TypeIcon size={9} /> {typeCfg.label}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{a.tenant}</td>
                    <td>{a.project ? <code style={{ fontSize: 11 }}>{a.project}</code> : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>{formatMs(a.ms)}</td>
                    <td>
                      <span className={`badge ${resCfg.cls}`}>
                        <ResIcon size={9} /> {resCfg.label}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatTime(a.time)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  )
}
