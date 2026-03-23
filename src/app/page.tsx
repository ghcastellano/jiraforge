'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  FolderKanban, Building2, Zap, Activity,
  Plus, ArrowRight, CheckCircle2, Clock, XCircle,
  TrendingUp, Wifi
} from 'lucide-react'
import { useTenants, useConnections, useProjects } from '@/hooks'

const STATUS_ICON = {
  success:     <CheckCircle2 size={14} style={{ color: 'var(--green)' }} />,
  partial:     <CheckCircle2 size={14} style={{ color: 'var(--amber)' }} />,
  failed:      <XCircle size={14}      style={{ color: 'var(--red)' }}   />,
  pending:     <Clock size={14}        style={{ color: 'var(--amber)' }} />,
  in_progress: <Clock size={14}        style={{ color: 'var(--blue)' }}  />,
}

function SkeletonLine({ width = '100%' }: { width?: string }) {
  return (
    <div
      style={{
        height: 14,
        width,
        borderRadius: 4,
        background: 'var(--border)',
        opacity: 0.5,
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  )
}

function MetricSkeleton() {
  return (
    <div className="metric-card" style={{ opacity: 0.6 }}>
      <div className="metric-icon brand" style={{ opacity: 0.3 }}>
        <div style={{ width: 16, height: 16 }} />
      </div>
      <div style={{ flex: 1 }}>
        <SkeletonLine width="40px" />
        <div style={{ marginTop: 6 }}><SkeletonLine width="80px" /></div>
        <div style={{ marginTop: 4 }}><SkeletonLine width="120px" /></div>
      </div>
    </div>
  )
}

function TableSkeleton() {
  return (
    <tbody>
      {[1, 2, 3].map(i => (
        <tr key={i}>
          <td><SkeletonLine width="140px" /></td>
          <td><SkeletonLine width="80px" /></td>
          <td><SkeletonLine width="100px" /></td>
          <td><SkeletonLine width="20px" /></td>
        </tr>
      ))}
    </tbody>
  )
}

export default function DashboardPage() {
  const { tenants, loading: tenantsLoading } = useTenants()
  const { projects, loading: projectsLoading } = useProjects()

  // Pick the first tenant that has connections to display
  const firstTenantId = useMemo(() => {
    if (!tenants.length) return null
    // Prefer a tenant with connections_count > 0, else just use the first
    const withConns = tenants.find(t => (t.connections_count ?? 0) > 0)
    return withConns?.id ?? tenants[0]?.id ?? null
  }, [tenants])

  const { connections, loading: connectionsLoading } = useConnections(firstTenantId)

  const isLoading = tenantsLoading || projectsLoading

  // Computed metrics
  const totalProjects = useMemo(() => {
    return projects.length
  }, [projects])

  const activeClients = useMemo(() => {
    return tenants.length
  }, [tenants])

  const activeConnections = useMemo(() => {
    return connections.filter(c => c.status === 'active').length
  }, [connections])

  const totalRules = useMemo(() => {
    return tenants.reduce((sum, t) => sum + (t.active_rules_count ?? 0), 0)
  }, [tenants])

  const clientNames = useMemo(() => {
    if (!tenants.length) return 'nenhum'
    const names = tenants.slice(0, 2).map(t => t.name)
    if (tenants.length > 2) names.push(`+${tenants.length - 2}`)
    return names.join(', ')
  }, [tenants])

  // Recent projects: last 5 sorted by created_at desc
  const recentProjects = useMemo(() => {
    return [...projects]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
  }, [projects])

  return (
    <div className="dashboard">

      {/* Header */}
      <div className="dash-header">
        <div>
          <h1>Dashboard</h1>
          <p>Visão geral do JiraForge</p>
        </div>
        <Link href="/builder" className="btn btn-primary">
          <Plus size={14} /> Novo projeto
        </Link>
      </div>

      {/* Metrics */}
      <div className="metrics-grid">
        {isLoading ? (
          <>
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </>
        ) : (
          [
            {
              label: 'Projetos criados',
              value: String(totalProjects),
              sub: totalProjects === 0 ? 'nenhum ainda' : 'via JiraForge',
              icon: FolderKanban,
              color: 'brand',
            },
            {
              label: 'Clientes ativos',
              value: String(activeClients),
              sub: clientNames,
              icon: Building2,
              color: 'blue',
            },
            {
              label: 'Conexões ativas',
              value: String(activeConnections),
              sub: activeConnections === 0 ? 'nenhuma configurada' : `de ${connections.length} total`,
              icon: Wifi,
              color: 'green',
            },
            {
              label: 'Roll-up rules',
              value: String(totalRules),
              sub: totalRules === 0 ? 'nenhuma regra' : 'ativas',
              icon: Zap,
              color: 'amber',
            },
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
          })
        )}
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

          {projectsLoading ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th>Key</th>
                  <th>Template</th>
                  <th>Status</th>
                </tr>
              </thead>
              <TableSkeleton />
            </table>
          ) : recentProjects.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <FolderKanban size={32} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                Nenhum projeto criado ainda.
              </p>
              <Link href="/builder" className="btn btn-primary" style={{ display: 'inline-flex' }}>
                <Plus size={14} /> Criar primeiro projeto
              </Link>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th>Key</th>
                  <th>Template</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentProjects.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {p.jira_project_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(p.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    <td>
                      <code style={{ fontSize: 11 }}>{p.jira_project_key}</code>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {p.template?.name ?? '—'}
                    </td>
                    <td>
                      {STATUS_ICON[p.status as keyof typeof STATUS_ICON] ?? (
                        <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right column */}
        <div className="right-col">

          {/* Connection health */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header" style={{ marginBottom: 12 }}>
              <span className="card-title">Conexões Jira</span>
              <Link href="/clients" className="btn btn-sm">Gerenciar</Link>
            </div>

            {connectionsLoading || tenantsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} className="conn-row" style={{ opacity: 0.5 }}>
                    <SkeletonLine width="100%" />
                  </div>
                ))}
              </div>
            ) : connections.length === 0 ? (
              <div style={{ padding: '20px 12px', textAlign: 'center' }}>
                <Wifi size={24} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  Nenhuma conexão configurada.
                </p>
                <Link href="/clients" className="btn btn-sm" style={{ display: 'inline-flex' }}>
                  <Plus size={12} /> Adicionar conexão
                </Link>
              </div>
            ) : (
              connections.map(c => {
                const isOk = c.status === 'active'
                return (
                  <div key={c.id} className="conn-row">
                    <div className={`conn-dot ${isOk ? 'ok' : 'err'}`} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {c.jira_base_url}
                      </div>
                    </div>
                    <Wifi
                      size={13}
                      style={{
                        color: isOk ? 'var(--green)' : 'var(--red)',
                        flexShrink: 0,
                      }}
                    />
                  </div>
                )
              })
            )}
          </div>

          {/* Quick actions / empty state */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: 12 }}>
              <span className="card-title">Ações rápidas</span>
            </div>

            {tenantsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
                <SkeletonLine width="80%" />
                <SkeletonLine width="60%" />
              </div>
            ) : tenants.length === 0 ? (
              <div style={{ padding: '16px 0' }}>
                <Building2 size={24} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  Comece criando seu primeiro cliente.
                </p>
                <Link href="/clients" className="btn btn-primary" style={{ display: 'inline-flex', fontSize: 12 }}>
                  <Plus size={12} /> Criar primeiro cliente
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Link href="/builder" className="btn btn-sm" style={{ justifyContent: 'flex-start', gap: 6 }}>
                  <FolderKanban size={13} /> Criar novo projeto
                </Link>
                <Link href="/clients" className="btn btn-sm" style={{ justifyContent: 'flex-start', gap: 6 }}>
                  <Building2 size={13} /> Gerenciar clientes
                </Link>
                <Link href="/templates" className="btn btn-sm" style={{ justifyContent: 'flex-start', gap: 6 }}>
                  <Zap size={13} /> Ver templates
                </Link>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  )
}
