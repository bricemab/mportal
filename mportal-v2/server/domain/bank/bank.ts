import { createHash } from 'node:crypto'
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql, type SQL } from 'drizzle-orm'
import type { Db, DbOrTx } from '../../db/client'
import { bankImports, bankTransactions, clients, expenses, invoices, payments, users } from '../../db/schema'
import { addDays, diffDays } from '../../../shared/utils/dates'
import { remainingCents } from '../../../shared/utils/invoice-status'
import { audit, type Actor } from '../audit'
import { badRequest, conflict, notFound } from '../errors'
import { guessExpenseCategory } from '../expense-category'
import { createExpense } from '../expenses'
import { addPayment } from '../invoices'
import { getSettings } from '../settings'
import { isPdf, isXml } from '../storage'
import { parseCamt053 } from './parse-camt'
import { parseBcvsPdf } from './parse-pdf'
import { fingerprintTransactions, type ParsedStatement } from './types'

export type BankTransactionRow = typeof bankTransactions.$inferSelect

export interface ImportSummary {
  importId: number
  format: ParsedStatement['format']
  total: number
  created: number
  enriched: number
  autoMatched: { payments: number; expenses: number; withdrawals: number }
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export async function parseStatementFile(content: Buffer): Promise<ParsedStatement> {
  if (isPdf(content)) return parseBcvsPdf(new Uint8Array(content))
  if (isXml(content)) return parseCamt053(content.toString('utf8'))
  throw badRequest('Format non reconnu : importez un relevé PDF BCVS ou un fichier camt.053 (XML)')
}

/** Importe un relevé : dédoublonnage, enrichissement des mouvements déjà connus, puis rapprochement automatique. */
export async function importStatement(db: Db, actor: Actor, fileName: string, content: Buffer): Promise<ImportSummary> {
  const fileHash = createHash('sha256').update(content).digest('hex')
  const [existing] = await db.select({ id: bankImports.id }).from(bankImports).where(eq(bankImports.fileHash, fileHash))
  if (existing) throw conflict('Ce fichier a déjà été importé')

  const statement = await parseStatementFile(content)
  const settings = await getSettings(db)
  if (statement.iban && settings.BANK_IBAN && statement.iban.replace(/\s/g, '') !== settings.BANK_IBAN) {
    throw badRequest(`Ce relevé concerne le compte ${statement.iban}, pas le compte configuré (${settings.BANK_IBAN})`)
  }
  const fingerprints = fingerprintTransactions(statement.transactions, statement.iban ?? settings.BANK_IBAN)

  const { importId, createdIds, enriched } = await db.transaction(async (tx) => {
    const [res] = await tx
      .insert(bankImports)
      .values({
        fileName: fileName.slice(0, 255),
        fileHash,
        format: statement.format,
        iban: statement.iban,
        periodFrom: statement.periodFrom,
        periodTo: statement.periodTo,
        openingBalanceCents: statement.openingBalanceCents,
        closingBalanceCents: statement.closingBalanceCents,
        transactionCount: statement.transactions.length,
        importedBy: actor.userId,
      })
      .$returningId()
    if (!res) throw new Error('Insertion import échouée')

    const known = fingerprints.length
      ? await tx.select().from(bankTransactions).where(inArray(bankTransactions.fingerprint, fingerprints))
      : []
    const knownMap = new Map(known.map((k) => [k.fingerprint, k]))
    const ids: number[] = []
    let enrichedCount = 0

    for (const [index, t] of statement.transactions.entries()) {
      const fingerprint = fingerprints[index]!
      const previous = knownMap.get(fingerprint)
      if (previous) {
        // Le même mouvement importé depuis un autre format : on complète les informations manquantes
        const patch: Partial<BankTransactionRow> = {}
        if (!previous.qrReference && t.qrReference) patch.qrReference = t.qrReference
        if (!previous.counterparty && t.counterparty) patch.counterparty = t.counterparty
        if (!previous.counterpartyIban && t.counterpartyIban) patch.counterpartyIban = t.counterpartyIban
        if (!previous.valueDate && t.valueDate) patch.valueDate = t.valueDate
        if (Object.keys(patch).length > 0) {
          await tx.update(bankTransactions).set(patch).where(eq(bankTransactions.id, previous.id))
          enrichedCount++
          if (previous.status === 'PENDING') ids.push(previous.id)
        }
        continue
      }
      const [inserted] = await tx
        .insert(bankTransactions)
        .values({
          importId: res.id,
          fingerprint,
          bookingDate: t.bookingDate,
          valueDate: t.valueDate,
          amountCents: t.amountCents,
          direction: t.direction,
          counterparty: t.counterparty,
          counterpartyIban: t.counterpartyIban,
          description: t.description,
          qrReference: t.qrReference,
        })
        .$returningId()
      if (inserted) ids.push(inserted.id)
    }
    await audit(tx, actor, 'import', 'bank', res.id, { fileName, format: statement.format, transactions: statement.transactions.length })
    return { importId: res.id, createdIds: ids, enriched: enrichedCount }
  })

  const autoMatched = { payments: 0, expenses: 0, withdrawals: 0 }
  for (const id of createdIds) {
    const result = await autoMatchTransaction(db, actor, id)
    if (result === 'INVOICE_PAYMENT') autoMatched.payments++
    if (result === 'EXPENSE') autoMatched.expenses++
    if (result === 'PARTNER_WITHDRAWAL') autoMatched.withdrawals++
  }
  const created = await db.select({ n: sql<number>`COUNT(*)` }).from(bankTransactions).where(eq(bankTransactions.importId, importId))
  await db.update(bankImports).set({ newTransactionCount: Number(created[0]?.n ?? 0) }).where(eq(bankImports.id, importId))

  return {
    importId,
    format: statement.format,
    total: statement.transactions.length,
    created: Number(created[0]?.n ?? 0),
    enriched,
    autoMatched,
  }
}

async function markMatched(tx: DbOrTx, actor: Actor, id: number, kind: BankTransactionRow['kind'], extra: Partial<BankTransactionRow> = {}) {
  await tx
    .update(bankTransactions)
    .set({ status: 'MATCHED', kind, matchedAt: new Date(), matchedBy: actor.userId, ...extra })
    .where(eq(bankTransactions.id, id))
}

async function getTransaction(db: DbOrTx, id: number, forUpdate = false): Promise<BankTransactionRow> {
  const query = db.select().from(bankTransactions).where(eq(bankTransactions.id, id)).limit(1)
  const [row] = forUpdate ? await query.for('update') : await query
  if (!row) throw notFound('Mouvement bancaire introuvable')
  return row
}

/**
 * Rapprochement automatique sûr :
 * - crédit avec référence QR connue → paiement de la facture (ou liaison au paiement déjà saisi) ;
 * - crédit sans référence → liaison à un paiement déjà saisi du même montant, à ±20 jours ;
 * - débit vers un associé (IBAN ou nom) → prélèvement associé ;
 * - débit fournisseur → dépense non rapprochée du même montant la plus proche dans le temps.
 * Tout le reste reste « à traiter » avec des suggestions.
 */
export async function autoMatchTransaction(db: Db, actor: Actor, id: number): Promise<BankTransactionRow['kind'] | null> {
  return db.transaction(async (tx) => {
    const t = await getTransaction(tx, id, true)
    if (t.status !== 'PENDING') return null

    if (t.direction === 'CREDIT') {
      const linkExisting = async (invoiceId: number | null): Promise<boolean> => {
        const conditions: SQL[] = [isNull(payments.bankTransactionId), eq(payments.amountCents, t.amountCents)]
        if (invoiceId) conditions.push(eq(payments.invoiceId, invoiceId))
        else conditions.push(gte(payments.paidAt, addDays(t.bookingDate, -20)), lte(payments.paidAt, addDays(t.bookingDate, 20)))
        const candidates = await tx.select().from(payments).where(and(...conditions))
        if (candidates.length !== 1) return false
        await tx.update(payments).set({ bankTransactionId: t.id }).where(eq(payments.id, candidates[0]!.id))
        await markMatched(tx, actor, t.id, 'INVOICE_PAYMENT')
        return true
      }

      if (t.qrReference) {
        const [invoice] = await tx.select().from(invoices).where(eq(invoices.qrReference, t.qrReference))
        if (invoice) {
          if (await linkExisting(invoice.id)) return 'INVOICE_PAYMENT'
          const remaining = remainingCents(invoice)
          if (['DRAFT', 'ISSUED', 'SENT'].includes(invoice.status) && t.amountCents <= remaining) {
            await addPayment(tx, actor, invoice.id, {
              amountCents: t.amountCents,
              paidAt: t.bookingDate,
              note: `Relevé bancaire du ${t.bookingDate}`,
              bankTransactionId: t.id,
            })
            await markMatched(tx, actor, t.id, 'INVOICE_PAYMENT')
            return 'INVOICE_PAYMENT'
          }
        }
        return null
      }
      if (await linkExisting(null)) return 'INVOICE_PAYMENT'
      return null
    }

    // Débit : prélèvement d'un associé ?
    const partners = await tx.select({ id: users.id, firstname: users.firstname, lastname: users.lastname, bankIban: users.bankIban }).from(users)
    const counterparty = normalizeName(t.counterparty ?? '')
    const partner = partners.find(
      (p) =>
        (p.bankIban && t.counterpartyIban && p.bankIban === t.counterpartyIban) ||
        (counterparty.includes(normalizeName(p.firstname)) && counterparty.includes(normalizeName(p.lastname))),
    )
    if (partner) {
      await markMatched(tx, actor, t.id, 'PARTNER_WITHDRAWAL', { partnerUserId: partner.id })
      return 'PARTNER_WITHDRAWAL'
    }

    // Débit fournisseur : dépense prévue du même montant
    const candidates = await tx
      .select()
      .from(expenses)
      .where(
        and(
          isNull(expenses.bankTransactionId),
          eq(expenses.amountCents, t.amountCents),
          gte(expenses.date, addDays(t.bookingDate, -75)),
          lte(expenses.date, addDays(t.bookingDate, 15)),
        ),
      )
    if (candidates.length > 0) {
      const best = [...candidates].sort((a, b) => Math.abs(diffDays(a.date, t.bookingDate)) - Math.abs(diffDays(b.date, t.bookingDate)))[0]!
      await tx.update(expenses).set({ bankTransactionId: t.id }).where(eq(expenses.id, best.id))
      await markMatched(tx, actor, t.id, 'EXPENSE')
      return 'EXPENSE'
    }
    return null
  })
}

// ---------------------------------------------------------------------------
// Lecture & actions manuelles
// ---------------------------------------------------------------------------

export async function listTransactions(
  db: DbOrTx,
  filters: { status?: BankTransactionRow['status']; direction?: BankTransactionRow['direction']; year?: number; page: number; pageSize: number },
) {
  const conditions: SQL[] = []
  if (filters.status) conditions.push(eq(bankTransactions.status, filters.status))
  if (filters.direction) conditions.push(eq(bankTransactions.direction, filters.direction))
  if (filters.year) conditions.push(sql`YEAR(${bankTransactions.bookingDate}) = ${filters.year}`)
  const where = conditions.length ? and(...conditions) : undefined
  const rows = await db
    .select()
    .from(bankTransactions)
    .where(where)
    .orderBy(desc(bankTransactions.bookingDate), desc(bankTransactions.id))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize)
  const [count] = await db.select({ n: sql<number>`COUNT(*)` }).from(bankTransactions).where(where)

