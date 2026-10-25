/**
 * Migration des données de l'ancienne application (MPortal v1) vers la V2.
 *
 * Usage :
 *   LEGACY_DATABASE_URL=mysql://… NUXT_DATABASE_URL=mysql://… npm run legacy:migrate -- --dry-run
 *   … npm run legacy:migrate                (import réel, base cible vide)
 *   … npm run legacy:migrate -- --reset     (vide d'abord les données métier de la base cible)
 *
 * Tout l'import se fait dans UNE transaction : si un contrôle échoue, rien n'est écrit.
 * En --dry-run, la transaction est annulée à la fin même si tout est correct.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import mysql from 'mysql2/promise'
import { sql } from 'drizzle-orm'
import type { Tx } from '../server/db/client'
import * as s from '../server/db/schema'
import { guessExpenseCategory } from '../server/domain/expense-category'
import { addDays, addPeriod } from '../shared/utils/dates'
import { isValidQrReference } from '../shared/utils/qr-reference'
import { openTargetDb, requireEnv } from './lib'

// ---------------------------------------------------------------------------
// Types de l'ancienne base
// ---------------------------------------------------------------------------

interface LegacyUser { id: number; created_at: string; lastname: string; firstname: string; email: string; password: string; last_connexion_at: string | null }
interface LegacyClient {
  id: number; created_at: string; updated_at: string; name: string; lastname: string; firstname: string; email: string | null
  address: string | null; addressNumber: number | null; postalCode: number | null; city: string | null; phone_umber: string | null; remark: string | null; archived: number
}
interface LegacyService { id: number; created_at: string; updated_at: string; name: string; description: string; type: string; archived: number }
interface LegacyInvoice {
  id: number; created_at: string; updated_at: string; name: string; reference: string; number: number; state: string
  due_at: string | null; archived: number; client_id: number
}
interface LegacyInvoiceLine { id: number; quantity: number; amount: number; archived: number; invoice_id: number; service_id: number }
interface LegacyLog { id: number; created_at: string; code: string; details: string | null; invoice_id: number; client_id: number }
interface LegacyContract { id: number; created_at: string; name: string; total_hours: number; remaining_hours: number; price: number; path: string | null; start_at: string; end_at: string; client_id: number }
interface LegacyHour { id: number; created_at: string; description: string; hours: number; date: string; contract_id: number }
interface LegacyContractInvoice { contract_id: number; invoice_id: number }
interface LegacyHistory { id: number; table_name: string; table_id: number; create_at: string; type: string; user_id: number | null; value: string | null; changes: string | null }

interface Overrides {
  mdevClientId: number
  subscriptions: {
    endedClients: Record<string, { endDate: string; reason: string }>
    endDates: Record<string, { endDate: string; reason: string }>
    replace: Record<string, {
      name: string; nextBillingDate: string; startDate: string; notes: string
      lines: Array<{ serviceName: string; label: string; quantity: number; unitPriceCents: number; unitCostCents: number | null }>
    }>
    excludeInvoiceIdsFromInference: number[]
    anchorServiceName: string
  }
  contracts: { endDates: Record<string, { endDate: string; reason: string }> }
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const args = new Set(process.argv.slice(2))
const DRY_RUN = args.has('--dry-run')
const RESET = args.has('--reset')

const cents = (value: number) => Math.round(value * 100)

/** L'ancienne base enregistrait created_at à l'heure suisse (DEFAULT CURRENT_TIMESTAMP) : conversion en UTC. */
function zurichLocalToUtc(local: string): Date {
  const [date, time = '00:00:00'] = local.split(' ')
  const asUtc = new Date(`${date}T${time}Z`)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Zurich', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(asUtc)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const zurichAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return new Date(asUtc.getTime() - (zurichAsUtc - asUtc.getTime()))
}
/** updated_at / due_at étaient écrits par Node en UTC. */
const utc = (value: string) => new Date(`${value.replace(' ', 'T')}Z`)
const dateOnly = (value: string) => value.slice(0, 10)

