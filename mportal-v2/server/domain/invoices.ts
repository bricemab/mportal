import { and, asc, desc, eq, inArray, like, or, sql, type SQL } from 'drizzle-orm'
import type { DbOrTx } from '../db/client'
import {
  bankTransactions,
  clients,
  expenses,
  invoiceEvents,
  invoiceLines,
  invoices,
  maintenancePeriods,
  payments,
  services,
  subscriptions,
  users,
} from '../db/schema'
import { addDays, todayIso } from '../../shared/utils/dates'
import { displayStatus, isInvoiceEditable, remainingCents, type InvoiceDisplayStatus } from '../../shared/utils/invoice-status'
import { lineTotalCents, sumLinesCents, formatChf } from '../../shared/utils/money'
import { qrReferenceFromNumber } from '../../shared/utils/qr-reference'
import type { InvoiceInput, InvoiceLineInput } from '../../shared/utils/schemas'
import { audit, type Actor } from './audit'
import { badRequest, conflict, notFound } from './errors'
import { guessExpenseCategory } from './expense-category'
import { allocateInvoiceNumber, getNumberSetting } from './settings'

export type InvoiceRow = typeof invoices.$inferSelect

export async function addInvoiceEvent(db: DbOrTx, invoiceId: number, type: string, message: string, userId: number | null) {
  await db.insert(invoiceEvents).values({ invoiceId, type, message: message.slice(0, 500), userId })
}

export async function getInvoice(db: DbOrTx, id: number, forUpdate = false): Promise<InvoiceRow> {
  const query = db.select().from(invoices).where(eq(invoices.id, id)).limit(1)
  const [row] = forUpdate ? await query.for('update') : await query
  if (!row) throw notFound('Facture introuvable')
  return row
}

async function insertLines(db: DbOrTx, invoiceId: number, lines: ReadonlyArray<InvoiceLineInput & { subscriptionLineId?: number | null }>) {
  if (lines.length === 0) return
  await db.insert(invoiceLines).values(
    lines.map((line, index) => ({
      invoiceId,
      serviceId: line.serviceId,
      subscriptionLineId: line.subscriptionLineId ?? null,
      label: line.label,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      unitCostCents: line.unitCostCents,
      position: index,
    })),
  )
}

async function assertServicesExist(db: DbOrTx, lines: ReadonlyArray<{ serviceId: number | null }>) {
  const ids = [...new Set(lines.map((l) => l.serviceId).filter((v): v is number => v !== null))]
  if (ids.length === 0) return
  const found = await db.select({ id: services.id }).from(services).where(inArray(services.id, ids))
  if (found.length !== ids.length) throw badRequest('Service inconnu dans les lignes')
}

export interface CreateInvoiceOptions {
  subscriptionId?: number | null
  billingPeriodStart?: string | null
  lines?: ReadonlyArray<InvoiceLineInput & { subscriptionLineId?: number | null }>
  eventMessage?: string
  /** Date des dépenses créées pour les coûts (défaut : aujourd'hui). */
  expenseDate?: string
}

/** Crée une facture en brouillon. À appeler dans une transaction (attribution du numéro). */
export async function createInvoice(tx: DbOrTx, actor: Actor, input: InvoiceInput, options: CreateInvoiceOptions = {}): Promise<InvoiceRow> {
  const [client] = await tx.select().from(clients).where(eq(clients.id, input.clientId)).limit(1)
  if (!client) throw badRequest('Client introuvable')
  const lines: ReadonlyArray<InvoiceLineInput & { subscriptionLineId?: number | null }> = options.lines ?? input.lines
  await assertServicesExist(tx, lines)

  const number = await allocateInvoiceNumber(tx)
  const [res] = await tx
    .insert(invoices)
    .values({
      number,
      qrReference: qrReferenceFromNumber(number),
      clientId: client.id,
      subscriptionId: options.subscriptionId ?? null,
      billingPeriodStart: options.billingPeriodStart ?? null,
      title: input.title,
      notes: input.notes,
      status: 'DRAFT',
      totalCents: sumLinesCents(lines),
      createdBy: actor.userId,
    })
    .$returningId()
  if (!res) throw new Error('Insertion facture échouée')
  await insertLines(tx, res.id, lines)
  await addInvoiceEvent(tx, res.id, 'CREATED', options.eventMessage ?? `Facture ${number} créée`, actor.userId)

  if (input.createExpenses) {
    const expenseDate = options.expenseDate ?? todayIso()
    for (const line of lines) {
      if (!line.unitCostCents) continue
      await tx.insert(expenses).values({
        date: expenseDate,
        amountCents: lineTotalCents(line.quantity, line.unitCostCents),
        supplier: input.expenseSupplier ?? 'Infomaniak',
        category: guessExpenseCategory(line.label),
        label: `${line.label} – ${client.name}`.slice(0, 255),
        clientId: client.id,
        invoiceId: res.id,
        subscriptionLineId: line.subscriptionLineId ?? null,
        createdBy: actor.userId,
      })
    }
  }

  await audit(tx, actor, 'create', 'invoice', res.id, { number, title: input.title })
  return getInvoice(tx, res.id)
}