  const ids = rows.map((r) => r.id)
  const [linkedPayments, linkedExpenses, partners] = await Promise.all([
    ids.length
      ? db
          .select({ bankTransactionId: payments.bankTransactionId, invoiceId: invoices.id, number: invoices.number, title: invoices.title, clientName: clients.name })
          .from(payments)
          .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
          .innerJoin(clients, eq(clients.id, invoices.clientId))
          .where(inArray(payments.bankTransactionId, ids))
      : Promise.resolve([]),
    ids.length
      ? db.select({ bankTransactionId: expenses.bankTransactionId, id: expenses.id, label: expenses.label }).from(expenses).where(inArray(expenses.bankTransactionId, ids))
      : Promise.resolve([]),
    db.select({ id: users.id, firstname: users.firstname }).from(users),
  ])

  const items = []
  for (const r of rows) {
    items.push({
      ...r,
      invoice: linkedPayments.find((p) => p.bankTransactionId === r.id) ?? null,
      expense: linkedExpenses.find((e) => e.bankTransactionId === r.id) ?? null,
      partner: partners.find((p) => p.id === r.partnerUserId) ?? null,
      suggestions: r.status === 'PENDING' ? await suggestionsFor(db, r) : null,
    })
  }
  return { items, total: Number(count?.n ?? 0), page: filters.page, pageSize: filters.pageSize }
}

