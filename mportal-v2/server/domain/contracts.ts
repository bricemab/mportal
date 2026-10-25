import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import type { DbOrTx } from '../db/client'
import { clients, invoices, maintenanceContracts, maintenancePeriods, subscriptionLines, subscriptions, timeEntries, users } from '../db/schema'
import { addDays, addPeriod, diffDays, todayIso } from '../../shared/utils/dates'
import type { ContractInput } from '../../shared/utils/schemas'
import { audit, type Actor } from './audit'
import { badRequest, conflict, notFound } from './errors'

export type ContractRow = typeof maintenanceContracts.$inferSelect
export type PeriodRow = typeof maintenancePeriods.$inferSelect

export async function getContract(db: DbOrTx, id: number): Promise<ContractRow> {
  const [row] = await db.select().from(maintenanceContracts).where(eq(maintenanceContracts.id, id)).limit(1)
  if (!row) throw notFound('Contrat introuvable')
  return row
}

async function usedHoursByPeriod(db: DbOrTx, periodIds: number[]): Promise<Map<number, number>> {
  if (periodIds.length === 0) return new Map()
  const rows = await db
    .select({ periodId: timeEntries.periodId, used: sql<string>`COALESCE(SUM(${timeEntries.hours}), 0)` })
    .from(timeEntries)
    .where(inArray(timeEntries.periodId, periodIds))
    .groupBy(timeEntries.periodId)
  return new Map(rows.map((r) => [r.periodId, Number(r.used)]))
}

/** Période « courante » : celle qui contient aujourd'hui, sinon la plus récente. */
function currentPeriod<T extends { startDate: string; endDate: string }>(periods: T[], today: string): T | null {
  return periods.find((p) => p.startDate <= today && p.endDate >= today) ?? periods.at(-1) ?? null
}

export async function listContracts(db: DbOrTx, today: string = todayIso()) {
  const rows = await db
    .select({ contract: maintenanceContracts, clientName: clients.name })
    .from(maintenanceContracts)
    .innerJoin(clients, eq(clients.id, maintenanceContracts.clientId))
    .orderBy(asc(maintenanceContracts.status), asc(clients.name))
  const periods = rows.length
    ? await db
        .select()
        .from(maintenancePeriods)
        .where(
          inArray(
            maintenancePeriods.contractId,
            rows.map((r) => r.contract.id),
          ),
        )
        .orderBy(asc(maintenancePeriods.startDate))
    : []
  const used = await usedHoursByPeriod(
    db,
    periods.map((p) => p.id),
  )
  return rows.map(({ contract, clientName }) => {
    const own = periods.filter((p) => p.contractId === contract.id)
    const period = currentPeriod(own, today)
    const usedHours = period ? (used.get(period.id) ?? 0) : 0
    return {
      ...contract,
      clientName,
      currentPeriod: period
        ? {
            ...period,
            usedHours,
            remainingHours: Math.round((period.hoursQuota - usedHours) * 100) / 100,
            daysLeft: diffDays(today, period.endDate),
          }
        : null,
    }
  })
}

export async function getContractDetail(db: DbOrTx, id: number, today: string = todayIso()) {
  const contract = await getContract(db, id)
  const [client] = await db.select().from(clients).where(eq(clients.id, contract.clientId))
  const periods = await db.select().from(maintenancePeriods).where(eq(maintenancePeriods.contractId, id)).orderBy(desc(maintenancePeriods.startDate))
  const entries = periods.length
    ? await db
        .select({
          id: timeEntries.id,
          periodId: timeEntries.periodId,
          date: timeEntries.date,
          hours: timeEntries.hours,
          description: timeEntries.description,
          userFirstname: users.firstname,
        })
        .from(timeEntries)
        .leftJoin(users, eq(users.id, timeEntries.userId))
        .where(
          inArray(
            timeEntries.periodId,
            periods.map((p) => p.id),
          ),
        )
        .orderBy(desc(timeEntries.date), desc(timeEntries.id))
    : []
  const invoiceIds = periods.map((p) => p.invoiceId).filter((v): v is number => v !== null)
  const linkedInvoices = invoiceIds.length
    ? await db
        .select({ id: invoices.id, number: invoices.number, status: invoices.status, totalCents: invoices.totalCents, paidCents: invoices.paidCents })
        .from(invoices)
        .where(inArray(invoices.id, invoiceIds))
    : []
  const subscription = contract.subscriptionLineId
    ? (
        await db
          .select({ id: subscriptions.id, name: subscriptions.name, status: subscriptions.status, nextBillingDate: subscriptions.nextBillingDate })
          .from(subscriptionLines)
          .innerJoin(subscriptions, eq(subscriptions.id, subscriptionLines.subscriptionId))
          .where(eq(subscriptionLines.id, contract.subscriptionLineId))
      )[0] ?? null
    : null

  return {
    contract,
    client: client ?? null,
    subscription,
    periods: periods.map((p) => {
      const own = entries.filter((e) => e.periodId === p.id)
      const usedHours = own.reduce((s, e) => s + e.hours, 0)
      return {
        ...p,
        isCurrent: p.startDate <= today && p.endDate >= today,
        usedHours: Math.round(usedHours * 100) / 100,
        remainingHours: Math.round((p.hoursQuota - usedHours) * 100) / 100,
        invoice: linkedInvoices.find((i) => i.id === p.invoiceId) ?? null,
        entries: own,
      }
    }),
  }
}