export async function updateInvoice(tx: DbOrTx, actor: Actor, id: number, input: InvoiceInput): Promise<InvoiceRow> {
  const invoice = await getInvoice(tx, id, true)
  if (!isInvoiceEditable(invoice)) throw conflict('Cette facture ne peut plus être modifiée (envoyée, payée ou close)')
  const [client] = await tx.select({ id: clients.id }).from(clients).where(eq(clients.id, input.clientId)).limit(1)
  if (!client) throw badRequest('Client introuvable')
  await assertServicesExist(tx, input.lines)

  await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, id))
  await insertLines(tx, id, input.lines)
  await tx
    .update(invoices)
    .set({ clientId: input.clientId, title: input.title, notes: input.notes, totalCents: sumLinesCents(input.lines) })
    .where(eq(invoices.id, id))
  await addInvoiceEvent(tx, id, 'UPDATED', 'Facture modifiée', actor.userId)
  await audit(tx, actor, 'update', 'invoice', id, { title: input.title, lines: input.lines.length })
  return getInvoice(tx, id)
}

/** Fige la date d'émission et l'échéance (première génération du PDF). */
export async function issueInvoice(tx: DbOrTx, actor: Actor, id: number, today: string = todayIso()): Promise<InvoiceRow> {
  const invoice = await getInvoice(tx, id, true)
  if (invoice.status === 'CANCELLED') throw conflict('Facture annulée')
  if (invoice.totalCents <= 0) throw badRequest('Le total de la facture doit être positif')
  if (invoice.status !== 'DRAFT' && invoice.issueDate) return invoice

  const dueDays = await getNumberSetting(tx, 'INVOICE_DUE_DAYS')
  const issueDate = invoice.issueDate ?? today
  await tx
    .update(invoices)
    .set({
      status: invoice.status === 'DRAFT' ? 'ISSUED' : invoice.status,
      issueDate,
      dueDate: invoice.dueDate ?? addDays(issueDate, dueDays),
    })
    .where(eq(invoices.id, id))
  await addInvoiceEvent(tx, id, 'ISSUED', `Facture émise le ${issueDate}`, actor.userId)
  await audit(tx, actor, 'issue', 'invoice', id)
  return getInvoice(tx, id)
}

export async function markInvoiceSent(tx: DbOrTx, actor: Actor, id: number, pdfFile: string | null, today: string = todayIso()): Promise<InvoiceRow> {
  let invoice = await getInvoice(tx, id, true)
  if (invoice.status === 'DRAFT') invoice = await issueInvoice(tx, actor, id, today)
  if (invoice.status !== 'ISSUED') throw conflict('Seule une facture émise peut être marquée comme envoyée')
  await tx.update(invoices).set({ status: 'SENT', sentAt: new Date(), pdfFile }).where(eq(invoices.id, id))
  await addInvoiceEvent(tx, id, 'SENT', 'Facture marquée comme envoyée', actor.userId)
  await audit(tx, actor, 'send', 'invoice', id)
  return getInvoice(tx, id)
}

async function refreshPaidCents(tx: DbOrTx, invoiceId: number): Promise<number> {
  const [row] = await tx
    .select({ total: sql<string>`COALESCE(SUM(${payments.amountCents}), 0)` })
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId))
  const paid = Number(row?.total ?? 0)
  await tx.update(invoices).set({ paidCents: paid }).where(eq(invoices.id, invoiceId))
  return paid
}