async function suggestionsFor(db: DbOrTx, t: BankTransactionRow) {
  if (t.direction === 'CREDIT') {
    const conditions: SQL[] = [inArray(invoices.status, ['DRAFT', 'ISSUED', 'SENT']), sql`${invoices.paidCents} < ${invoices.totalCents}`]
    const byReference = t.qrReference
      ? await db
          .select({ id: invoices.id, number: invoices.number, title: invoices.title, clientName: clients.name, totalCents: invoices.totalCents, paidCents: invoices.paidCents, status: invoices.status })
          .from(invoices)
          .innerJoin(clients, eq(clients.id, invoices.clientId))
          .where(eq(invoices.qrReference, t.qrReference))
      : []
    const byAmount = await db
      .select({ id: invoices.id, number: invoices.number, title: invoices.title, clientName: clients.name, totalCents: invoices.totalCents, paidCents: invoices.paidCents, status: invoices.status })
      .from(invoices)
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .where(and(...conditions, sql`${invoices.totalCents} - ${invoices.paidCents} = ${t.amountCents}`))
      // Les factures dont l'échéance est la plus proche du paiement d'abord
      .orderBy(sql`ABS(DATEDIFF(COALESCE(${invoices.dueDate}, ${invoices.createdAt}), ${t.bookingDate}))`, asc(invoices.id))
      .limit(8)
    const seen = new Set<number>()
    return {
      invoices: [...byReference, ...byAmount].filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true))),
      expenses: [],
    }
  }
  const nearby = await db
    .select({ id: expenses.id, label: expenses.label, date: expenses.date, amountCents: expenses.amountCents })
    .from(expenses)
    .where(and(isNull(expenses.bankTransactionId), eq(expenses.amountCents, t.amountCents)))
    .orderBy(desc(expenses.date))
    .limit(5)
  return { invoices: [], expenses: nearby, category: guessExpenseCategory(`${t.counterparty ?? ''} ${t.description ?? ''}`) }
}

