import { and, desc, eq, isNull, like, or, sql, type SQL } from 'drizzle-orm'
import type { DbOrTx } from '../db/client'
import { bankTransactions, clients, expenses, invoices } from '../db/schema'
import type { ExpenseInput } from '../../shared/utils/schemas'
import { audit, type Actor } from './audit'
import { badRequest, notFound } from './errors'

export type ExpenseRow = typeof expenses.$inferSelect

export async function getExpense(db: DbOrTx, id: number): Promise<ExpenseRow> {
  const [row] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1)
  if (!row) throw notFound('Dépense introuvable')
  return row
}

export async function listExpenses(
  db: DbOrTx,
  filters: { year?: number; category?: ExpenseRow['category']; q?: string; unmatched?: boolean; page: number; pageSize: number },
) {
  const conditions: SQL[] = []
  if (filters.year) conditions.push(sql`YEAR(${expenses.date}) = ${filters.year}`)
  if (filters.category) conditions.push(eq(expenses.category, filters.category))
  if (filters.unmatched) conditions.push(isNull(expenses.bankTransactionId))
  if (filters.q) {
    const term = `%${filters.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`
    conditions.push(or(like(expenses.label, term), like(expenses.supplier, term), like(clients.name, term))!)
  }
  const where = conditions.length ? and(...conditions) : undefined
  const items = await db
    .select({
      expense: expenses,
      clientName: clients.name,
      invoiceNumber: invoices.number,
      bankDate: bankTransactions.bookingDate,
    })
    .from(expenses)
    .leftJoin(clients, eq(clients.id, expenses.clientId))
    .leftJoin(invoices, eq(invoices.id, expenses.invoiceId))
    .leftJoin(bankTransactions, eq(bankTransactions.id, expenses.bankTransactionId))
    .where(where)
    .orderBy(desc(expenses.date), desc(expenses.id))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize)
  const [summary] = await db
    .select({ count: sql<number>`COUNT(*)`, total: sql<string>`COALESCE(SUM(${expenses.amountCents}), 0)` })
    .from(expenses)
    .leftJoin(clients, eq(clients.id, expenses.clientId))
    .where(where)
  return {
    items: items.map((i) => ({ ...i.expense, clientName: i.clientName, invoiceNumber: i.invoiceNumber, bankDate: i.bankDate })),
    total: Number(summary?.count ?? 0),
    totalCents: Number(summary?.total ?? 0),
    page: filters.page,
    pageSize: filters.pageSize,
  }
}

async function assertLinks(db: DbOrTx, input: ExpenseInput) {
  if (input.clientId) {
    const [c] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, input.clientId))
    if (!c) throw badRequest('Client introuvable')
  }
  if (input.invoiceId) {
    const [i] = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.id, input.invoiceId))
    if (!i) throw badRequest('Facture introuvable')
  }
}

export async function createExpense(db: DbOrTx, actor: Actor, input: ExpenseInput, bankTransactionId: number | null = null): Promise<ExpenseRow> {
  await assertLinks(db, input)
  const [res] = await db
    .insert(expenses)
    .values({ ...input, bankTransactionId, createdBy: actor.userId })
    .$returningId()
  if (!res) throw new Error('Insertion dépense échouée')
  await audit(db, actor, 'create', 'expense', res.id, { label: input.label, amountCents: input.amountCents })
  return getExpense(db, res.id)
}

export async function updateExpense(db: DbOrTx, actor: Actor, id: number, input: ExpenseInput): Promise<ExpenseRow> {
  const current = await getExpense(db, id)
  await assertLinks(db, input)
  // Une dépense rapprochée d'un débit bancaire garde le montant du relevé
  if (current.bankTransactionId && input.amountCents !== current.amountCents) {
    throw badRequest('Montant verrouillé : cette dépense est rapprochée d’un débit bancaire')
  }
  await db.update(expenses).set(input).where(eq(expenses.id, id))
  await audit(db, actor, 'update', 'expense', id, input)
  return getExpense(db, id)
}

export async function deleteExpense(db: DbOrTx, actor: Actor, id: number): Promise<void> {
  const current = await getExpense(db, id)
  if (current.bankTransactionId) {
    await db
      .update(bankTransactions)
      .set({ status: 'PENDING', kind: 'UNCLASSIFIED', matchedAt: null, matchedBy: null })
      .where(eq(bankTransactions.id, current.bankTransactionId))
  }
  await db.delete(expenses).where(eq(expenses.id, id))
  await audit(db, actor, 'delete', 'expense', id, { label: current.label, amountCents: current.amountCents })
}