export async function addPayment(
  tx: DbOrTx,
  actor: Actor,
  invoiceId: number,
  input: { amountCents: number; paidAt: string; note: string | null; bankTransactionId?: number | null },
): Promise<InvoiceRow> {
  let invoice = await getInvoice(tx, invoiceId, true)
  if (invoice.status === 'CANCELLED' || invoice.status === 'WRITTEN_OFF') throw conflict('Facture close : paiement impossible')
  if (invoice.status === 'DRAFT') invoice = await issueInvoice(tx, actor, invoiceId, input.paidAt)
  const remaining = remainingCents(invoice)
  if (remaining <= 0) throw conflict('Cette facture est déjà entièrement payée')
  if (input.amountCents > remaining) throw badRequest(`Le paiement dépasse le reste dû (${formatChf(remaining)})`)

  await tx.insert(payments).values({
    invoiceId,
    amountCents: input.amountCents,
    paidAt: input.paidAt,
    note: input.note,
    bankTransactionId: input.bankTransactionId ?? null,
    createdBy: actor.userId,
  })
  const paid = await refreshPaidCents(tx, invoiceId)
  const full = paid >= invoice.totalCents
  await addInvoiceEvent(
    tx,
    invoiceId,
    full ? 'PAID' : 'PAYMENT',
    `${full ? 'Payée' : 'Paiement partiel'} : ${formatChf(input.amountCents)} le ${input.paidAt}${input.bankTransactionId ? ' (relevé bancaire)' : ''}`,
    actor.userId,
  )
  await audit(tx, actor, 'payment', 'invoice', invoiceId, { amountCents: input.amountCents, paidAt: input.paidAt })
  return getInvoice(tx, invoiceId)
}

export async function deletePayment(tx: DbOrTx, actor: Actor, invoiceId: number, paymentId: number): Promise<InvoiceRow> {
  const invoice = await getInvoice(tx, invoiceId, true)
  if (invoice.status === 'CANCELLED' || invoice.status === 'WRITTEN_OFF') throw conflict('Facture close : rouvrez-la avant de supprimer un paiement')
  const [payment] = await tx
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.invoiceId, invoiceId)))
    .limit(1)
  if (!payment) throw notFound('Paiement introuvable')
  await tx.delete(payments).where(eq(payments.id, paymentId))
  if (payment.bankTransactionId) {
    await tx
      .update(bankTransactions)
      .set({ status: 'PENDING', kind: 'UNCLASSIFIED', matchedAt: null, matchedBy: null })
      .where(eq(bankTransactions.id, payment.bankTransactionId))
  }
  await refreshPaidCents(tx, invoiceId)
  await addInvoiceEvent(tx, invoiceId, 'PAYMENT_DELETED', `Paiement de ${formatChf(payment.amountCents)} supprimé`, actor.userId)
  await audit(tx, actor, 'payment_delete', 'invoice', invoiceId, { paymentId, amountCents: payment.amountCents })
  return getInvoice(tx, invoiceId)
}

/** Solde la facture : le reste dû est abandonné (ex. client parti, payé au prorata). */
export async function writeOffInvoice(tx: DbOrTx, actor: Actor, id: number, reason: string): Promise<InvoiceRow> {
  const invoice = await getInvoice(tx, id, true)
  if (invoice.status !== 'ISSUED' && invoice.status !== 'SENT') throw conflict('Seule une facture émise ou envoyée peut être soldée')
  const remaining = remainingCents(invoice)
  if (remaining <= 0) throw conflict('Rien à solder : la facture est entièrement payée')
  await tx.update(invoices).set({ status: 'WRITTEN_OFF', writtenOffAt: new Date(), writeOffReason: reason }).where(eq(invoices.id, id))
  await addInvoiceEvent(tx, id, 'WRITTEN_OFF', `Soldée (${formatChf(remaining)} abandonnés) : ${reason}`, actor.userId)
  await audit(tx, actor, 'write_off', 'invoice', id, { remaining, reason })
  return getInvoice(tx, id)
}

