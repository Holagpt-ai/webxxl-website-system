import type { WorkflowJobStatus } from '@prisma/client'

const TERMINAL: WorkflowJobStatus[] = [
  'COMPLETED',
  'FAILED_TERMINAL',
  'DEAD_LETTER',
  'CANCELLED',
]

const TRANSITIONS: Record<WorkflowJobStatus, WorkflowJobStatus[]> = {
  PENDING: ['READY', 'CANCELLED'],
  READY: ['CLAIMED', 'PAUSED', 'CANCELLED'],
  CLAIMED: ['RUNNING', 'READY', 'RETRY_WAIT', 'CANCELLED'],
  RUNNING: [
    'COMPLETED',
    'RETRY_WAIT',
    'AWAITING_RECONCILIATION',
    'FAILED_TERMINAL',
    'DEAD_LETTER',
    'BLOCKED',
    'READY',
  ],
  RETRY_WAIT: ['READY', 'PAUSED', 'CANCELLED', 'DEAD_LETTER'],
  BLOCKED: ['READY', 'PAUSED', 'CANCELLED', 'DEAD_LETTER'],
  AWAITING_RECONCILIATION: ['READY', 'COMPLETED', 'DEAD_LETTER', 'CANCELLED'],
  PAUSED: ['READY', 'CANCELLED'],
  COMPLETED: [],
  FAILED_TERMINAL: [],
  DEAD_LETTER: [],
  CANCELLED: [],
}

export function isTerminalWorkflowStatus(status: WorkflowJobStatus): boolean {
  return TERMINAL.includes(status)
}

export function canTransitionWorkflowStatus(from: WorkflowJobStatus, to: WorkflowJobStatus): boolean {
  if (from === to) return true
  if (isTerminalWorkflowStatus(from)) return false
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function assertWorkflowTransition(from: WorkflowJobStatus, to: WorkflowJobStatus): void {
  if (!canTransitionWorkflowStatus(from, to)) {
    throw new Error(`FORBIDDEN_TRANSITION:${from}->${to}`)
  }
}