const anomalies: string[] = []
const report: string[] = []
function fail(message: string): never {
  throw new Error(`CONTRÔLE ÉCHOUÉ : ${message}`)
}

async function rows<T>(conn: mysql.Pool, query: string): Promise<T[]> {
  const [result] = await conn.query(query)
  return result as T[]
}

// ---------------------------------------------------------------------------
// Lecture de l'ancienne base
// ---------------------------------------------------------------------------

const legacy = mysql.createPool({ uri: requireEnv('LEGACY_DATABASE_URL'), dateStrings: true, connectionLimit: 2 })
const overrides = JSON.parse(readFileSync(resolve(import.meta.dirname, 'legacy-overrides.json'), 'utf8')) as Overrides
const MDEV = overrides.mdevClientId

const L = {
  users: await rows<LegacyUser>(legacy, 'SELECT * FROM `user` ORDER BY id'),
  clients: await rows<LegacyClient>(legacy, 'SELECT * FROM client ORDER BY id'),
  services: await rows<LegacyService>(legacy, 'SELECT * FROM service ORDER BY id'),
  invoices: await rows<LegacyInvoice>(legacy, 'SELECT * FROM invoice ORDER BY id'),
  lines: await rows<LegacyInvoiceLine>(legacy, 'SELECT * FROM invoice_service ORDER BY id'),
  logs: await rows<LegacyLog>(legacy, 'SELECT * FROM invoice_log ORDER BY created_at, id'),
  contracts: await rows<LegacyContract>(legacy, 'SELECT * FROM maintenance_contract ORDER BY start_at'),
  hours: await rows<LegacyHour>(legacy, 'SELECT * FROM contract_hour ORDER BY date, id'),
  contractInvoices: await rows<LegacyContractInvoice>(legacy, 'SELECT contract_id, invoice_id FROM contract_invoice'),
  history: await rows<LegacyHistory>(legacy, 'SELECT * FROM history ORDER BY id'),
  invoiceNumber: (await rows<{ value: string }>(legacy, "SELECT value FROM setting WHERE `key` = 'INVOICE_NUMBER'"))[0]?.value,
}
await legacy.end()

const serviceById = new Map(L.services.map((x) => [x.id, x]))
const clientById = new Map(L.clients.map((x) => [x.id, x]))
const linesByInvoice = new Map<number, LegacyInvoiceLine[]>()
for (const line of L.lines) {
  if (line.archived) continue
  const list = linesByInvoice.get(line.invoice_id) ?? []
  list.push(line)
  linesByInvoice.set(line.invoice_id, list)
}
const logsByInvoice = new Map<number, LegacyLog[]>()
for (const log of L.logs) {
  const list = logsByInvoice.get(log.invoice_id) ?? []
  list.push(log)
  logsByInvoice.set(log.invoice_id, list)
}
const invoiceTotal = (id: number) => (linesByInvoice.get(id) ?? []).reduce((sum, l) => sum + Math.round(l.quantity * cents(l.amount)), 0)
const isRecurring = (serviceId: number) => serviceById.get(serviceId)?.type !== 'UNIQUE'
const isMaintenanceService = (serviceId: number) => /maintenance/i.test(serviceById.get(serviceId)?.name ?? '')

const clientInvoices = L.invoices.filter((i) => i.client_id !== MDEV)
const mdevInvoices = L.invoices.filter((i) => i.client_id === MDEV && !i.archived)