async function assertSubscriptionLine(db: DbOrTx, clientId: number, lineId: number | null) {
  if (lineId === null) return
  const [row] = await db
    .select({ clientId: subscriptions.clientId })
    .from(subscriptionLines)
    .innerJoin(subscriptions, eq(subscriptions.id, subscriptionLines.subscriptionId))
    .where(eq(subscriptionLines.id, lineId))
  if (!row) throw badRequest('Ligne d’abonnement introuvable')
  if (row.clientId !== clientId) throw badRequest('La ligne d’abonnement appartient à un autre client')
}

export async function createContract(tx: DbOrTx, actor: Actor, input: ContractInput): Promise<ContractRow> {
  const [client] = await tx.select({ id: clients.id }).from(clients).where(eq(clients.id, input.clientId))
  if (!client) throw badRequest('Client introuvable')
  await assertSubscriptionLine(tx, input.clientId, input.subscriptionLineId)
  const [res] = await tx
    .insert(maintenanceContracts)
    .values({
      clientId: input.clientId,
      name: input.name,
      hoursPerPeriod: input.hoursPerPeriod,
      startDate: input.startDate,
      subscriptionLineId: input.subscriptionLineId,
      notes: input.notes,
    })
    .$returningId()
  if (!res) throw new Error('Insertion contrat échouée')
  await tx.insert(maintenancePeriods).values({
    contractId: res.id,
    startDate: input.startDate,
    endDate: addDays(addPeriod(input.startDate, 'YEARLY'), -1),
    hoursQuota: input.hoursPerPeriod,
  })
  await audit(tx, actor, 'create', 'contract', res.id, { name: input.name })
  return getContract(tx, res.id)
}

export async function updateContract(tx: DbOrTx, actor: Actor, id: number, input: ContractInput): Promise<ContractRow> {
  const contract = await getContract(tx, id)
  if (input.clientId !== contract.clientId) throw badRequest('Le client d’un contrat ne peut pas être changé')
  await assertSubscriptionLine(tx, contract.clientId, input.subscriptionLineId)
  await tx
    .update(maintenanceContracts)
    .set({ name: input.name, hoursPerPeriod: input.hoursPerPeriod, subscriptionLineId: input.subscriptionLineId, notes: input.notes })
    .where(eq(maintenanceContracts.id, id))
  await audit(tx, actor, 'update', 'contract', id, input)
  return getContract(tx, id)
}

export async function endContract(tx: DbOrTx, actor: Actor, id: number, endDate: string, today: string = todayIso()): Promise<ContractRow> {
  const contract = await getContract(tx, id)
  if (endDate < contract.startDate) throw badRequest('La date de fin précède le début du contrat')
  await tx
    .update(maintenanceContracts)
    .set({ endDate, status: endDate <= today ? 'ENDED' : 'ACTIVE' })
    .where(eq(maintenanceContracts.id, id))
  // Les périodes qui dépassent la fin sont raccourcies
  await tx
    .update(maintenancePeriods)
    .set({ endDate })
    .where(and(eq(maintenancePeriods.contractId, id), gte(maintenancePeriods.endDate, endDate), lte(maintenancePeriods.startDate, endDate)))
  await audit(tx, actor, 'end', 'contract', id, { endDate })
  return getContract(tx, id)
}

export async function reactivateContract(tx: DbOrTx, actor: Actor, id: number): Promise<ContractRow> {
  await getContract(tx, id)
  await tx.update(maintenanceContracts).set({ endDate: null, status: 'ACTIVE' }).where(eq(maintenanceContracts.id, id))
  await audit(tx, actor, 'reactivate', 'contract', id)
  return getContract(tx, id)
}