async function requirePending(tx: DbOrTx, id: number, direction?: BankTransactionRow['direction']) {
  const t = await getTransaction(tx, id, true)
  if (t.status !== 'PENDING') throw conflict('Ce mouvement est déjà traité')
  if (direction && t.direction !== direction) throw badRequest(direction === 'CREDIT' ? 'Action réservée aux crédits' : 'Action réservée aux débits')
  return t
}

export async function matchTransactionToInvoice(tx: DbOrTx, actor: Actor, id: number, invoiceId: number) {
  const t = await requirePending(tx, id, 'CREDIT')
  const [existingPayment] = await tx
    .select()
    .from(payments)
    .where(and(eq(payments.invoiceId, invoiceId), isNull(payments.bankTransactionId), eq(payments.amountCents, t.amountCents)))
    .limit(1)
  if (existingPayment) {
    await tx.update(payments).set({ bankTransactionId: id }).where(eq(payments.id, existingPayment.id))
  } else {
    await addPayment(tx, actor, invoiceId, { amountCents: t.amountCents, paidAt: t.bookingDate, note: `Relevé bancaire du ${t.bookingDate}`, bankTransactionId: id })
  }
  await markMatched(tx, actor, id, 'INVOICE_PAYMENT')
  await audit(tx, actor, 'match_invoice', 'bank_transaction', id, { invoiceId })
}

