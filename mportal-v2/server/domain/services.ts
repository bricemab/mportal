import { asc, eq, isNull } from 'drizzle-orm'
import type { DbOrTx } from '../db/client'
import { services } from '../db/schema'
import type { ServiceInput } from '../../shared/utils/schemas'
import { audit, type Actor } from './audit'
import { notFound } from './errors'

export type ServiceRow = typeof services.$inferSelect

export async function listServices(db: DbOrTx, includeArchived = false): Promise<ServiceRow[]> {
  const query = db.select().from(services)
  const rows = includeArchived ? await query.orderBy(asc(services.name)) : await query.where(isNull(services.archivedAt)).orderBy(asc(services.name))
  return rows
}

export async function getService(db: DbOrTx, id: number): Promise<ServiceRow> {
  const [row] = await db.select().from(services).where(eq(services.id, id)).limit(1)
  if (!row) throw notFound('Service introuvable')
  return row
}

export async function createService(db: DbOrTx, actor: Actor, input: ServiceInput): Promise<ServiceRow> {
  const [res] = await db.insert(services).values(input).$returningId()
  if (!res) throw new Error('Insertion service échouée')
  await audit(db, actor, 'create', 'service', res.id, { name: input.name })
  return getService(db, res.id)
}

export async function updateService(db: DbOrTx, actor: Actor, id: number, input: ServiceInput): Promise<ServiceRow> {
  await getService(db, id)
  await db.update(services).set(input).where(eq(services.id, id))
  await audit(db, actor, 'update', 'service', id, input)
  return getService(db, id)
}

export async function setServiceArchived(db: DbOrTx, actor: Actor, id: number, archived: boolean): Promise<ServiceRow> {
  await getService(db, id)
  await db
    .update(services)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(services.id, id))
  await audit(db, actor, archived ? 'archive' : 'unarchive', 'service', id)
  return getService(db, id)
}
