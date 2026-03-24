/**
 * @jest-environment node
 */
// ============================================================
// Tests for deployProject — Jira project deployment orchestrator
// ============================================================

import { deployProject } from './deployer'
import type { ProjectBuilderState } from '@/types'

// ─── Mock JiraClient ────────────────────────────────────────
function createMockClient(overrides: Record<string, jest.Mock> = {}) {
  return {
    getMyself: jest.fn().mockResolvedValue({ accountId: 'acc-123', displayName: 'Test User' }),
    createProject: jest.fn().mockResolvedValue({ id: 'p1', key: 'PROJ', name: 'Project', self: '' }),
    createIssueType: jest.fn().mockImplementation(async (p: { name: string }) => ({
      id: `it-${p.name.toLowerCase().replace(/\s/g, '-')}`,
      name: p.name,
    })),
    addIssueTypeToProject: jest.fn().mockResolvedValue(undefined),
    createWorkflow: jest.fn().mockResolvedValue({ id: { entityId: 'wf-123' }, name: 'Workflow' }),
    createWorkflowScheme: jest.fn().mockResolvedValue({ id: 1, name: 'Scheme' }),
    assignWorkflowSchemeToProject: jest.fn().mockResolvedValue(undefined),
    createCustomField: jest.fn().mockImplementation(async (p: { name: string }) => ({
      id: `cf-${p.name.toLowerCase().replace(/\s/g, '-')}`,
      name: p.name,
      custom: true,
    })),
    createFieldContext: jest.fn().mockResolvedValue({ id: 'ctx-1', name: 'Context' }),
    addSelectFieldOptions: jest.fn().mockResolvedValue(undefined),
    createScreen: jest.fn().mockImplementation(async (name: string) => ({
      id: Math.floor(Math.random() * 1000),
      name,
    })),
    addFieldToScreen: jest.fn().mockResolvedValue(undefined),
    createScreenScheme: jest.fn().mockResolvedValue({ id: 10 }),
    createIssueTypeScreenScheme: jest.fn().mockResolvedValue({ id: 'itss-1' }),
    getPermissionSchemes: jest.fn().mockResolvedValue({
      permissionSchemes: [
        { id: 1, name: 'Default Permission Scheme' },
        { id: 2, name: 'Custom Scheme' },
      ],
    }),
    assignPermissionScheme: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any
}

function createMockState(overrides: Partial<ProjectBuilderState> = {}): ProjectBuilderState {
  return {
    project_name: 'Test Project',
    project_key: 'TEST',
    project_type: 'scrum',
    description: 'A test project',
    issueTypes: [
      { name: 'Story', level: 0, color: '#blue', icon: '📖' },
      { name: 'Bug', level: 0, color: '#red', icon: '🐛' },
    ],
    customFields: [
      { name: 'Priority Score', type: 'number', required: true, scope: ['Story'], description: 'Score' },
      { name: 'Category', type: 'select', required: false, scope: ['Story', 'Bug'], options: ['A', 'B', 'C'] },
    ],
    workflow: {
      statuses: [
        { name: 'To Do', category: 'TODO' },
        { name: 'In Progress', category: 'IN_PROGRESS' },
        { name: 'Done', category: 'DONE' },
      ],
      transitions: [
        { from: '*', to: 'To Do', name: 'Open' },
        { from: 'To Do', to: 'In Progress', name: 'Start' },
        { from: 'In Progress', to: 'Done', name: 'Finish' },
      ],
    },
    schemes: {
      screenScheme: 'auto',
      permissionScheme: 'Default Permission Scheme',
      notificationScheme: 'NTT DATA Default',
      fieldConfiguration: 'auto',
    },
    jira_connection_id: 'conn-1',
    tenant_id: 'tenant-1',
    ...overrides,
  }
}

// ─── Tests ──────────────────────────────────────────────────
describe('deployProject', () => {
  it('completes full deployment successfully', async () => {
    const client = createMockClient()
    const state = createMockState()

    const result = await deployProject(client, state)

    expect(result.success).toBe(true)
    expect(result.jira_project_id).toBe('p1')
    expect(result.steps.every(s => s.status === 'done')).toBe(true)
  })

  it('calls Jira APIs in correct order', async () => {
    const callOrder: string[] = []
    const client = createMockClient({
      getMyself: jest.fn().mockImplementation(async () => { callOrder.push('getMyself'); return { accountId: 'a' } }),
      createProject: jest.fn().mockImplementation(async () => { callOrder.push('createProject'); return { id: 'p1', key: 'K' } }),
      createIssueType: jest.fn().mockImplementation(async (p: any) => { callOrder.push('createIssueType'); return { id: 'it-1', name: p.name } }),
      addIssueTypeToProject: jest.fn().mockImplementation(async () => { callOrder.push('addIssueTypeToProject') }),
      createWorkflow: jest.fn().mockImplementation(async () => { callOrder.push('createWorkflow'); return { id: { entityId: 'wf' }, name: 'W' } }),
      createWorkflowScheme: jest.fn().mockImplementation(async () => { callOrder.push('createWorkflowScheme'); return { id: 1 } }),
      assignWorkflowSchemeToProject: jest.fn().mockImplementation(async () => { callOrder.push('assignWorkflowScheme') }),
      createCustomField: jest.fn().mockImplementation(async (p: any) => { callOrder.push('createCustomField'); return { id: 'cf-1', name: p.name } }),
      createFieldContext: jest.fn().mockImplementation(async () => { callOrder.push('createFieldContext'); return { id: 'ctx' } }),
      addSelectFieldOptions: jest.fn().mockImplementation(async () => { callOrder.push('addSelectFieldOptions') }),
      createScreen: jest.fn().mockImplementation(async () => { callOrder.push('createScreen'); return { id: 1 } }),
      addFieldToScreen: jest.fn().mockImplementation(async () => { callOrder.push('addFieldToScreen') }),
      createScreenScheme: jest.fn().mockImplementation(async () => { callOrder.push('createScreenScheme'); return { id: 1 } }),
      createIssueTypeScreenScheme: jest.fn().mockImplementation(async () => { callOrder.push('createIssueTypeScreenScheme'); return { id: '1' } }),
      getPermissionSchemes: jest.fn().mockImplementation(async () => { callOrder.push('getPermissionSchemes'); return { permissionSchemes: [{ id: 1, name: 'Default Permission Scheme' }] } }),
      assignPermissionScheme: jest.fn().mockImplementation(async () => { callOrder.push('assignPermissionScheme') }),
    })

    await deployProject(client, createMockState())

    // Verify order: project → issueTypes → workflow → fields → screens → permissions
    const firstOccurrence = (name: string) => callOrder.indexOf(name)
    expect(firstOccurrence('createProject')).toBeLessThan(firstOccurrence('createIssueType'))
    expect(firstOccurrence('createIssueType')).toBeLessThan(firstOccurrence('createWorkflow'))
    expect(firstOccurrence('createWorkflow')).toBeLessThan(firstOccurrence('createCustomField'))
    expect(firstOccurrence('createCustomField')).toBeLessThan(firstOccurrence('createScreen'))
    expect(firstOccurrence('createScreen')).toBeLessThan(firstOccurrence('getPermissionSchemes'))
  })

  it('creates correct number of issue types', async () => {
    const client = createMockClient()
    const state = createMockState()

    await deployProject(client, state)

    expect(client.createIssueType).toHaveBeenCalledTimes(2) // Story + Bug
    expect(client.addIssueTypeToProject).toHaveBeenCalledTimes(2)
  })

  it('creates 3 screens (create, edit, view)', async () => {
    const client = createMockClient()
    await deployProject(client, createMockState())

    expect(client.createScreen).toHaveBeenCalledTimes(3)
    const screenNames = client.createScreen.mock.calls.map((c: any[]) => c[0])
    expect(screenNames).toContain('TEST - Create Screen')
    expect(screenNames).toContain('TEST - Edit Screen')
    expect(screenNames).toContain('TEST - View Screen')
  })

  it('adds select field options for select-type fields', async () => {
    const client = createMockClient()
    await deployProject(client, createMockState())

    // Category field is type 'select' with options ['A', 'B', 'C']
    expect(client.addSelectFieldOptions).toHaveBeenCalledTimes(1)
    expect(client.addSelectFieldOptions).toHaveBeenCalledWith(
      expect.any(String),
      'ctx-1',
      ['A', 'B', 'C']
    )
  })

  it('assigns default permission scheme', async () => {
    const client = createMockClient()
    await deployProject(client, createMockState())

    expect(client.assignPermissionScheme).toHaveBeenCalledWith('PROJ', 1)
  })

  it('handles project creation failure gracefully', async () => {
    const client = createMockClient({
      createProject: jest.fn().mockRejectedValue(new Error('Project key already exists')),
    })

    const result = await deployProject(client, createMockState())

    expect(result.success).toBe(false)
    expect(result.error).toBe('Project key already exists')
    const projectStep = result.steps.find(s => s.key === 'project')
    expect(projectStep?.status).toBe('error')
  })

  it('handles workflow creation failure', async () => {
    const client = createMockClient({
      createWorkflow: jest.fn().mockRejectedValue(new Error('Workflow API error')),
    })

    const result = await deployProject(client, createMockState())

    expect(result.success).toBe(false)
    const workflowStep = result.steps.find(s => s.key === 'workflow')
    expect(workflowStep?.status).toBe('error')
    // Previous steps should be done
    expect(result.steps.find(s => s.key === 'project')?.status).toBe('done')
    expect(result.steps.find(s => s.key === 'issue_types')?.status).toBe('done')
  })

  it('invokes onUpdate callback on step changes', async () => {
    const client = createMockClient()
    const updates: string[] = []
    const onUpdate = jest.fn((steps) => {
      const running = steps.find((s: any) => s.status === 'running')
      if (running) updates.push(running.key)
    })

    await deployProject(client, createMockState(), onUpdate)

    expect(onUpdate).toHaveBeenCalled()
    expect(updates).toContain('project')
    expect(updates).toContain('workflow')
    expect(updates).toContain('screens')
  })

  it('handles zero custom fields', async () => {
    const client = createMockClient()
    const state = createMockState({ customFields: [] })

    const result = await deployProject(client, state)

    expect(result.success).toBe(true)
    expect(client.createCustomField).not.toHaveBeenCalled()
    expect(client.addFieldToScreen).not.toHaveBeenCalled()
  })
})
