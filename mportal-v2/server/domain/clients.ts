import { and, asc, eq, inArray, isNull, isNotNull, like, or, sql } from 'drizzle-orm'
import type { DbOrTx } from '../db/client'
import { clients, invoices, maintenanceContracts, subscriptions } from '../db/schema'
import type { ClientInput } from '../../shared/utils/schemas'
import { audit, type Actor } from './audit'
import { notFound } from './errors'

export type ClientRow = typeof clients.$inferSelect

export async function listClients(db: DbOrTx, opts: { q?: string; archived?: boolean } = {}) {
  const filters = [opts.archived ? isNotNull(clients.archivedAt) : isNull(clients.archivedAt)]
  if (opts.q) {
    const term = `%${opts.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`
    filters.push(
      or(like(clients.name, term), like(clients.firstname, term), like(clients.lastname, term), like(clients.email, term), like(clients.city, term))!,
    )
  }
  const rows = await db.select().from(clients).where(and(...filters)).orderBy(asc(clients.name))
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)
  const balances = await db
    .select({
      clientId: invoices.clientId,
      open: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.status} IN ('ISSUED','SENT') THEN GREATEST(${invoices.totalCents} - ${invoices.paidCents}, 0) ELSE 0 END), 0)`,
      invoiced: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.status} <> 'CANCELLED' AND ${invoices.status} <> 'DRAFT' THEN ${invoices.totalCents} ELSE 0 END), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(invoices)
    .where(inArray(invoices.clientId, ids))
    .groupBy(invoices.clientId)
  const subs = await db
    .select({ clientId: subscriptions.clientId, count: sql<number>`COUNT(*)` })
    .from(subscriptions)
    .where(and(inArray(subscriptions.clientId, ids), eq(subscriptions.status, 'ACTIVE')))
    .groupBy(subscriptions.clientId)

  const balanceMap = new Map(balances.map((b) => [b.clientId, b]))
  const subMap = new Map(subs.map((s) => [s.clientId, Number(s.count)]))
  return rows.map((r) => ({
    ...r,
    openCents: Number(balanceMap.get(r.id)?.open ?? 0),
    invoicedCents: Number(balanceMap.get(r.id)?.invoiced ?? 0),
    invoiceCount: Number(balanceMap.get(r.id)?.count ?? 0),
    activeSubscriptions: subMap.get(r.id) ?? 0,
  }))
}

export async function getClient(db: DbOrTx, id: number): Promise<ClientRow> {
  const [row] = await db.select().from(clients).where(eq(clients.id, id)).limit(1)
  if (!row) throw notFound('Client introuvable')
  return row
}

export async function getClientDetail(db: DbOrTx, id: number) {
  const client = await getClient(db, id)
  const [clientInvoices, clientSubscriptions, contracts] = await Promise.all([
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        title: invoices.title,
        status: invoices.status,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        totalCents: invoices.totalCents,
        paidCents: invoices.paidCents,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .where(eq(invoices.clientId, id))
      .orderBy(sql`${invoices.number} DESC`),
    db.select().from(subscriptions).where(eq(subscriptions.clientId, id)).orderBy(asc(subscriptions.nextBillingDate)),
    db.select().from(maintenanceContracts).where(eq(maintenanceContracts.clientId, id)),
  ])
  return { client, invoices: clientInvoices, subscriptions: clientSubscriptions, contracts }
}

export async function createClient(db: DbOrTx, actor: Actor, input: ClientInput): Promise<ClientRow> {
  const [res] = await db.insert(clients).values(input).$returningId()
  if (!res) throw new Error('Insertion client échouée')
  await audit(db, actor, 'create', 'client', res.id, { name: input.name })
  return getClient(db, res.id)
}

export async function updateClient(db: DbOrTx, actor: Actor, id: number, input: ClientInput): Promise<ClientRow> {
  await getClient(db, id)
  await db.update(clients).set(input).where(eq(clients.id, id))
  await audit(db, actor, 'update', 'client', id, input)
  return getClient(db, id)
}

export async function setClientArchived(db: DbOrTx, actor: Actor, id: number, archived: boolean): Promise<ClientRow> {
  await getClient(db, id)
  await db
    .update(clients)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(clients.id, id))
  await audit(db, actor, archived ? 'archive' : 'unarchive', 'client', id)
  return getClient(db, id)
}
