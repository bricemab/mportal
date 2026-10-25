import { desc, eq, lt } from 'drizzle-orm'
import { z } from 'zod'
import { auditLogs, users } from '../db/schema'

const querySchema = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
})

export default defineEventHandler(async (event) => {
  const { before, limit } = parseQuery(event, querySchema)
  return useDb()
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entity: auditLogs.entity,
      entityId: auditLogs.entityId,
      changes: auditLogs.changes,
      ip: auditLogs.ip,
      createdAt: auditLogs.createdAt,
      firstname: users.firstname,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(before ? lt(auditLogs.id, before) : undefined)
    .orderBy(desc(auditLogs.id))
    .limit(limit)
})
