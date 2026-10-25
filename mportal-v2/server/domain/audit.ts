import type { DbOrTx } from '../db/client'
import { auditLogs } from '../db/schema'

export interface Actor {
  userId: number | null
  ip?: string | null
}

export const SYSTEM_ACTOR: Actor = { userId: null, ip: null }

export async function audit(
  db: DbOrTx,
  actor: Actor,
  action: string,
  entity: string,
  entityId: number | null,
  changes?: Record<string, unknown>,
): Promise<void> {
  await db.insert(auditLogs).values({
    userId: actor.userId,
    ip: actor.ip ?? null,
    action,
    entity,
    entityId,
    changes: changes ?? null,
  })
}
