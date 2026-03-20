'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Building2, FolderKanban,
  Zap, BookTemplate, Settings, ChevronRight,
  Activity, Menu, X
} from 'lucide-react'

const NAV = [
  {
    section: 'Principal',
    items: [
      { href: '/',          label: 'Dashboard',      icon: LayoutDashboard },
      { href: '/clients',   label: 'Clientes',        icon: Building2 },
      { href: '/builder',   label: 'Novo Projeto',    icon: FolderKanban },
    ],
  },
  {
    section: 'Configuração',
    items: [
      { href: '/templates',    label: 'Templates',       icon: BookTemplate },
      { href: '/automations',  label: 'Roll-up Rules',   icon: Zap },
      { href: '/activity',     label: 'Atividade',       icon: Activity },
    ],
  },
  {
    section: 'Sistema',
    items: [
      { href: '/settings', label: 'Configurações', icon: Settings },
    ],
  },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-mark">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L18 6.5V13.5L10 18L2 13.5V6.5L10 2Z" fill="currentColor" opacity="0.9"/>
                <path d="M10 6L14 8.5V13L10 15.5L6 13V8.5L10 6Z" fill="currentColor" opacity="0.4"/>
              </svg>
            </div>
            {!collapsed && (
              <div className="logo-text">
                <span className="logo-name">JiraForge</span>
                <span className="logo-sub">NTT DATA · D&amp;A</span>
              </div>
            )}
          </div>
          <button className="collapse-btn" onClick={() => setCollapsed(c => !c)}>
            <ChevronRight size={14} className={collapsed ? '' : 'rotated'} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(group => (
            <div key={group.section} className="nav-group">
              {!collapsed && <span className="nav-section-label">{group.section}</span>}
              {group.items.map(item => {
                const Icon = item.icon
                const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${active ? 'active' : ''}`}
                    title={collapsed ? item.label : undefined}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon size={16} />
                    {!collapsed && <span>{item.label}</span>}
                    {!collapsed && active && <div className="nav-active-dot" />}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          {!collapsed && (
            <div className="user-chip">
              <div className="user-avatar">G</div>
              <div className="user-info">
                <span className="user-name">Gustavo</span>
                <span className="user-role">Admin · NTT DATA</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu-btn" onClick={() => setMobileOpen(o => !o)}>
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <Breadcrumb pathname={pathname} />
          <div className="topbar-actions" id="topbar-portal" />
        </header>
        <div className="page-content">
          {children}
        </div>
      </main>

    </div>
  )
}

function Breadcrumb({ pathname }: { pathname: string }) {
  const segments = pathname.split('/').filter(Boolean)
  const labels: Record<string, string> = {
    clients: 'Clientes', builder: 'Novo Projeto', templates: 'Templates',
    automations: 'Roll-up Rules', settings: 'Configurações', activity: 'Atividade',
  }

  return (
    <nav className="breadcrumb">
      <Link href="/" className="bc-item">Dashboard</Link>
      {segments.map((seg, i) => (
        <span key={seg} className="bc-segment">
          <ChevronRight size={12} className="bc-sep" />
          <span className={i === segments.length - 1 ? 'bc-item active' : 'bc-item'}>
            {labels[seg] ?? seg}
          </span>
        </span>
      ))}
    </nav>
  )
}
