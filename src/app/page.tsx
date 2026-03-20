'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  FolderKanban, Building2, Zap, Activity,
  Plus, ArrowRight, CheckCircle2, Clock, XCircle,
  TrendingUp, Wifi
} from 'lucide-react'

const RECENT_PROJECTS = [
  { id: '1', name: 'Autonomous Intelligence Platform', key: 'AIN', tenant: 'NTT DATA', status: 'success', created_at: '2025-03-20', template: 'Scrum + Roadmaps' },
  { id: '2', name: 'Data & Analytics Platform',        key: 'DAP', tenant: 'Avangrid', status: 'success', created_at: '2025-03-18', template: 'Scrum + Roadmaps' },
  { id: '3', name: 'BI Modernization',                 key: 'BIM', tenant: 'Avangrid', status: 'success', created_at: '2025-03-15', template: 'Kanban simples' },
  { id: '4', name: 'Risk & Compliance Platform',       key: 'RCP', tenant: 'Santander', status: 'failed', created_at: '2025-03-12', template: 'SAFe-lite' },
]

const ACTIVITY = [
  { id: '1', type: 'rollup',  msg: 'Épico AVNG-14 movido para Done (todos os stories concluídos)',  tenant: 'Avangrid',  time: '2h atrás',  ok: true },
  { id: '2', type: 'rollup',  msg: 'Iniciativa AIN-2 movida para Done',                            tenant: 'NTT DATA',  time: '5h atrás',  ok: true },
  { id: '3', type: 'error',   msg: 'Webhook timeout ao processar SANT-8',                          tenant: 'Santander', time: '1d atrás',  ok: false },
  { id: '4', type: 'deploy',  msg: 'Projeto DAP criado com sucesso (13 steps)',                    tenant: 'Avangrid',  time: '2d atrás',  ok: true },
]

const STATUS_ICON = {
  success: <CheckCircle2 size={14} style={{ color: 'var(--green)' }} />,
  failed:  <XCircle size={14}      style={{ color: 'var(--red)' }}   />,
  pending: <Clock size={14}        style={{ color: 'var(--amber)' }} />,
}

export default function DashboardPage() {
  const [_tab, setTab] = useState('overview')

  return (
    <div className="dashboard">

      {/* Header */}
      <div className="dash-header">
        <div>
          <h1>Dashboard</h1>
          <p>Visão geral do JiraForge · NTT DATA D&amp;A</p>
        </div>
        <Link href="/builder" className="btn btn-primary">
          <Plus size={14} /> Novo projeto
        </Link>
      </div>

      {/* Metrics */}
      <div className="metrics-grid">
        {[
          { label: 'Projetos criados', value: '7',  sub: 'via JiraForge', icon: FolderKanban, color: 'brand' },
          { label: 'Clientes ativos',  value: '3',  sub: 'Avangrid, Santander +1', icon: Building2, color: 'blue' },
          { label: 'Roll-up rules',    value: '5',  sub: 'todas ativas', icon: Zap, color: 'green' },
          { label: 'Eventos hoje',     value: '12', sub: '↑ 3 roll-ups executados', icon: TrendingUp, color: 'amber' },
        ].map(m => {
          const Icon = m.icon
          return (
            <div key={m.label} className="metric-card">
              <div className={`metric-icon ${m.color}`}><Icon size={16} /></div>
              <div>
                <div className="metric-value">{m.value}</div>
                <div className="metric-label">{m.label}</div>
                <div className="metric-sub">{m.sub}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Content grid */}
      <div className="content-grid">

        {/* Recent projects */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Projetos recentes</span>
            <Link href="/builder" className="btn btn-sm" style={{ gap: 4 }}>
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Projeto</th>
                <th>Cliente</th>
                <th>Template</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_PROJECTS.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</div>
                    <code style={{ fontSize: 11 }}>{p.key}</code>
                  </td>
                  <td>{p.tenant}</td>
                  <td style={{ fontSize: 12 }}>{p.template}</td>
                  <td>{STATUS_ICON[p.status as keyof typeof STATUS_ICON]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div className="right-col">

          {/* Connection health */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header" style={{ marginBottom: 12 }}>
              <span className="card-title">Conexões Jira</span>
              <Link href="/clients" className="btn btn-sm">Gerenciar</Link>
            </div>
            {[
              { name: 'Avangrid Production', url: 'avangrid.atlassian.net', ok: true },
              { name: 'Santander BR',        url: 'santander-br.atlassian.net', ok: true },
              { name: 'Santander ES',        url: 'santander-es.atlassian.net', ok: false },
            ].map(c => (
              <div key={c.name} className="conn-row">
                <div className={`conn-dot ${c.ok ? 'ok' : 'err'}`} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.url}</div>
                </div>
                <Wifi size={13} style={{ color: c.ok ? 'var(--green)' : 'var(--red)', flexShrink: 0 }} />
              </div>
            ))}
          </div>

          {/* Activity */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: 12 }}>
              <span className="card-title">Atividade recente</span>
              <Link href="/activity" className="btn btn-sm">Ver log</Link>
            </div>
            {ACTIVITY.map(a => (
              <div key={a.id} className="activity-row">
                <div className={`act-dot ${a.ok ? 'ok' : 'err'}`}>
                  {a.ok ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{a.msg}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{a.tenant}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{a.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

    </div>
  )
}
