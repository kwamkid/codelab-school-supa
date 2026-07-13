// lib/vex/audit.ts
// Append a row to vex.audit_log. Every mutation in this feature calls this with
// the acting admin/parent id + name. Best-effort: a failed audit write is logged
// but does not throw (we never want an audit failure to roll back a user action).

import { vexDb } from './supabase'
import type { ActorType } from './types'

export interface AuditInput {
  actorType: ActorType
  actorId?: string | null
  actorName?: string | null
  action: string
  entity: string
  entityId?: string | null
  before?: any
  after?: any
}

export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await vexDb()
      .from('audit_log')
      .insert({
        actor_type: input.actorType,
        actor_id: input.actorId ?? null,
        actor_name: input.actorName ?? null,
        action: input.action,
        entity: input.entity,
        entity_id: input.entityId ?? null,
        before: input.before ?? null,
        after: input.after ?? null,
      })
  } catch (e) {
    console.error('[vex audit] failed to write audit_log:', e)
  }
}
