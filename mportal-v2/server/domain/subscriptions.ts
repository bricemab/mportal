import { and, asc, desc, eq, inArray, isNull, lte, sql } from 'drizzle-orm'
import type { Db, DbOrTx } from '../db/client'
import { clients, invoices, maintenanceContracts, maintenancePeriods, services, subscriptionLines, subscriptions } from '../db/schema'
import { addDays, addPeriod, diffDays, formatDateCh, todayIso } from '../../shared/utils/dates'
import type { SubscriptionInput } from '../../shared/utils/schemas'
import { audit, type Actor } from './audit'
import { badRequest, conflict, notFound } from './errors'
import { addInvoiceEvent, createInvoice } from './invoices'
import { getNumberSetting } from './settings'

export type SubscriptionRow = typeof subscriptions.$inferSelect
export type SubscriptionLineRow = typeof subscriptionLines.$inferSelect

/** Facteur d'annualisation pour comparer abonnements mensuels et annuels. */
function perYear(period: 'YEARLY' | 'MONTHLY'): number {
  return period === 'MONTHLY' ? 12 : 1
}

export async function getSubscription(db: DbOrTx, id: number, forUpdate = false): Promise<SubscriptionRow> {
  const query = db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1)
  const [row] = forUpdate ? await query.for('update') : await query
  if (!row) throw notFound('Abonnement introuvable')
  return row
}

async function activeLines(db: DbOrTx, subscriptionIds: number[]) {
  if (subscriptionIds.length === 0) return []
  return db
    .select({
      id: subscriptionLines.id,
      subscriptionId: subscriptionLines.subscriptionId,
      serviceId: subscriptionLines.serviceId,
      serviceName: services.name,
      isMaintenance: services.isMaintenance,
      label: subscriptionLines.label,
      quantity: subscriptionLines.quantity,
      unitPriceCents: subscriptionLines.unitPriceCents,
      unitCostCents: subscriptionLines.unitCostCents,
      supplier: subscriptionLines.supplier,
      position: subscriptionLines.position,
    })
    .from(subscriptionLines)
    .innerJoin(services, eq(services.id, subscriptionLines.serviceId))
    .where(and(inArray(subscriptionLines.subscriptionId, subscriptionIds), isNull(subscriptionLines.endedAt)))
    .orderBy(asc(subscriptionLines.position), asc(subscriptionLines.id))
}

export async function listSubscriptions(db: DbOrTx, opts: { status?: 'ACTIVE' | 'ENDED'; clientId?: number } = {}, today: string = todayIso()) {
  const conditions = []
  if (opts.status) conditions.push(eq(subscriptions.status, opts.status))
  if (opts.clientId) conditions.push(eq(subscriptions.clientId, opts.clientId))
  const rows = await db
    .select({ subscription: subscriptions, clientName: clients.name })
    .from(subscriptions)
    .innerJoin(clients, eq(clients.id, subscriptions.clientId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(subscriptions.status), asc(subscriptions.nextBillingDate))
  const lines = await activeLines(
    db,
    rows.map((r) => r.subscription.id),
  )
  const leadDays = await getNumberSetting(db, 'SUBSCRIPTION_LEAD_DAYS')
  return rows.map(({ subscription, clientName }) => {
    const own = lines.filter((l) => l.subscriptionId === subscription.id)
    const priceCents = own.reduce((s, l) => s + Math.round(l.quantity * l.unitPriceCents), 0)
    const costCents = own.reduce((s, l) => s + Math.round(l.quantity * (l.unitCostCents ?? 0)), 0)
    const daysUntil = diffDays(today, subscription.nextBillingDate)
    return {
      ...subscription,
      clientName,
      lines: own,
      periodPriceCents: priceCents,
      periodCostCents: costCents,
      yearlyPriceCents: priceCents * perYear(subscription.period),
      yearlyMarginCents: (priceCents - costCents) * perYear(subscription.period),
      daysUntilBilling: daysUntil,
      // En retard : l'échéance est passée et la facture n'a pas encore été générée
      isLate: subscription.status === 'ACTIVE' && daysUntil < 0,
      isDueSoon: subscription.status === 'ACTIVE' && daysUntil <= leadDays,
    }
  })
}

export async function getSubscriptionDetail(db: DbOrTx, id: number, today: string = todayIso()) {
  const subscription = await getSubscription(db, id)
  const [client] = await db.select().from(clients).where(eq(clients.id, subscription.clientId))
  const lines = await activeLines(db, [id])
  const endedLines = await db
    .select({ line: subscriptionLines, serviceName: services.name })
    .from(subscriptionLines)
    .innerJoin(services, eq(services.id, subscriptionLines.serviceId))
    .where(and(eq(subscriptionLines.subscriptionId, id), sql`${subscriptionLines.endedAt} IS NOT NULL`))
  const generated = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      title: invoices.title,
      status: invoices.status,
      billingPeriodStart: invoices.billingPeriodStart,
      totalCents: invoices.totalCents,
      paidCents: invoices.paidCents,
      dueDate: invoices.dueDate,
      issueDate: invoices.issueDate,
    })
    .from(invoices)
    .where(eq(invoices.subscriptionId, id))
    .orderBy(desc(invoices.number))
  const contracts = lines.length
    ? await db
        .select()
        .from(maintenanceContracts)
        .where(
          inArray(
            maintenanceContracts.subscriptionLineId,
            lines.map((l) => l.id),
          ),
        )
    : []
  return {
    subscription: { ...subscription, daysUntilBilling: diffDays(today, subscription.nextBillingDate) },
    client: client ?? null,
    lines,
    endedLines: endedLines.map((e) => ({ ...e.line, serviceName: e.serviceName })),
    invoices: generated,
    contracts,
  }
}

