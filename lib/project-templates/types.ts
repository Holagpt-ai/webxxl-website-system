import type { ProjectType } from '@prisma/client'
import type { DependencyCustomerActionKey } from '@/lib/portal/dependency-actions'

export type ProjectTemplateMilestone = {
  title: string
  description: string
  progressWeight: number
  tasks: { title: string; assignedSide: 'WEBXXL' | 'CUSTOMER' }[]
}

export type ProjectTemplateDependency = {
  title: string
  description: string
  customerActionKey: DependencyCustomerActionKey
  allowsCustomerAck?: boolean
  /** Milestone index (0-based) this dependency supports */
  milestoneIndex?: number
}

export type ProjectTemplateDefinition = {
  id: string
  version: string
  displayName: string
  description: string
  projectType: ProjectType
  milestones: ProjectTemplateMilestone[]
  dependencies: ProjectTemplateDependency[]
}