export async function linkTransactionToExpense(tx: DbOrTx, actor: Actor, id: number, expenseId: number) {
  const t = await requirePending(tx, id, 'DEBIT')
  const [expense] = await tx.select().from(expenses).where(eq(expenses.id, expenseId)).for('update')
  if (!expense) throw notFound('Dépense introuvable')
  if (expense.bankTransactionId) throw conflict('Cette dépense est déjà rapprochée')
  await tx.update(expenses).set({ bankTransactionId: id, amountCents: t.amountCents }).where(eq(expenses.id, expenseId))
  await markMatched(tx, actor, id, 'EXPENSE')
  await audit(tx, actor, 'link_expense', 'bank_transaction', id, { expenseId })
}

export async function createExpenseFromTransaction(
  tx: DbOrTx,
  actor: Actor,
  id: number,
  input: { category: (typeof expenses.$inferInsert)['category']; label: string; supplier: string | null; clientId: number | null; invoiceId: number | null },
) {
  const t = await requirePending(tx, id, 'DEBIT')
  const expense = await createExpense(
    tx,
    actor,
    {
      date: t.bookingDate,
      amountCents: t.amountCents,
      category: input.category ?? 'OTHER',
      label: input.label,
      supplier: input.supplier,
      clientId: input.clientId,
      invoiceId: input.invoiceId,
      notes: null,
    },
    id,
  )
  await markMatched(tx, actor, id, 'EXPENSE')
  return expense
}

export async function classifyTransaction(
  tx: DbOrTx,
  actor: Actor,
  id: number,
  input: { kind: 'PARTNER_WITHDRAWAL' | 'OTHER'; partnerUserId: number | null; note: string | null },
) {
  await requirePending(tx, id)
  if (input.kind === 'PARTNER_WITHDRAWAL') {
    if (!input.partnerUserId) throw badRequest('Associé requis')
    const [partner] = await tx.select({ id: users.id }).from(users).where(eq(users.id, input.partnerUserId))
    if (!partner) throw badRequest('Associé introuvable')
  }
  await markMatched(tx, actor, id, input.kind, { partnerUserId: input.kind === 'PARTNER_WITHDRAWAL' ? input.partnerUserId : null, note: input.note })
  await audit(tx, actor, 'classify', 'bank_transaction', id, input)
}

export async function ignoreTransaction(tx: DbOrTx, actor: Actor, id: number, note: string | null) {
  await requirePending(tx, id)
  await tx.update(bankTransactions).set({ status: 'IGNORED', kind: 'OTHER', note, matchedAt: new Date(), matchedBy: actor.userId }).where(eq(bankTransactions.id, id))
  await audit(tx, actor, 'ignore', 'bank_transaction', id)
}

/**
 * Remet un mouvement « à traiter ». Le paiement ou la dépense liés sont conservés mais déliés :
 * pour annuler un paiement, supprimez-le depuis la facture.
 */
export async function resetTransaction(tx: DbOrTx, actor: Actor, id: number) {
  await getTransaction(tx, id, true)
  await tx.update(payments).set({ bankTransactionId: null }).where(eq(payments.bankTransactionId, id))
  await tx.update(expenses).set({ bankTransactionId: null }).where(eq(expenses.bankTransactionId, id))
  await tx
    .update(bankTransactions)
    .set({ status: 'PENDING', kind: 'UNCLASSIFIED', partnerUserId: null, matchedAt: null, matchedBy: null, note: null })
    .where(eq(bankTransactions.id, id))
  await audit(tx, actor, 'reset', 'bank_transaction', id)
}

export async function listImports(db: DbOrTx) {
  return db
    .select({ import: bankImports, firstname: users.firstname })
    .from(bankImports)
    .leftJoin(users, eq(users.id, bankImports.importedBy))
    .orderBy(desc(bankImports.createdAt))
    .limit(50)
}
