// ============================================================
// JiraForge · Project Deployer
// Orchestrates all Jira API calls to create a full project
// Server-side only
// ============================================================

import { JiraClient, FIELD_TYPE_MAP, FIELD_SEARCHER_MAP } from './client'
import type { ProjectBuilderState } from '@/types'

export interface DeployStep {
  key: string
  label: string
  status: 'pending' | 'running' | 'done' | 'error'
  error?: string
}

export interface DeployResult {
  success: boolean
  jira_project_id?: string
  jira_project_url?: string
  steps: DeployStep[]
  error?: string
}

export type OnStepUpdate = (steps: DeployStep[]) => void

export async function deployProject(
  client: JiraClient,
  state: ProjectBuilderState,
  onUpdate?: OnStepUpdate
): Promise<DeployResult> {
  const steps: DeployStep[] = [
    { key: 'project',       label: 'Criando projeto',           status: 'pending' },
    { key: 'issue_types',   label: 'Criando issue types',       status: 'pending' },
    { key: 'workflow',      label: 'Configurando workflow',      status: 'pending' },
    { key: 'fields',        label: 'Criando custom fields',      status: 'pending' },
    { key: 'screens',       label: 'Configurando screens',       status: 'pending' },
    { key: 'schemes',       label: 'Aplicando schemes',          status: 'pending' },
  ]

  const update = (key: string, status: DeployStep['status'], error?: string) => {
    const step = steps.find(s => s.key === key)
    if (step) { step.status = status; if (error) step.error = error }
    onUpdate?.(steps)
  }

  const context: Record<string, unknown> = {}

  try {
    // ── Step 1: Create Project ─────────────────────────────
    update('project', 'running')
    const myself = await client.getMyself()
    const project = await client.createProject({
      key: state.project_key,
      name: state.project_name,
      projectTypeKey: 'software',
      description: state.description,
      leadAccountId: myself.accountId,
      assigneeType: 'UNASSIGNED',
    })
    context.projectId = project.id
    context.projectKey = project.key
    context.projectUrl = `${state.project_key}`
    update('project', 'done')

    // ── Step 2: Issue Types ────────────────────────────────
    update('issue_types', 'running')
    const issueTypeIds: Record<string, string> = {}
    for (const it of state.issueTypes) {
      const isSubtask = it.name.toLowerCase() === 'subtask'
      const created = await client.createIssueType({
        name: it.name,
        type: isSubtask ? 'subtask' : 'standard',
        hierarchyLevel: it.level,
      })
      issueTypeIds[it.name] = created.id
      await client.addIssueTypeToProject(project.id, created.id)
    }
    context.issueTypeIds = issueTypeIds
    update('issue_types', 'done')

    // ── Step 3: Workflow ───────────────────────────────────
    update('workflow', 'running')
    const statusCategoryMap: Record<string, 'TODO' | 'IN_PROGRESS' | 'DONE'> = {
      'Backlog': 'TODO', 'To Do': 'TODO', 'Funnel': 'TODO', 'Analysis': 'TODO',
      'In Progress': 'IN_PROGRESS', 'Em progresso': 'IN_PROGRESS', 'In Review': 'IN_PROGRESS',
      'Em revisão': 'IN_PROGRESS', 'Implementing': 'IN_PROGRESS', 'Validating': 'IN_PROGRESS', 'Blocked': 'IN_PROGRESS',
      'Done': 'DONE', 'Concluído': 'DONE', 'Accepted': 'DONE',
    }

    const workflow = await client.createWorkflow({
      name: `${state.project_name} Workflow`,
      description: `Workflow criado via JiraForge para ${state.project_key}`,
      statuses: state.workflow.statuses.map(s => ({
        name: s.name,
        statusCategory: statusCategoryMap[s.name] ?? 'IN_PROGRESS',
      })),
      transitions: state.workflow.transitions.map(t => ({
        name: t.name,
        from: t.from === '*' ? [] : [t.from],
        to: t.to,
        type: t.from === '*' ? 'GLOBAL' : 'DIRECTED',
      })),
    })
    context.workflowId = workflow.id.entityId

    const workflowScheme = await client.createWorkflowScheme({
      name: `${state.project_name} Workflow Scheme`,
      defaultWorkflow: workflow.id.entityId,
    })
    await client.assignWorkflowSchemeToProject(project.id, workflowScheme.id)
    update('workflow', 'done')

    // ── Step 4: Custom Fields ──────────────────────────────
    update('fields', 'running')
    const fieldIds: Record<string, string> = {}
    for (const field of state.customFields) {
      const created = await client.createCustomField({
        name: field.name,
        type: FIELD_TYPE_MAP[field.type] ?? FIELD_TYPE_MAP.text,
        searcherKey: FIELD_SEARCHER_MAP[field.type] ?? FIELD_SEARCHER_MAP.text,
        description: field.description,
      })
      fieldIds[field.name] = created.id

      // Create context scoped to this project + relevant issue types
      const scopedIssueTypeIds = field.scope
        .map(s => issueTypeIds[s])
        .filter(Boolean)

      const ctx = await client.createFieldContext(created.id, {
        name: `${field.name} - ${state.project_key}`,
        projectIds: [project.id],
        issueTypeIds: scopedIssueTypeIds.length > 0 ? scopedIssueTypeIds : undefined,
      })

      // Add options for select fields
      if ((field.type === 'select' || field.type === 'multiselect') && field.options?.length) {
        await client.addSelectFieldOptions(created.id, ctx.id, field.options)
      }
    }
    context.fieldIds = fieldIds
    update('fields', 'done')

    // ── Step 5: Screens ────────────────────────────────────
    update('screens', 'running')
    const createScreen = await client.createScreen(`${state.project_key} - Create Screen`)
    const editScreen   = await client.createScreen(`${state.project_key} - Edit Screen`)
    const viewScreen   = await client.createScreen(`${state.project_key} - View Screen`)

    // Add custom fields to screens (tab 1 = default)
    for (const fieldId of Object.values(fieldIds)) {
      await client.addFieldToScreen(createScreen.id, 1, fieldId)
      await client.addFieldToScreen(editScreen.id, 1, fieldId)
      await client.addFieldToScreen(viewScreen.id, 1, fieldId)
    }

    const screenScheme = await client.createScreenScheme({
      name: `${state.project_key} Screen Scheme`,
      screens: {
        default: viewScreen.id,
        create: createScreen.id,
        edit: editScreen.id,
      },
    })

    const itMappings = Object.entries(issueTypeIds).map(([, id]) => ({
      issueTypeId: id,
      screenSchemeId: String(screenScheme.id),
    }))

    await client.createIssueTypeScreenScheme({
      name: `${state.project_key} Issue Type Screen Scheme`,
      issueTypeMappings: itMappings,
    })
    update('screens', 'done')

    // ── Step 6: Permission Scheme ──────────────────────────
    update('schemes', 'running')
    const schemes = await client.getPermissionSchemes()
    const defaultScheme = schemes.permissionSchemes.find(
      s => s.name === state.schemes.permissionScheme || s.name === 'Default Permission Scheme'
    )
    if (defaultScheme) {
      await client.assignPermissionScheme(project.key, defaultScheme.id)
    }
    update('schemes', 'done')

    return {
      success: true,
      jira_project_id: project.id,
      jira_project_url: `https://jira.atlassian.net/jira/software/projects/${project.key}/boards`,
      steps,
    }

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    const runningStep = steps.find(s => s.status === 'running')
    if (runningStep) update(runningStep.key, 'error', errorMessage)

    return {
      success: false,
      steps,
      error: errorMessage,
    }
  }
}