// Facture MDev « miroir » d'une facture client : même nom, créée dans les 2 minutes
const mirrorOf = new Map<number, LegacyInvoice>()
for (const m of mdevInvoices) {
  const mTime = zurichLocalToUtc(m.created_at).getTime()
  const match = clientInvoices
    .filter((c) => !c.archived && c.name === m.name && Math.abs(zurichLocalToUtc(c.created_at).getTime() - mTime) <= 120_000)
    .sort((a, b) => Math.abs(zurichLocalToUtc(a.created_at).getTime() - mTime) - Math.abs(zurichLocalToUtc(b.created_at).getTime() - mTime))[0]
  if (match) {
    mirrorOf.set(m.id, match)
    continue
  }
  // Sinon : facture client créée dans les 2 minutes (nom différent, ex. « mdev site … »),
  // puis facture d'un client dont le nom figure dans le titre, à 30 jours au plus
  const byTime = clientInvoices
    .filter((c) => !c.archived && !mirrorByIdUsed(c.id) && Math.abs(zurichLocalToUtc(c.created_at).getTime() - mTime) <= 120_000)
    .sort((a, b) => Math.abs(zurichLocalToUtc(a.created_at).getTime() - mTime) - Math.abs(zurichLocalToUtc(b.created_at).getTime() - mTime))[0]
  const named = clientInvoices
    .filter((c) => !c.archived && !mirrorByIdUsed(c.id))
    .filter((c) => {
      const clientName = clientById.get(c.client_id)?.name.toLowerCase() ?? ''
      return clientName.length > 3 && m.name.toLowerCase().includes(clientName) && Math.abs(zurichLocalToUtc(c.created_at).getTime() - mTime) <= 30 * 86_400_000
    })
    .sort((a, b) => Math.abs(zurichLocalToUtc(a.created_at).getTime() - mTime) - Math.abs(zurichLocalToUtc(b.created_at).getTime() - mTime))[0]
  const fallback = byTime ?? named
  if (fallback) mirrorOf.set(m.id, fallback)
}

function mirrorByIdUsed(clientInvoiceId: number): boolean {
  for (const c of mirrorOf.values()) if (c.id === clientInvoiceId) return true
  return false
}
const mirrorByClientInvoice = new Map([...mirrorOf.entries()].map(([mdevId, c]) => [c.id, L.invoices.find((i) => i.id === mdevId)!]))

/** Coût unitaire d'une ligne client : ligne du même service sur la facture MDev miroir. */
function unitCostFor(clientInvoiceId: number, serviceId: number): number | null {
  const mirror = mirrorByClientInvoice.get(clientInvoiceId)
  if (!mirror) return null
  const line = (linesByInvoice.get(mirror.id) ?? []).find((l) => l.service_id === serviceId)
  return line ? cents(line.amount) : null
}

function authorId(details: string | null): number | null {
  const name = /by (\S+)\s*$/.exec(details ?? '')?.[1]
  return L.users.find((u) => u.firstname === name)?.id ?? null
}