export async function addPeriodToContract(
  tx: DbOrTx,
  actor: Actor,
  contractId: number,
  input: { startDate: string; endDate: string; hoursQuota: number },
): Promise<PeriodRow> {
  await getContract(tx, contractId)
  if (input.endDate < input.startDate) throw badRequest('La fin de période précède son début')
  const overlapping = await tx
    .select({ id: maintenancePeriods.id })
    .from(maintenancePeriods)
    .where(and(eq(maintenancePeriods.contractId, contractId), lte(maintenancePeriods.startDate, input.endDate), gte(maintenancePeriods.endDate, input.startDate)))
  if (overlapping.length > 0) throw conflict('Cette période chevauche une période existante')
  const [res] = await tx.insert(maintenancePeriods).values({ contractId, ...input }).$returningId()
  if (!res) throw new Error('Insertion période échouée')
  await audit(tx, actor, 'add_period', 'contract', contractId, input)
  const [row] = await tx.select().from(maintenancePeriods).where(eq(maintenancePeriods.id, res.id))
  return row!
}

async function findPeriodForDate(db: DbOrTx, contractId: number, date: string): Promise<PeriodRow> {
  const [period] = await db
    .select()
    .from(maintenancePeriods)
    .where(and(eq(maintenancePeriods.contractId, contractId), lte(maintenancePeriods.startDate, date), gte(maintenancePeriods.endDate, date)))
    .limit(1)
  if (!period) throw badRequest('Aucune période du contrat ne couvre cette date : ajoutez d’abord une période')
  return period
}

export async function addTimeEntry(
  tx: DbOrTx,
  actor: Actor,
  contractId: number,
  input: { date: string; hours: number; description: string },
) {
  const period = await findPeriodForDate(tx, contractId, input.date)
  const [res] = await tx
    .insert(timeEntries)
    .values({ periodId: period.id, date: input.date, hours: input.hours, description: input.description, userId: actor.userId })
    .$returningId()
  await audit(tx, actor, 'add_hours', 'contract', contractId, { hours: input.hours, date: input.date })
  return res
}

async function getEntryOfContract(db: DbOrTx, contractId: number, entryId: number) {
  const [row] = await db
    .select({ entry: timeEntries })
    .from(timeEntries)
    .innerJoin(maintenancePeriods, eq(maintenancePeriods.id, timeEntries.periodId))
    .where(and(eq(timeEntries.id, entryId), eq(maintenancePeriods.contractId, contractId)))
  if (!row) throw notFound('Saisie introuvable')
  return row.entry
}

export async function updateTimeEntry(
  tx: DbOrTx,
  actor: Actor,
  contractId: number,
  entryId: number,
  input: { date: string; hours: number; description: string },
) {
  await getEntryOfContract(tx, contractId, entryId)
  const period = await findPeriodForDate(tx, contractId, input.date)
  await tx
    .update(timeEntries)
    .set({ periodId: period.id, date: input.date, hours: input.hours, description: input.description })
    .where(eq(timeEntries.id, entryId))
  await audit(tx, actor, 'update_hours', 'contract', contractId, { entryId, ...input })
}

export async function deleteTimeEntry(tx: DbOrTx, actor: Actor, contractId: number, entryId: number) {
  const entry = await getEntryOfContract(tx, contractId, entryId)
  await tx.delete(timeEntries).where(eq(timeEntries.id, entryId))
  await audit(tx, actor, 'delete_hours', 'contract', contractId, { entryId, hours: entry.hours, date: entry.date })
}

export async function setContractFile(tx: DbOrTx, actor: Actor, id: number, fileName: string | null, originalName: string | null): Promise<string | null> {
  const contract = await getContract(tx, id)
  await tx.update(maintenanceContracts).set({ fileName, fileOriginalName: originalName }).where(eq(maintenanceContracts.id, id))
  await audit(tx, actor, fileName ? 'upload_file' : 'remove_file', 'contract', id, { originalName })
  return contract.fileName
}

/** Contrats à surveiller : période qui se termine bientôt ou quota presque épuisé. */
export async function contractAlerts(db: DbOrTx, today: string = todayIso()) {
  const contracts = await listContracts(db, today)
  return contracts
    .filter((c) => c.status === 'ACTIVE' && c.currentPeriod)
    .filter((c) => {
      const p = c.currentPeriod!
      return p.daysLeft <= 30 || p.remainingHours <= p.hoursQuota * 0.2
    })
}
