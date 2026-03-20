import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Tenant, JiraConnection, ProjectBuilderState } from '@/types'

// ─── App Store ────────────────────────────────────────────
interface AppState {
  activeTenantId: string | null
  activeConnectionId: string | null
  tenants: Tenant[]
  connections: JiraConnection[]

  setActiveTenant: (id: string | null) => void
  setActiveConnection: (id: string | null) => void
  setTenants: (tenants: Tenant[]) => void
  setConnections: (connections: JiraConnection[]) => void
  addTenant: (tenant: Tenant) => void
  addConnection: (connection: JiraConnection) => void
  removeConnection: (id: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeTenantId: null,
      activeConnectionId: null,
      tenants: [],
      connections: [],

      setActiveTenant: (id) => set({ activeTenantId: id }),
      setActiveConnection: (id) => set({ activeConnectionId: id }),
      setTenants: (tenants) => set({ tenants }),
      setConnections: (connections) => set({ connections }),
      addTenant: (tenant) => set((s) => ({ tenants: [...s.tenants, tenant] })),
      addConnection: (connection) =>
        set((s) => ({ connections: [...s.connections, connection] })),
      removeConnection: (id) =>
        set((s) => ({ connections: s.connections.filter((c) => c.id !== id) })),
    }),
    { name: 'jiraforge-app' }
  )
)

// ─── Builder Store ────────────────────────────────────────
const defaultBuilderState: ProjectBuilderState = {
  project_name: '',
  project_key: '',
  project_type: 'scrum',
  description: '',
  issueTypes: [],
  customFields: [],
  workflow: { statuses: [], transitions: [] },
  schemes: {
    screenScheme: 'auto',
    permissionScheme: 'NTT DATA Default',
    notificationScheme: 'NTT DATA Default',
    fieldConfiguration: 'auto',
  },
  jira_connection_id: '',
  tenant_id: '',
}

interface BuilderStore {
  step: number
  templateId: string | null
  state: ProjectBuilderState
  setStep: (step: number) => void
  setTemplateId: (id: string) => void
  updateState: (patch: Partial<ProjectBuilderState>) => void
  reset: () => void
}

export const useBuilderStore = create<BuilderStore>()((set) => ({
  step: 0,
  templateId: null,
  state: defaultBuilderState,

  setStep: (step) => set({ step }),
  setTemplateId: (id) => set({ templateId: id }),
  updateState: (patch) =>
    set((s) => ({ state: { ...s.state, ...patch } })),
  reset: () =>
    set({ step: 0, templateId: null, state: defaultBuilderState }),
}))