/** Rouvre une facture soldée ou annulée (retour à « envoyée » ou « émise »). */
export async function reopenInvoice(tx: DbOrTx, actor: Actor, id: number): Promise<InvoiceRow> {
  const invoice = await getInvoice(tx, id, true)
  if (invoice.status !== 'WRITTEN_OFF' && invoice.status !== 'CANCELLED') throw conflict('La facture n’est pas close')
  const status = invoice.sentAt ? 'SENT' : invoice.issueDate ? 'ISSUED' : 'DRAFT'
  await tx.update(invoices).set({ status, writtenOffAt: null, writeOffReason: null, cancelledAt: null }).where(eq(invoices.id, id))
  await addInvoiceEvent(tx, id, 'REOPENED', 'Facture rouverte', actor.userId)
  await audit(tx, actor, 'reopen', 'invoice', id)
  return getInvoice(tx, id)
}

export async function cancelInvoice(tx: DbOrTx, actor: Actor, id: number): Promise<InvoiceRow> {
  const invoice = await getInvoice(tx, id, true)
  if (invoice.status === 'CANCELLED') return invoice
  if (invoice.paidCents > 0) throw conflict('Supprimez d’abord les paiements, ou soldez la facture')
  await tx.update(invoices).set({ status: 'CANCELLED', cancelledAt: new Date() }).where(eq(invoices.id, id))
  await addInvoiceEvent(tx, id, 'CANCELLED', 'Facture annulée', actor.userId)
  await audit(tx, actor, 'cancel', 'invoice', id)
  return getInvoice(tx, id)
}

/** Suppression définitive : uniquement un brouillon sans paiement. */
export async function deleteDraftInvoice(tx: DbOrTx, actor: Actor, id: number): Promise<void> {
  const invoice = await getInvoice(tx, id, true)
  if (invoice.status !== 'DRAFT' || invoice.paidCents > 0) throw conflict('Seul un brouillon sans paiement peut être supprimé (sinon : annuler)')
  await tx.update(expenses).set({ invoiceId: null }).where(eq(expenses.invoiceId, id))
  await tx.update(maintenancePeriods).set({ invoiceId: null }).where(eq(maintenancePeriods.invoiceId, id))
  await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, id))
  await tx.delete(invoiceEvents).where(eq(invoiceEvents.invoiceId, id))
  await tx.delete(invoices).where(eq(invoices.id, id))
  await audit(tx, actor, 'delete', 'invoice', id, { number: invoice.number, title: invoice.title })
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export interface InvoiceListFilters {
  q?: string
  status?: InvoiceDisplayStatus | 'OPEN'
  clientId?: number
  year?: number
  page: number
  pageSize: number
  sort?: 'number_desc' | 'number_asc' | 'amount_desc' | 'amount_asc' | 'due_asc'
}

function statusCondition(status: InvoiceListFilters['status'], today: string): SQL | undefined {
  const i = invoices
  switch (status) {
    case undefined:
      return sql`${i.status} <> 'CANCELLED'`
    case 'DRAFT':
    case 'ISSUED':
      return sql`${i.status} = ${status} AND ${i.paidCents} < ${i.totalCents}`
    case 'SENT':
      return sql`${i.status} = 'SENT' AND ${i.paidCents} = 0 AND (${i.dueDate} IS NULL OR ${i.dueDate} >= ${today})`
    case 'OVERDUE':
      return sql`${i.status} = 'SENT' AND ${i.paidCents} = 0 AND ${i.dueDate} < ${today}`
    case 'PARTIALLY_PAID':
      return sql`${i.status} IN ('ISSUED','SENT') AND ${i.paidCents} > 0 AND ${i.paidCents} < ${i.totalCents}`
    case 'PAID':
      return sql`${i.status} NOT IN ('CANCELLED','WRITTEN_OFF') AND ${i.totalCents} > 0 AND ${i.paidCents} >= ${i.totalCents}`
    case 'OPEN':
      return sql`${i.status} IN ('ISSUED','SENT') AND ${i.paidCents} < ${i.totalCents}`
    case 'CANCELLED':
    case 'WRITTEN_OFF':
      return eq(i.status, status)
  }
}

