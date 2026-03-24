'use client'

import { useParams } from 'next/navigation'
import { useTemplate } from '@/hooks'
import TemplateEditor from '@/components/templates/TemplateEditor'

export default function EditTemplatePage() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : null
  const { template, loading, error } = useTemplate(id)

  return (
    <TemplateEditor
      template={template}
      loading={loading}
      fetchError={error}
    />
  )
}