async function assertServices(db: DbOrTx, ids: number[]) {
  const unique = [...new Set(ids)]
  const found = await db.select({ id: services.id }).from(services).where(inArray(services.id, unique))
  if (found.length !== unique.length) throw badRequest('Service inconnu dans les lignes')
}

export async function createSubscription(tx: DbOrTx, actor: Actor, input: SubscriptionInput): Promise<SubscriptionRow> {
  const [client] = await tx.select({ id: clients.id }).from(clients).where(eq(clients.id, input.clientId))
  if (!client) throw badRequest('Client introuvable')
  if (input.nextBillingDate < input.startDate) throw badRequest('La prochaine facturation ne peut pas précéder le début')
  await assertServices(
    tx,
    input.lines.map((l) => l.serviceId),
  )
  const [res] = await tx
    .insert(subscriptions)
    .values({
      clientId: input.clientId,
      name: input.name,
      period: input.period,
      startDate: input.startDate,
      nextBillingDate: input.nextBillingDate,
      notes: input.notes,
      status: 'ACTIVE',
    })
    .$returningId()
  if (!res) throw new Error('Insertion abonnement échouée')
  await tx.insert(subscriptionLines).values(
    input.lines.map((l, i) => ({
      subscriptionId: res.id,
      serviceId: l.serviceId,
      label: l.label,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      unitCostCents: l.unitCostCents,
      supplier: l.supplier,
      position: i,
    })),
  )
  await audit(tx, actor, 'create', 'subscription', res.id, { name: input.name, lines: input.lines.length })
  return getSubscription(tx, res.id)
}

/**
 * Modifie l'abonnement. Les changements de lignes s'appliquent à la prochaine facture générée
 * (pas de prorata). Une ligne retirée est clôturée, pas supprimée, pour garder l'historique.
 */
export async function updateSubscription(tx: DbOrTx, actor: Actor, id: number, input: SubscriptionInput, today: string = todayIso()) {
  const current = await getSubscription(tx, id, true)
  if (input.clientId !== current.clientId) throw badRequest('Le client d’un abonnement ne peut pas être changé')
  await assertServices(
    tx,
    input.lines.map((l) => l.serviceId),
  )
  await tx
    .update(subscriptions)
    .set({ name: input.name, period: input.period, startDate: input.startDate, nextBillingDate: input.nextBillingDate, notes: input.notes })
    .where(eq(subscriptions.id, id))

  const existing = await tx
    .select()
    .from(subscriptionLines)
    .where(and(eq(subscriptionLines.subscriptionId, id), isNull(subscriptionLines.endedAt)))
  const keptIds = new Set(input.lines.map((l) => l.id).filter((v): v is number => v !== undefined))
  for (const line of existing) {
    if (!keptIds.has(line.id)) {
      await tx.update(subscriptionLines).set({ endedAt: today }).where(eq(subscriptionLines.id, line.id))
    }
  }
  for (const [position, line] of input.lines.entries()) {
    const values = {
      serviceId: line.serviceId,
      label: line.label,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      unitCostCents: line.unitCostCents,
      supplier: line.supplier,
      position,
    }
    if (line.id !== undefined) {
      if (!existing.some((e) => e.id === line.id)) throw badRequest('Ligne d’abonnement inconnue')
      await tx.update(subscriptionLines).set(values).where(eq(subscriptionLines.id, line.id))
    } else {
      await tx.insert(subscriptionLines).values({ ...values, subscriptionId: id })
    }
  }
  await audit(tx, actor, 'update', 'subscription', id, { name: input.name, lines: input.lines })
  return getSubscription(tx, id)
}

