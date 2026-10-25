import { and, desc, eq, sql } from 'drizzle-orm'
import type { DbOrTx } from '../db/client'
import { bankTransactions, clients, expenses, invoices, payments, users } from '../db/schema'
import { addDays, todayIso } from '../../shared/utils/dates'
import { displayStatus } from '../../shared/utils/invoice-status'
import { contractAlerts } from './contracts'
import { listSubscriptions } from './subscriptions'

const MONTHS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']

/**
 * Indicateurs de l'année :
 * - facturé = factures émises (date d'émission), hors brouillons et annulées ; une facture soldée compte pour ce qui a été encaissé ;
 * - encaissé = paiements reçus (date de paiement) ;
 * - dépenses = dépenses (date) ; résultat = encaissé − dépenses (prélèvements associés exclus).
 */
export async function getDashboard(db: DbOrTx, year: number, today: string = todayIso()) {
  const invoicedExpr = sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'WRITTEN_OFF' THEN ${invoices.paidCents} ELSE ${invoices.totalCents} END), 0)`
  const issuedFilter = and(sql`${invoices.status} NOT IN ('DRAFT','CANCELLED')`, sql`YEAR(${invoices.issueDate}) = ${year}`)

  const [invoicedByMonth, collectedByMonth, expensesByMonth, withdrawals, open, overdue, drafts, pendingBank, topClients, years, recentInvoices] = await Promise.all([
    db
      .select({ month: sql<number>`MONTH(${invoices.issueDate})`, total: invoicedExpr })
      .from(invoices)
      .where(issuedFilter)
      .groupBy(sql`MONTH(${invoices.issueDate})`),
    db
      .select({ month: sql<number>`MONTH(${payments.paidAt})`, total: sql<string>`COALESCE(SUM(${payments.amountCents}), 0)` })
      .from(payments)
      .where(sql`YEAR(${payments.paidAt}) = ${year}`)
      .groupBy(sql`MONTH(${payments.paidAt})`),
    db
      .select({ month: sql<number>`MONTH(${expenses.date})`, total: sql<string>`COALESCE(SUM(${expenses.amountCents}), 0)` })
      .from(expenses)
      .where(sql`YEAR(${expenses.date}) = ${year}`)
      .groupBy(sql`MONTH(${expenses.date})`),
    db
      .select({ userId: bankTransactions.partnerUserId, firstname: users.firstname, total: sql<string>`COALESCE(SUM(${bankTransactions.amountCents}), 0)` })
      .from(bankTransactions)
      .leftJoin(users, eq(users.id, bankTransactions.partnerUserId))
      .where(and(eq(bankTransactions.kind, 'PARTNER_WITHDRAWAL'), sql`YEAR(${bankTransactions.bookingDate}) = ${year}`))
      .groupBy(bankTransactions.partnerUserId, users.firstname),
    db
      .select({ n: sql<number>`COUNT(*)`, total: sql<string>`COALESCE(SUM(${invoices.totalCents} - ${invoices.paidCents}), 0)` })
      .from(invoices)
      .where(sql`${invoices.status} IN ('ISSUED','SENT') AND ${invoices.paidCents} < ${invoices.totalCents}`),
    db
      .select({ n: sql<number>`COUNT(*)`, total: sql<string>`COALESCE(SUM(${invoices.totalCents} - ${invoices.paidCents}), 0)` })
      .from(invoices)
      .where(sql`${invoices.status} = 'SENT' AND ${invoices.paidCents} < ${invoices.totalCents} AND ${invoices.dueDate} < ${today}`),
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        title: invoices.title,
        clientName: clients.name,
        totalCents: invoices.totalCents,
        subscriptionId: invoices.subscriptionId,
        billingPeriodStart: invoices.billingPeriodStart,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .where(eq(invoices.status, 'DRAFT'))
      .orderBy(desc(invoices.createdAt))
      .limit(20),
    db.select({ n: sql<number>`COUNT(*)` }).from(bankTransactions).where(eq(bankTransactions.status, 'PENDING')),
    db
      .select({ clientId: clients.id, name: clients.name, total: invoicedExpr })
      .from(invoices)
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .where(issuedFilter)
      .groupBy(clients.id, clients.name)
      .orderBy(desc(invoicedExpr))
      .limit(5),
    db
      .select({ year: sql<number>`DISTINCT YEAR(${invoices.issueDate})` })
      .from(invoices)
      .where(sql`${invoices.issueDate} IS NOT NULL`),
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        title: invoices.title,
        clientName: clients.name,
        status: invoices.status,
        totalCents: invoices.totalCents,
        paidCents: invoices.paidCents,
        dueDate: invoices.dueDate,
        issueDate: invoices.issueDate,
      })
      .from(invoices)
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .where(sql`${invoices.status} <> 'CANCELLED'`)
      .orderBy(desc(invoices.number))
      .limit(6),
  ])

  const series = (rows: Array<{ month: number; total: string }>) => {
    const values = Array.from({ length: 12 }, () => 0)
    for (const r of rows) values[Number(r.month) - 1] = Number(r.total)
    return values
  }
  const invoiced = series(invoicedByMonth)
  const collected = series(collectedByMonth)
  const spent = series(expensesByMonth)
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

  const subscriptions = await listSubscriptions(db, { status: 'ACTIVE' }, today)
  const horizon = addDays(today, 45)
  const upcoming = subscriptions.filter((s) => s.nextBillingDate <= horizon).map((s) => ({
    id: s.id,
    name: s.name,
    clientName: s.clientName,
    nextBillingDate: s.nextBillingDate,
    daysUntilBilling: s.daysUntilBilling,
    periodPriceCents: s.periodPriceCents,
    isLate: s.isLate,
  }))
  const recurringYearCents = subscriptions.reduce((s, sub) => s + sub.yearlyPriceCents, 0)
  const recurringMarginCents = subscriptions.reduce((s, sub) => s + sub.yearlyMarginCents, 0)

  const allYears = new Set(years.map((y) => Number(y.year)).filter((y) => y > 2000))
  allYears.add(Number(today.slice(0, 4)))

  return {
    year,
    years: [...allYears].sort((a, b) => b - a),
    months: MONTHS,
    series: { invoiced, collected, expenses: spent },
    totals: {
      invoicedCents: sum(invoiced),
      collectedCents: sum(collected),
      expensesCents: sum(spent),
      resultCents: sum(collected) - sum(spent),
      withdrawals: withdrawals.map((w) => ({ firstname: w.firstname ?? '—', totalCents: Number(w.total) })),
    },
    receivables: {
      openCount: Number(open[0]?.n ?? 0),
      openCents: Number(open[0]?.total ?? 0),
      overdueCount: Number(overdue[0]?.n ?? 0),
      overdueCents: Number(overdue[0]?.total ?? 0),
    },
    recurring: { yearlyCents: recurringYearCents, yearlyMarginCents: recurringMarginCents, activeCount: subscriptions.length },
    drafts: drafts.map((d) => ({ ...d, generatedLate: Boolean(d.billingPeriodStart && d.billingPeriodStart < d.createdAt.toISOString().slice(0, 10)) })),
    upcomingRenewals: upcoming,
    contractAlerts: (await contractAlerts(db, today)).map((c) => ({
      id: c.id,
      name: c.name,
      clientName: c.clientName,
      period: c.currentPeriod,
    })),
    pendingBankCount: Number(pendingBank[0]?.n ?? 0),
    topClients: topClients.map((c) => ({ clientId: c.clientId, name: c.name, totalCents: Number(c.total) })),
    recentInvoices: recentInvoices.map((i) => ({ ...i, displayStatus: displayStatus(i, today) })),
  }
}