export async function listInvoices(db: DbOrTx, filters: InvoiceListFilters, today: string = todayIso()) {
  const conditions: SQL[] = []
  const status = statusCondition(filters.status, today)
  if (status) conditions.push(status)
  if (filters.clientId) conditions.push(eq(invoices.clientId, filters.clientId))
  if (filters.year) conditions.push(sql`YEAR(COALESCE(${invoices.issueDate}, ${invoices.createdAt})) = ${filters.year}`)
  if (filters.q) {
    const term = `%${filters.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`
    conditions.push(
      or(like(invoices.title, term), like(clients.name, term), sql`CAST(${invoices.number} AS CHAR) LIKE ${term}`, like(invoices.qrReference, term))!,
    )
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined

  const order = {
    number_desc: [desc(invoices.number)],
    number_asc: [asc(invoices.number)],
    amount_desc: [desc(invoices.totalCents), desc(invoices.number)],
    amount_asc: [asc(invoices.totalCents), desc(invoices.number)],
    due_asc: [sql`${invoices.dueDate} IS NULL`, asc(invoices.dueDate), desc(invoices.number)],
  }[filters.sort ?? 'number_desc']

  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      qrReference: invoices.qrReference,
      title: invoices.title,
      status: invoices.status,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      totalCents: invoices.totalCents,
      paidCents: invoices.paidCents,
      subscriptionId: invoices.subscriptionId,
      clientId: clients.id,
      clientName: clients.name,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(where)
    .orderBy(...order)
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize)

  const [summary] = await db
    .select({
      count: sql<number>`COUNT(*)`,
      totalCents: sql<string>`COALESCE(SUM(${invoices.totalCents}), 0)`,
      paidCents: sql<string>`COALESCE(SUM(${invoices.paidCents}), 0)`,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(where)

  return {
    items: rows.map((r) => ({ ...r, displayStatus: displayStatus(r, today) })),
    total: Number(summary?.count ?? 0),
    totalCents: Number(summary?.totalCents ?? 0),
    paidCents: Number(summary?.paidCents ?? 0),
    page: filters.page,
    pageSize: filters.pageSize,
  }
}

export async function getInvoiceDetail(db: DbOrTx, id: number, today: string = todayIso()) {
  const invoice = await getInvoice(db, id)
  const [client] = await db.select().from(clients).where(eq(clients.id, invoice.clientId))
  const [lines, events, invoicePayments, linkedExpenses, subscription] = await Promise.all([
    db
      .select({
        id: invoiceLines.id,
        serviceId: invoiceLines.serviceId,
        serviceName: services.name,
        label: invoiceLines.label,
        quantity: invoiceLines.quantity,
        unitPriceCents: invoiceLines.unitPriceCents,
        unitCostCents: invoiceLines.unitCostCents,
        position: invoiceLines.position,
      })
      .from(invoiceLines)
      .leftJoin(services, eq(services.id, invoiceLines.serviceId))
      .where(eq(invoiceLines.invoiceId, id))
      .orderBy(asc(invoiceLines.position), asc(invoiceLines.id)),
    db
      .select({
        id: invoiceEvents.id,
        type: invoiceEvents.type,
        message: invoiceEvents.message,
        createdAt: invoiceEvents.createdAt,
        userFirstname: users.firstname,
      })
      .from(invoiceEvents)
      .leftJoin(users, eq(users.id, invoiceEvents.userId))
      .where(eq(invoiceEvents.invoiceId, id))
      .orderBy(asc(invoiceEvents.createdAt), asc(invoiceEvents.id)),
    db.select().from(payments).where(eq(payments.invoiceId, id)).orderBy(asc(payments.paidAt)),
    db.select().from(expenses).where(eq(expenses.invoiceId, id)),
    invoice.subscriptionId
      ? db.select({ id: subscriptions.id, name: subscriptions.name }).from(subscriptions).where(eq(subscriptions.id, invoice.subscriptionId))
      : Promise.resolve([]),
  ])
  return {
    invoice: { ...invoice, displayStatus: displayStatus(invoice, today), editable: isInvoiceEditable(invoice) },
    client: client ?? null,
    lines,
    events,
    payments: invoicePayments,
    expenses: linkedExpenses,
    subscription: subscription[0] ?? null,
  }
}