/** Termine l'abonnement : plus aucune facture pour une période qui commence à partir de cette date. */
export async function endSubscription(tx: DbOrTx, actor: Actor, id: number, endDate: string, today: string = todayIso()) {
  const current = await getSubscription(tx, id, true)
  if (endDate < current.startDate) throw badRequest('La date de fin précède le début de l’abonnement')
  await tx
    .update(subscriptions)
    .set({ endDate, status: endDate <= today ? 'ENDED' : 'ACTIVE' })
    .where(eq(subscriptions.id, id))
  await audit(tx, actor, 'end', 'subscription', id, { endDate })
  return getSubscription(tx, id)
}

export async function reactivateSubscription(tx: DbOrTx, actor: Actor, id: number) {
  await getSubscription(tx, id, true)
  await tx.update(subscriptions).set({ endDate: null, status: 'ACTIVE' }).where(eq(subscriptions.id, id))
  await audit(tx, actor, 'reactivate', 'subscription', id)
  return getSubscription(tx, id)
}

// ---------------------------------------------------------------------------
// Génération automatique des factures
// ---------------------------------------------------------------------------

export interface GenerationResult {
  subscriptionId: number
  invoiceId: number
  invoiceNumber: number
  periodStart: string
  lateDays: number
}

function isDuplicateKey(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; depth < 5 && current; depth++) {
    if (typeof current === 'object' && current !== null && 'code' in current && (current as { code: unknown }).code === 'ER_DUP_ENTRY') return true
    current = typeof current === 'object' && current !== null && 'cause' in current ? (current as { cause: unknown }).cause : null
  }
  return false
}

/**
 * Génère les factures brouillon des abonnements arrivant à échéance (échéance − délai ≤ aujourd'hui).
 * Idempotent : la contrainte unique (abonnement, début de période) empêche toute double facturation.
 * Rattrape les périodes manquées (au maximum 24 par abonnement et par exécution).
 */
export async function generateDueInvoices(db: Db, actor: Actor, today: string = todayIso()): Promise<GenerationResult[]> {
  const leadDays = await getNumberSetting(db, 'SUBSCRIPTION_LEAD_DAYS')
  const horizon = addDays(today, leadDays)
  const results: GenerationResult[] = []

  // Clôture des abonnements dont la date de fin est passée
  await db
    .update(subscriptions)
    .set({ status: 'ENDED' })
    .where(and(eq(subscriptions.status, 'ACTIVE'), sql`${subscriptions.endDate} IS NOT NULL AND ${subscriptions.endDate} <= ${today}`))

  const due = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.status, 'ACTIVE'), lte(subscriptions.nextBillingDate, horizon)))

  for (const { id } of due) {
    results.push(...(await generateForSubscription(db, actor, id, horizon, today, 24)))
  }
  return results
}

