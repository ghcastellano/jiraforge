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

      <style jsx>{`
        .app-shell {
          display: flex;
          min-height: 100vh;
          background: #0a0a0b;
          font-family: 'DM Sans', 'Outfit', system-ui, sans-serif;
        }

        /* ── Sidebar ───────────────────────────── */
        .sidebar {
          width: 220px;
          flex-shrink: 0;
          background: #111113;
          border-right: 1px solid #1e1e22;
          display: flex;
          flex-direction: column;
          transition: width 0.2s ease;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow: hidden;
        }
        .sidebar.collapsed { width: 56px; }

        .sidebar-header {
          padding: 18px 14px 14px;
          border-bottom: 1px solid #1e1e22;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .logo { display: flex; align-items: center; gap: 10px; min-width: 0; }

        .logo-mark {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #6d5ce8, #4f46e5);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }

        .logo-text { display: flex; flex-direction: column; min-width: 0; }
        .logo-name { font-size: 14px; font-weight: 600; color: #f0f0f2; letter-spacing: -0.01em; }
        .logo-sub  { font-size: 10px; color: #555560; letter-spacing: 0.02em; }

        .collapse-btn {
          background: none;
          border: none;
          color: #444450;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          transition: color 0.15s;
          flex-shrink: 0;
        }
        .collapse-btn:hover { color: #888894; }
        .collapse-btn :global(.rotated) { transform: rotate(180deg); }

        /* ── Nav ───────────────────────────────── */
        .sidebar-nav { flex: 1; padding: 12px 8px; overflow-y: auto; }

        .nav-group { margin-bottom: 20px; }

        .nav-section-label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          color: #333340;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 0 8px;
          margin-bottom: 4px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 8px 8px;
          border-radius: 6px;
          font-size: 13px;
          color: #55555f;
          text-decoration: none;
          transition: all 0.15s;
          position: relative;
          white-space: nowrap;
        }
        .nav-item:hover { color: #c0c0cc; background: #18181c; }
        .nav-item.active { color: #a89cf7; background: #1a1830; }

        .nav-active-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #6d5ce8;
          margin-left: auto;
        }

        /* ── Footer ────────────────────────────── */
        .sidebar-footer {
          padding: 12px;
          border-top: 1px solid #1e1e22;
        }

        .user-chip {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 8px;
          border-radius: 8px;
          background: #18181c;
          border: 1px solid #1e1e22;
        }

        .user-avatar {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: linear-gradient(135deg, #6d5ce8, #4f46e5);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: white;
          flex-shrink: 0;
        }

        .user-info { display: flex; flex-direction: column; min-width: 0; }
        .user-name { font-size: 12px; font-weight: 500; color: #c0c0cc; }
        .user-role { font-size: 10px; color: #444450; }

        /* ── Main ──────────────────────────────── */
        .main-content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .topbar {
          height: 52px;
          background: #111113;
          border-bottom: 1px solid #1e1e22;
          display: flex;
          align-items: center;
          padding: 0 24px;
          gap: 12px;
          flex-shrink: 0;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .mobile-menu-btn {
          display: none;
          background: none;
          border: none;
          color: #888894;
          cursor: pointer;
          padding: 4px;
        }

        .topbar-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; }

        .page-content { flex: 1; padding: 28px; overflow-y: auto; }

        /* ── Mobile ────────────────────────────── */
        .mobile-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          z-index: 40;
        }

        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            left: -220px;
            top: 0;
            z-index: 50;
            height: 100vh;
            transition: left 0.2s ease;
          }
          .sidebar.mobile-open { left: 0; }
          .mobile-overlay { display: block; }
          .mobile-menu-btn { display: flex; }
          .collapse-btn { display: none; }
          .page-content { padding: 16px; }
        }
      `}</style>
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
      <style jsx>{`
        .breadcrumb { display: flex; align-items: center; gap: 2px; }
        .bc-item { font-size: 13px; color: #444450; text-decoration: none; transition: color 0.15s; }
        .bc-item:hover { color: #888894; }
        .bc-item.active { color: #c0c0cc; }
        .bc-segment { display: flex; align-items: center; gap: 2px; }
        :global(.bc-sep) { color: #2a2a30; }
      `}</style>
    </nav>
  )
}