const EVENT_LABELS: Record<string, string> = {
  CREATED: 'Facture créée',
  UPDATED: 'Facture modifiée',
  GENERATED: 'PDF généré',
  SENT: 'Statut : envoyée',
  PAID: 'Statut : payée',
  UNPAID: 'Statut : impayée',
  CANCELLED: 'Statut : annulée',
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

const { db, pool } = await openTargetDb()

const BUSINESS_TABLES = [
  'time_entries', 'maintenance_periods', 'maintenance_contracts', 'payments', 'expenses', 'bank_transactions', 'bank_imports',
  'invoice_events', 'invoice_lines', 'invoices', 'subscription_lines', 'subscriptions', 'services', 'clients', 'audit_logs',
  'legacy_history', 'login_attempts', 'users',
]

class DryRunRollback extends Error {}

try {
  await db.transaction(async (tx: Tx) => {
    const [existing] = await tx.select({ n: sql<number>`COUNT(*)` }).from(s.invoices)
    if (Number(existing?.n ?? 0) > 0 && !RESET) fail('la base cible contient déjà des factures (utilisez --reset pour la vider)')
    if (RESET) {
      await tx.execute(sql`SET FOREIGN_KEY_CHECKS = 0`)
      for (const table of BUSINESS_TABLES) await tx.execute(sql.raw(`DELETE FROM \`${table}\``))
      await tx.execute(sql`SET FOREIGN_KEY_CHECKS = 1`)
      report.push('Base cible vidée (--reset)')
    }

    // Utilisateurs (hash bcrypt conservés : les mots de passe restent valables)
    for (const u of L.users) {
      await tx.insert(s.users).values({
        id: u.id,
        email: u.email.trim().toLowerCase(),
        passwordHash: u.password,
        firstname: u.firstname,
        lastname: u.lastname,
        lastLoginAt: u.last_connexion_at ? utc(u.last_connexion_at) : null,
        createdAt: zurichLocalToUtc(u.created_at),
      })
    }

    // Clients (sauf MDevelopment, dont les « factures » deviennent des dépenses)
    for (const c of L.clients) {
      if (c.id === MDEV) continue
      await tx.insert(s.clients).values({
        id: c.id,
        name: c.name.trim(),
        firstname: c.firstname?.trim() || null,
        lastname: c.lastname?.trim() || null,
        email: c.email?.trim() || null,
        phone: c.phone_umber?.trim() || null,
        street: c.address?.trim() || null,
        streetNumber: c.addressNumber !== null ? String(c.addressNumber) : null,
        postalCode: c.postalCode !== null ? String(c.postalCode) : null,
        city: c.city?.trim() || null,
        country: 'CH',
        remark: c.remark?.trim() || null,
        archivedAt: c.archived ? utc(c.updated_at) : null,
        createdAt: zurichLocalToUtc(c.created_at),
        updatedAt: utc(c.updated_at),
      })
    }

    // Services
    for (const sv of L.services) {
      await tx.insert(s.services).values({
        id: sv.id,
        name: sv.name,
        description: sv.description || null,
        kind: sv.type === 'UNIQUE' ? 'ONE_SHOT' : 'RECURRING',
        isMaintenance: /maintenance/i.test(sv.name),
        archivedAt: sv.archived ? utc(sv.updated_at) : null,
        createdAt: zurichLocalToUtc(sv.created_at),
        updatedAt: utc(sv.updated_at),
      })
    }

    // Factures clients
    let paymentsCreated = 0
    for (const inv of clientInvoices) {
      const logs = logsByInvoice.get(inv.id) ?? []
      const generated = logs.find((l) => l.code === 'GENERATED')
      const paidLog = [...logs].reverse().find((l) => l.code === 'PAID')
      const sentLog = logs.find((l) => l.code === 'SENT')
      const total = invoiceTotal(inv.id)
      const wasIssued = !['CREATED', 'UPDATED'].includes(inv.state) || Boolean(generated)
      const issueDate = wasIssued ? dateOnly(generated?.created_at ?? inv.created_at) : null
      const dueDate = inv.due_at ? dateOnly(inv.due_at) : issueDate ? addDays(issueDate, 30) : null

      let status: (typeof s.invoiceStatuses)[number]
      if (inv.archived || inv.state === 'CANCELLED') status = 'CANCELLED'
      else if (!wasIssued) status = 'DRAFT'
      else if (inv.state === 'GENERATED' && !sentLog) status = 'ISSUED'
      else status = 'SENT'
      const paid = !inv.archived && inv.state === 'PAID'
      if (paid && status === 'ISSUED') status = 'SENT'

      if (!isValidQrReference(inv.reference)) anomalies.push(`Facture ${inv.number} : référence QR invalide (${inv.reference}), conservée telle quelle`)

      await tx.insert(s.invoices).values({
        id: inv.id,
        number: Number(inv.number),
        qrReference: inv.reference,
        clientId: inv.client_id,
        title: inv.name,
        status,
        issueDate,
        dueDate,
        totalCents: total,
        paidCents: paid ? total : 0,
        sentAt: sentLog ? zurichLocalToUtc(sentLog.created_at) : null,
        cancelledAt: status === 'CANCELLED' ? utc(inv.updated_at) : null,
        notes: inv.archived ? 'Supprimée dans l’ancienne application' : null,
        createdAt: zurichLocalToUtc(inv.created_at),
        updatedAt: utc(inv.updated_at),
      })

      const lines = linesByInvoice.get(inv.id) ?? []
      for (const [position, line] of lines.entries()) {
        await tx.insert(s.invoiceLines).values({
          invoiceId: inv.id,
          serviceId: line.service_id,
          label: serviceById.get(line.service_id)?.name ?? 'Prestation',
          quantity: Number(line.quantity),
          unitPriceCents: cents(line.amount),
          unitCostCents: unitCostFor(inv.id, line.service_id),
          position,
        })
      }

      for (const log of logs) {
        await tx.insert(s.invoiceEvents).values({
          invoiceId: inv.id,
          type: log.code,
          message: `${EVENT_LABELS[log.code] ?? log.code} (ancienne application)`,
          userId: authorId(log.details),
          createdAt: zurichLocalToUtc(log.created_at),
        })
      }
      await tx.insert(s.invoiceEvents).values({
        invoiceId: inv.id,
        type: 'MIGRATED',
        message: 'Importée depuis l’ancienne application',
        createdAt: new Date(),
      })

      if (paid && total > 0) {
        await tx.insert(s.payments).values({
          invoiceId: inv.id,
          amountCents: total,
          paidAt: dateOnly(paidLog?.created_at ?? inv.updated_at),
          note: 'Paiement repris de l’ancienne application',
          createdAt: new Date(),
        })
        paymentsCreated++
      }
    }
    report.push(`${clientInvoices.length} factures importées, ${paymentsCreated} paiements repris`)

    // Factures « MDev » → dépenses
    let expenseCount = 0
    for (const m of mdevInvoices) {
      const linked = mirrorOf.get(m.id)
      for (const line of linesByInvoice.get(m.id) ?? []) {
        const serviceName = serviceById.get(line.service_id)?.name ?? 'Dépense'
        const clientName = linked ? clientById.get(linked.client_id)?.name : null
        await tx.insert(s.expenses).values({
          date: dateOnly(m.created_at),
          amountCents: Math.round(line.quantity * cents(line.amount)),
          supplier: 'Infomaniak',
          category: guessExpenseCategory(serviceName),
          label: `${serviceName} – ${clientName ?? m.name}`.slice(0, 255),
          clientId: linked ? linked.client_id : null,
          invoiceId: linked ? linked.id : null,
          notes: `Reprise de la facture MDev ${m.number} (« ${m.name} »)`,
          createdAt: zurichLocalToUtc(m.created_at),
        })
        expenseCount++
      }
      if (!linked) anomalies.push(`Dépense MDev ${m.number} « ${m.name} » : aucune facture client correspondante, importée sans lien`)
    }
    report.push(`${mdevInvoices.length} factures MDev converties en ${expenseCount} dépenses (${mirrorOf.size} liées à une facture client)`)

    // ---------------------------------------------------------------- Abonnements (déduits)
    const lineIdByClientService = new Map<string, number>()
    const subscriptionsCreated: string[] = []
    for (const client of L.clients) {
      if (client.id === MDEV) continue
      const key = String(client.id)
      const replace = overrides.subscriptions.replace[key]
      let name: string
      let startDate: string
      let nextBillingDate: string
      let notes: string | null = null
      let lines: Array<{ serviceId: number; label: string | null; quantity: number; unitPriceCents: number; unitCostCents: number | null }>

      if (replace) {
        name = replace.name
        startDate = replace.startDate
        nextBillingDate = replace.nextBillingDate
        notes = replace.notes
        lines = replace.lines.map((l) => {
          const service = L.services.find((sv) => sv.name === l.serviceName)
          if (!service) fail(`service « ${l.serviceName} » introuvable pour l’abonnement du client ${client.id}`)
          return { serviceId: service.id, label: l.label, quantity: l.quantity, unitPriceCents: l.unitPriceCents, unitCostCents: l.unitCostCents }
        })
      } else {
        const candidates = clientInvoices
          .filter((i) => i.client_id === client.id && !i.archived && i.state !== 'CANCELLED')
          .filter((i) => !overrides.subscriptions.excludeInvoiceIdsFromInference.includes(i.id))
          .filter((i) => (linesByInvoice.get(i.id) ?? []).some((l) => isRecurring(l.service_id)))
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
        if (candidates.length === 0) continue
        // Facture de référence : la dernière qui contient l'élément « pivot » du forfait annuel (nom de domaine)
        const anchor = L.services.find((sv) => sv.name === overrides.subscriptions.anchorServiceName)?.id
        const reference =
          [...candidates].reverse().find((i) => (linesByInvoice.get(i.id) ?? []).some((l) => l.service_id === anchor)) ?? candidates.at(-1)!
        const refDate = dateOnly(reference.created_at)
        startDate = dateOnly(candidates[0]!.created_at)
        nextBillingDate = addPeriod(refDate, 'YEARLY')
        lines = (linesByInvoice.get(reference.id) ?? [])
          .filter((l) => isRecurring(l.service_id))
          .map((l) => ({
            serviceId: l.service_id,
            label: null,
            quantity: Number(l.quantity),
            unitPriceCents: cents(l.amount),
            unitCostCents: unitCostFor(reference.id, l.service_id),
          }))
        const serviceNames = [...new Set(lines.map((l) => serviceById.get(l.serviceId)?.name ?? ''))]
        name = serviceNames.join(' + ').slice(0, 190)
        notes = `Déduit de la facture ${reference.number} du ${refDate.split('-').reverse().join('.')} (migration).`
        const ignored = candidates.filter((c) => c.created_at > reference.created_at)
        for (const other of ignored) anomalies.push(`Client ${client.name} : facture récurrente ${other.number} « ${other.name} » non reprise dans l’abonnement (ponctuelle ?)`)
      }

      const ended = overrides.subscriptions.endedClients[key]
      const endInfo = ended ?? overrides.subscriptions.endDates[key]
      const status = ended ? 'ENDED' : 'ACTIVE'
      const [res] = await tx
        .insert(s.subscriptions)
        .values({
          clientId: client.id,
          name,
          period: 'YEARLY',
          startDate,
          nextBillingDate,
          endDate: endInfo?.endDate ?? null,
          status,
          notes: [notes, endInfo ? `Fin : ${endInfo.reason}.` : null].filter(Boolean).join(' ') || null,
        })
        .$returningId()
      for (const [position, line] of lines.entries()) {
        const [lineRes] = await tx
          .insert(s.subscriptionLines)
          .values({ subscriptionId: res!.id, ...line, supplier: line.unitCostCents ? 'Infomaniak' : null, position })
          .$returningId()
        lineIdByClientService.set(`${client.id}:${line.serviceId}`, lineRes!.id)
      }
      subscriptionsCreated.push(`${client.name} : ${name} → ${status === 'ENDED' ? 'terminé' : `prochaine facture le ${nextBillingDate}`}${endInfo ? ` (fin ${endInfo.endDate})` : ''}`)
    }
    report.push(`${subscriptionsCreated.length} abonnements créés :`, ...subscriptionsCreated.map((x) => `   - ${x}`))

    // ---------------------------------------------------------------- Contrats de maintenance
    const contractsByClient = new Map<number, LegacyContract[]>()
    for (const c of L.contracts) contractsByClient.set(c.client_id, [...(contractsByClient.get(c.client_id) ?? []), c])
    let entriesCount = 0
    for (const [clientId, list] of contractsByClient) {
      const latest = list.at(-1)!
      const endInfo = overrides.contracts.endDates[String(clientId)]
      const maintenanceService = L.services.find((sv) => isMaintenanceService(sv.id))
      const [res] = await tx
        .insert(s.maintenanceContracts)
        .values({
          clientId,
          subscriptionLineId: maintenanceService ? (lineIdByClientService.get(`${clientId}:${maintenanceService.id}`) ?? null) : null,
          name: latest.name,
          hoursPerPeriod: latest.total_hours,
          startDate: dateOnly(list[0]!.start_at),
          endDate: endInfo?.endDate ?? null,
          status: 'ACTIVE',
          notes: [
            latest.path ? `Ancien chemin du fichier : ${latest.path}` : null,
            endInfo ? `Fin : ${endInfo.reason}.` : null,
          ]
            .filter(Boolean)
            .join('\n') || null,
        })
        .$returningId()
      const contractId = res!.id

      let lastEnd = ''
      for (const legacyContract of list) {
        const start = dateOnly(legacyContract.start_at)
        const end = addDays(dateOnly(legacyContract.end_at), -1)
        const invoiceId = L.contractInvoices.find((ci) => ci.contract_id === legacyContract.id)?.invoice_id ?? null
        const [period] = await tx
          .insert(s.maintenancePeriods)
          .values({ contractId, startDate: start, endDate: end, hoursQuota: legacyContract.total_hours, invoiceId })
          .$returningId()
        const hours = L.hours.filter((h) => h.contract_id === legacyContract.id)
        for (const h of hours) {
          await tx.insert(s.timeEntries).values({
            periodId: period!.id,
            date: dateOnly(h.date),
            hours: Number(h.hours),
            description: h.description,
            createdAt: zurichLocalToUtc(h.created_at),
          })
          entriesCount++
        }
        const used = hours.reduce((sum, h) => sum + Number(h.hours), 0)
        const computed = legacyContract.total_hours - used
        if (Math.abs(computed - legacyContract.remaining_hours) > 0.001) {
          anomalies.push(
            `Contrat « ${legacyContract.name} » (${start}) : heures restantes stockées ${legacyContract.remaining_hours} h ≠ calculées ${computed} h (la V2 utilise le calcul)`,
          )
        }
        lastEnd = end
      }

      // Période facturée après le dernier contrat (renouvellement inclus dans une facture groupée)
      const later = clientInvoices
        .filter((i) => i.client_id === clientId && !i.archived && dateOnly(i.created_at) > lastEnd)
        .find((i) => (linesByInvoice.get(i.id) ?? []).some((l) => isMaintenanceService(l.service_id)))
      if (later && lastEnd) {
        const start = addDays(lastEnd, 1)
        let end = addDays(addPeriod(start, 'YEARLY'), -1)
        if (endInfo && endInfo.endDate < end) end = endInfo.endDate
        await tx.insert(s.maintenancePeriods).values({ contractId, startDate: start, endDate: end, hoursQuota: latest.total_hours, invoiceId: later.id })
        report.push(`Contrat ${latest.name} : période ${start} → ${end} ajoutée (facture ${later.number})`)
      }
    }
    report.push(`${contractsByClient.size} contrat(s) de maintenance, ${entriesCount} saisies d’heures`)

    // ---------------------------------------------------------------- Réglages & archive
    if (!L.invoiceNumber) fail('réglage INVOICE_NUMBER absent de l’ancienne base')
    const maxNumber = Math.max(...L.invoices.map((i) => Number(i.number)))
    const nextBase = Math.max(Number(L.invoiceNumber), maxNumber)
    await tx
      .insert(s.settings)
      .values({ key: 'INVOICE_NUMBER', value: String(nextBase) })
      .onDuplicateKeyUpdate({ set: { value: String(nextBase) } })
    report.push(`Numérotation : dernier numéro ${nextBase}, prochaine facture ${nextBase + 1}`)

    for (const h of L.history) {
      await tx.insert(s.legacyHistory).values({
        id: h.id,
        tableName: h.table_name,
        tableId: h.table_id,
        type: h.type,
        userId: h.user_id,
        value: h.value,
        changes: h.changes,
        createdAt: zurichLocalToUtc(h.create_at),
      })
    }
    await tx.insert(s.auditLogs).values({
      action: 'legacy_migration',
      entity: 'system',
      changes: { invoices: clientInvoices.length, expenses: expenseCount, anomalies: anomalies.length },
    })

    // ---------------------------------------------------------------- Contrôles
    const one = async <T>(query: ReturnType<typeof sql>): Promise<T> => {
      const [result] = (await tx.execute(query)) as unknown as [T[]]
      return result[0]!
    }
    const nClients = await one<{ n: number }>(sql`SELECT COUNT(*) AS n FROM clients`)
    if (Number(nClients.n) !== L.clients.filter((c) => c.id !== MDEV).length) fail('nombre de clients différent')
    const nInvoices = await one<{ n: number }>(sql`SELECT COUNT(*) AS n FROM invoices`)
    if (Number(nInvoices.n) !== clientInvoices.length) fail('nombre de factures différent')
    const nLines = await one<{ n: number }>(sql`SELECT COUNT(*) AS n FROM invoice_lines`)
    const legacyLines = clientInvoices.reduce((n, i) => n + (linesByInvoice.get(i.id)?.length ?? 0), 0)
    if (Number(nLines.n) !== legacyLines) fail(`nombre de lignes différent (${nLines.n} ≠ ${legacyLines})`)

    // CA net par année : ancien calcul (factures clients − factures MDev, par année de création) = nouveau (factures − dépenses)
    const legacyByYear = new Map<string, { invoiced: number; costs: number }>()
    for (const inv of L.invoices) {
      if (inv.archived) continue
      const year = inv.created_at.slice(0, 4)
      const entry = legacyByYear.get(year) ?? { invoiced: 0, costs: 0 }
      if (inv.client_id === MDEV) entry.costs += invoiceTotal(inv.id)
      else entry.invoiced += invoiceTotal(inv.id)
      legacyByYear.set(year, entry)
    }
    for (const [year, legacyTotals] of legacyByYear) {
      const inv = await one<{ total: string | null }>(
        sql`SELECT SUM(total_cents) AS total FROM invoices WHERE status <> 'CANCELLED' AND YEAR(COALESCE(issue_date, created_at)) = ${Number(year)}`,
      )
      const invByCreation = await one<{ total: string | null }>(
        sql`SELECT SUM(i.total_cents) AS total FROM invoices i WHERE i.id IN (${sql.raw(
          clientInvoices
            .filter((c) => !c.archived && c.created_at.startsWith(year))
            .map((c) => c.id)
            .join(',') || '0',
        )})`,
      )
      const exp = await one<{ total: string | null }>(sql`SELECT SUM(amount_cents) AS total FROM expenses WHERE YEAR(date) = ${Number(year)}`)
      const newInvoiced = Number(invByCreation.total ?? 0)
      const newCosts = Number(exp.total ?? 0)
      if (newInvoiced !== legacyTotals.invoiced) fail(`facturé ${year} : ${newInvoiced} ≠ ${legacyTotals.invoiced}`)
      if (newCosts !== legacyTotals.costs) fail(`dépenses ${year} : ${newCosts} ≠ ${legacyTotals.costs}`)
      report.push(
        `Contrôle ${year} : facturé ${(newInvoiced / 100).toFixed(2)} CHF, coûts ${(newCosts / 100).toFixed(2)} CHF, net ${((newInvoiced - newCosts) / 100).toFixed(2)} CHF — identique à l’ancienne app ✔ (par date d’émission : ${(Number(inv.total ?? 0) / 100).toFixed(2)} CHF)`,
      )
    }

    const hoursLegacy = L.hours.reduce((sum, h) => sum + Number(h.hours), 0)
    const hoursNew = await one<{ total: string | null }>(sql`SELECT SUM(hours) AS total FROM time_entries`)
    if (Math.abs(Number(hoursNew.total ?? 0) - hoursLegacy) > 0.001) fail('total des heures différent')
    const dupRefs = await one<{ n: number }>(sql`SELECT COUNT(*) - COUNT(DISTINCT qr_reference) AS n FROM invoices`)
    if (Number(dupRefs.n) !== 0) fail('références QR en double')
    report.push('Contrôles : comptes, totaux par année, heures, unicité des références ✔')

    if (DRY_RUN) throw new DryRunRollback()
  })
  console.log(['', '=== Migration terminée ===', ...report].join('\n'))
} catch (error) {
  if (error instanceof DryRunRollback) {
    console.log(['', '=== DRY RUN : tout est correct, aucune donnée écrite ===', ...report].join('\n'))
  } else {
    console.error('\n=== Migration annulée, aucune donnée écrite ===')
    // On n'affiche jamais les paramètres SQL (ils peuvent contenir des hash de mots de passe)
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : null
    const message = error instanceof Error ? error.message.split('\nparams:')[0] : String(error)
    console.error(cause ? `${message}\nCause : ${cause}` : message)
    process.exitCode = 1
  }
} finally {
  if (anomalies.length) console.log(['', `--- ${anomalies.length} point(s) à vérifier ---`, ...anomalies.map((a) => ` • ${a}`)].join('\n'))
  await pool.end()
}