/** Génère jusqu'à `maxPeriods` factures pour un abonnement, tant que l'échéance est ≤ horizon. */
async function generateForSubscription(
  db: Db,
  actor: Actor,
  id: number,
  horizon: string,
  today: string,
  maxPeriods: number,
): Promise<GenerationResult[]> {
  const results: GenerationResult[] = []
  {
    for (let iteration = 0; iteration < maxPeriods; iteration++) {
      const generated = await db.transaction(async (tx) => {
        const sub = await getSubscription(tx, id, true)
        if (sub.status !== 'ACTIVE' || sub.nextBillingDate > horizon) return null
        const periodStart = sub.nextBillingDate
        if (sub.endDate && periodStart >= sub.endDate) {
          await tx.update(subscriptions).set({ status: 'ENDED' }).where(eq(subscriptions.id, id))
          return null
        }
        const periodEnd = addDays(addPeriod(periodStart, sub.period), -1)
        const nextDate = addPeriod(periodStart, sub.period)
        const lines = await activeLines(tx, [id])
        if (lines.length === 0) {
          await tx.update(subscriptions).set({ nextBillingDate: nextDate }).where(eq(subscriptions.id, id))
          return null
        }
        const [client] = await tx.select({ name: clients.name }).from(clients).where(eq(clients.id, sub.clientId))
        const lateDays = Math.max(0, diffDays(periodStart, today))
        const period = `du ${formatDateCh(periodStart)} au ${formatDateCh(periodEnd)}`

        let invoice
        try {
          invoice = await createInvoice(
            tx,
            actor,
            {
              clientId: sub.clientId,
              title: `${sub.name} – ${formatDateCh(periodStart)} au ${formatDateCh(periodEnd)}`.slice(0, 255),
              notes: null,
              createExpenses: true,
              expenseSupplier: null,
              lines: [],
            },
            {
              subscriptionId: id,
              billingPeriodStart: periodStart,
              // Le fournisseur facture au renouvellement : la dépense est datée de l'échéance
              expenseDate: periodStart,
              lines: lines.map((l) => ({
                serviceId: l.serviceId,
                subscriptionLineId: l.id,
                label: l.label ? `${l.serviceName} – ${l.label}` : l.serviceName,
                quantity: l.quantity,
                unitPriceCents: l.unitPriceCents,
                unitCostCents: l.unitCostCents,
              })),
              eventMessage: `Générée automatiquement par l’abonnement « ${sub.name} » (période ${period})`,
            },
          )
        } catch (error) {
          if (!isDuplicateKey(error)) throw error
          // Déjà générée (exécution concurrente) : on avance simplement l'échéance
          await tx.update(subscriptions).set({ nextBillingDate: nextDate }).where(eq(subscriptions.id, id))
          return null
        }

        if (lateDays > 0) {
          await addInvoiceEvent(
            tx,
            invoice.id,
            'LATE',
            `⚠ Générée avec ${lateDays} jour${lateDays > 1 ? 's' : ''} de retard sur l’échéance du ${formatDateCh(periodStart)} (${client?.name ?? ''})`,
            actor.userId,
          )
        }

        // Nouvelle période d'heures pour les contrats de maintenance liés
        for (const line of lines) {
          const contracts = await tx.select().from(maintenanceContracts).where(eq(maintenanceContracts.subscriptionLineId, line.id))
          for (const contract of contracts) {
            if (contract.status !== 'ACTIVE') continue
            const end = contract.endDate && contract.endDate < periodEnd ? contract.endDate : periodEnd
            await tx
              .insert(maintenancePeriods)
              .values({ contractId: contract.id, startDate: periodStart, endDate: end, hoursQuota: contract.hoursPerPeriod * line.quantity, invoiceId: invoice.id })
              .onDuplicateKeyUpdate({ set: { invoiceId: invoice.id } })
          }
        }

        await tx.update(subscriptions).set({ nextBillingDate: nextDate }).where(eq(subscriptions.id, id))
        return { subscriptionId: id, invoiceId: invoice.id, invoiceNumber: invoice.number, periodStart, lateDays }
      })
      if (!generated) break
      results.push(generated)
    }
  }
  return results
}

/** Génère immédiatement la prochaine facture d'un abonnement, même si l'échéance est lointaine. */
export async function generateNow(db: Db, actor: Actor, id: number, today: string = todayIso()): Promise<GenerationResult> {
  const sub = await getSubscription(db, id)
  if (sub.status !== 'ACTIVE') throw conflict('Abonnement terminé')
  // Horizon = l'échéance de cet abonnement : une seule période est générée
  const horizon = sub.nextBillingDate > today ? sub.nextBillingDate : today
  const [first] = await generateForSubscription(db, actor, id, horizon, today, 1)
  if (!first) throw conflict('Aucune facture générée (abonnement sans ligne active ou terminé)')
  return first
}
