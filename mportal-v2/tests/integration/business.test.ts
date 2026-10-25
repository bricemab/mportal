import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../../server/db/client'
import { expenses, invoices, maintenancePeriods, payments, settings, subscriptions } from '../../server/db/schema'
import type { Actor } from '../../server/domain/audit'
import { authenticate, changePassword, getSessionVersion } from '../../server/domain/auth'
import { autoMatchTransaction, importStatement, listTransactions, matchTransactionToInvoice } from '../../server/domain/bank/bank'
import { createClient } from '../../server/domain/clients'
import { addTimeEntry, createContract, getContractDetail } from '../../server/domain/contracts'
import { getDashboard } from '../../server/domain/dashboard'
import {
  addPayment,
  cancelInvoice,
  createInvoice,
  deleteDraftInvoice,
  deletePayment,
  getInvoiceDetail,
  issueInvoice,
  listInvoices,
  markInvoiceSent,
  updateInvoice,
  writeOffInvoice,
} from '../../server/domain/invoices'
import { createService } from '../../server/domain/services'
import { createSubscription, endSubscription, generateDueInvoices, generateNow, updateSubscription } from '../../server/domain/subscriptions'
import { qrReferenceFromNumber } from '../../shared/utils/qr-reference'
import { freshDb, TEST_DB_URL } from './helpers'

describe.skipIf(!TEST_DB_URL)('intégration (MariaDB)', () => {
  let db: Db
  let close: () => Promise<void>
  let actor: Actor
  let clientId: number
  let hostingId: number
  let domainId: number
  let maintenanceId: number

  beforeAll(async () => {
    const handle = await freshDb()
    db = handle.db
    actor = handle.actor
    close = () => handle.pool.end()
    clientId = (await createClient(db, actor, { name: 'Client Test SA', firstname: 'Jean', lastname: 'Test', email: 'jean@example.ch', phone: null, street: 'Rue du Test', streetNumber: '1', postalCode: '1950', city: 'Sion', country: 'CH', remark: null })).id
    hostingId = (await createService(db, actor, { name: 'Hébergement de site web', description: null, kind: 'RECURRING', defaultPriceCents: 15000, defaultCostCents: null, isMaintenance: false })).id
    domainId = (await createService(db, actor, { name: 'Nom de domaine', description: null, kind: 'RECURRING', defaultPriceCents: 1500, defaultCostCents: 1070, isMaintenance: false })).id
    maintenanceId = (await createService(db, actor, { name: 'Contrat de maintenance', description: null, kind: 'RECURRING', defaultPriceCents: 20000, defaultCostCents: null, isMaintenance: true })).id
  })
  afterAll(async () => close?.())

  const invoiceInput = () => ({
    clientId,
    title: 'Site vitrine',
    notes: null,
    createExpenses: true,
    expenseSupplier: 'Infomaniak',
    lines: [
      { serviceId: hostingId, label: 'Hébergement', quantity: 1, unitPriceCents: 15000, unitCostCents: null },
      { serviceId: domainId, label: 'Domaine exemple.ch', quantity: 1, unitPriceCents: 1500, unitCostCents: 1070 },
    ],
  })

  describe('factures', () => {
    it('numérote de façon atomique, même en parallèle', async () => {
      const created = await Promise.all(Array.from({ length: 6 }, () => db.transaction((tx) => createInvoice(tx, actor, invoiceInput()))))
      const numbers = created.map((i) => i.number).sort()
      expect(new Set(numbers).size).toBe(6)
      expect(numbers[5]! - numbers[0]!).toBe(5)
      for (const inv of created) expect(inv.qrReference).toBe(qrReferenceFromNumber(inv.number))
      const [setting] = await db.select().from(settings).where(eq(settings.key, 'INVOICE_NUMBER'))
      expect(Number(setting!.value)).toBe(numbers[5])
    })

    it('calcule le total et crée la dépense de coût liée', async () => {
      const inv = await db.transaction((tx) => createInvoice(tx, actor, invoiceInput()))
      expect(inv.totalCents).toBe(16500)
      expect(inv.status).toBe('DRAFT')
      const linked = await db.select().from(expenses).where(eq(expenses.invoiceId, inv.id))
      expect(linked).toHaveLength(1)
      expect(linked[0]).toMatchObject({ amountCents: 1070, category: 'DOMAIN', supplier: 'Infomaniak' })
    })

    it('suit le cycle émise → envoyée → paiement partiel → soldée', async () => {
      const inv = await db.transaction((tx) => createInvoice(tx, actor, invoiceInput()))
      const issued = await db.transaction((tx) => issueInvoice(tx, actor, inv.id, '2026-10-01'))
      expect(issued).toMatchObject({ status: 'ISSUED', issueDate: '2026-10-01', dueDate: '2026-10-31' })
      // Ré-émettre ne change pas la date figée
      expect((await db.transaction((tx) => issueInvoice(tx, actor, inv.id, '2026-12-01'))).issueDate).toBe('2026-10-01')

      await db.transaction((tx) => markInvoiceSent(tx, actor, inv.id, null))
      await expect(db.transaction((tx) => updateInvoice(tx, actor, inv.id, invoiceInput()))).rejects.toThrow(/ne peut plus être modifiée/)

      await expect(db.transaction((tx) => addPayment(tx, actor, inv.id, { amountCents: 20000, paidAt: '2026-10-05', note: null }))).rejects.toThrow(/dépasse/)
      const partial = await db.transaction((tx) => addPayment(tx, actor, inv.id, { amountCents: 10000, paidAt: '2026-10-05', note: null }))
      expect(partial.paidCents).toBe(10000)
      await expect(db.transaction((tx) => cancelInvoice(tx, actor, inv.id))).rejects.toThrow(/paiements/)

      const written = await db.transaction((tx) => writeOffInvoice(tx, actor, inv.id, 'Départ du client, payé au prorata'))
      expect(written.status).toBe('WRITTEN_OFF')
      const detail = await getInvoiceDetail(db, inv.id, '2026-10-25')
      expect(detail.invoice.displayStatus).toBe('WRITTEN_OFF')
      expect(detail.events.map((e) => e.type)).toEqual(expect.arrayContaining(['CREATED', 'ISSUED', 'SENT', 'PAYMENT', 'WRITTEN_OFF']))
    })

    it('passe en payée au paiement complet et permet de supprimer un paiement', async () => {
      const inv = await db.transaction((tx) => createInvoice(tx, actor, invoiceInput()))
      await db.transaction((tx) => issueInvoice(tx, actor, inv.id, '2026-10-01'))
      const paid = await db.transaction((tx) => addPayment(tx, actor, inv.id, { amountCents: 16500, paidAt: '2026-10-02', note: null }))
      expect(paid.paidCents).toBe(16500)
      await expect(db.transaction((tx) => addPayment(tx, actor, inv.id, { amountCents: 1, paidAt: '2026-10-02', note: null }))).rejects.toThrow(/entièrement payée/)
      const [payment] = await db.select().from(payments).where(eq(payments.invoiceId, inv.id))
      const after = await db.transaction((tx) => deletePayment(tx, actor, inv.id, payment!.id))
      expect(after.paidCents).toBe(0)
    })

    it('ne supprime que les brouillons', async () => {
      const draft = await db.transaction((tx) => createInvoice(tx, actor, invoiceInput()))
      await db.transaction((tx) => deleteDraftInvoice(tx, actor, draft.id))
      expect(await db.select().from(invoices).where(eq(invoices.id, draft.id))).toHaveLength(0)
      const issued = await db.transaction((tx) => createInvoice(tx, actor, invoiceInput()))
      await db.transaction((tx) => issueInvoice(tx, actor, issued.id))
      await expect(db.transaction((tx) => deleteDraftInvoice(tx, actor, issued.id))).rejects.toThrow(/brouillon/)
    })

    it('filtre côté serveur par statut', async () => {
      const open = await listInvoices(db, { status: 'OPEN', page: 1, pageSize: 50 })
      expect(open.items.every((i) => ['ISSUED', 'SENT', 'OVERDUE', 'PARTIALLY_PAID'].includes(i.displayStatus))).toBe(true)
      const search = await listInvoices(db, { q: 'Client Test', page: 1, pageSize: 2 })
      expect(search.items).toHaveLength(2)
      expect(search.total).toBeGreaterThan(2)
    })
  })

  describe('abonnements', () => {
    it('génère les factures à échéance, une seule fois, avec rattrapage et mention du retard', async () => {
      const sub = await db.transaction((tx) =>
        createSubscription(tx, actor, {
          clientId,
          name: 'Hébergement & domaine',
          period: 'YEARLY',
          startDate: '2024-09-19',
          nextBillingDate: '2025-09-19',
          notes: null,
          lines: [
            { serviceId: hostingId, label: null, quantity: 1, unitPriceCents: 15000, unitCostCents: null, supplier: null },
            { serviceId: domainId, label: 'exemple.ch', quantity: 1, unitPriceCents: 1500, unitCostCents: 1070, supplier: 'Infomaniak' },
          ],
        }),
      )
      const first = await generateDueInvoices(db, actor, '2026-10-25')
      const own = first.filter((g) => g.subscriptionId === sub.id)
      // 2025-09-19 et 2026-09-19 sont dues : rattrapage des deux périodes
      expect(own.map((g) => g.periodStart)).toEqual(['2025-09-19', '2026-09-19'])
      expect(own[1]!.lateDays).toBe(36)
      const again = await generateDueInvoices(db, actor, '2026-10-25')
      expect(again.filter((g) => g.subscriptionId === sub.id)).toHaveLength(0)

      const detail = await getInvoiceDetail(db, own[1]!.invoiceId)
      expect(detail.invoice.totalCents).toBe(16500)
      expect(detail.events.some((e) => e.type === 'LATE' && e.message.includes('36 jours'))).toBe(true)
      // La dépense du coût est datée de l'échéance (pour le rapprochement avec le débit fournisseur)
      expect(detail.expenses[0]).toMatchObject({ amountCents: 1070, date: '2026-09-19' })
      const [row] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id))
      expect(row!.nextBillingDate).toBe('2027-09-19')
    })

    it('applique les modifications au prochain renouvellement et respecte la date de fin', async () => {
      const sub = await db.transaction((tx) =>
        createSubscription(tx, actor, {
          clientId,
          name: 'Mails',
          period: 'YEARLY',
          startDate: '2026-01-01',
          nextBillingDate: '2026-11-01',
          notes: null,
          lines: [{ serviceId: domainId, label: '2 adresses', quantity: 2, unitPriceCents: 3000, unitCostCents: null, supplier: null }],
        }),
      )
      await db.transaction((tx) =>
        updateSubscription(tx, actor, sub.id, {
          clientId,
          name: 'Mails',
          period: 'YEARLY',
          startDate: '2026-01-01',
          nextBillingDate: '2026-11-01',
          notes: null,
          lines: [{ serviceId: domainId, label: '3 adresses', quantity: 3, unitPriceCents: 3000, unitCostCents: null, supplier: null }],
        }),
      )
      const generated = await generateNow(db, actor, sub.id, '2026-10-25')
      expect((await getInvoiceDetail(db, generated.invoiceId)).invoice.totalCents).toBe(9000)

      await db.transaction((tx) => endSubscription(tx, actor, sub.id, '2027-06-30', '2026-10-25'))
      const later = await generateDueInvoices(db, actor, '2027-10-25')
      expect(later.filter((g) => g.subscriptionId === sub.id)).toHaveLength(0)
      const [row] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id))
      expect(row!.status).toBe('ENDED')
    })
  })

  describe('contrats de maintenance', () => {
    it('calcule les heures restantes et crée la période suivante au renouvellement', async () => {
      const sub = await db.transaction((tx) =>
        createSubscription(tx, actor, {
          clientId,
          name: 'Maintenance',
          period: 'YEARLY',
          startDate: '2026-01-01',
          nextBillingDate: '2027-01-01',
          notes: null,
          lines: [{ serviceId: maintenanceId, label: null, quantity: 1, unitPriceCents: 20000, unitCostCents: null, supplier: null }],
        }),
      )
      const detailSub = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id))
      expect(detailSub).toHaveLength(1)
      const { getSubscriptionDetail } = await import('../../server/domain/subscriptions')
      const lineId = (await getSubscriptionDetail(db, sub.id)).lines[0]!.id
      const contract = await db.transaction((tx) =>
        createContract(tx, actor, { clientId, name: 'Maintenance Client Test', hoursPerPeriod: 20, startDate: '2026-01-01', subscriptionLineId: lineId, notes: null }),
      )
      await db.transaction((tx) => addTimeEntry(tx, actor, contract.id, { date: '2026-03-01', hours: 1.5, description: 'Mise à jour' }))
      await db.transaction((tx) => addTimeEntry(tx, actor, contract.id, { date: '2026-04-01', hours: 2.25, description: 'Sauvegardes' }))
      await expect(db.transaction((tx) => addTimeEntry(tx, actor, contract.id, { date: '2027-03-01', hours: 1, description: 'Hors période' }))).rejects.toThrow(/période/)

      let detail = await getContractDetail(db, contract.id, '2026-10-25')
      expect(detail.periods[0]).toMatchObject({ usedHours: 3.75, remainingHours: 16.25, isCurrent: true })

      await generateDueInvoices(db, actor, '2026-12-15')
      detail = await getContractDetail(db, contract.id, '2027-01-15')
      expect(detail.periods).toHaveLength(2)
      expect(detail.periods[0]).toMatchObject({ startDate: '2027-01-01', endDate: '2027-12-31', hoursQuota: 20, usedHours: 0, isCurrent: true })
      const periods = await db.select().from(maintenancePeriods).where(eq(maintenancePeriods.contractId, contract.id))
      expect(periods.find((p) => p.startDate === '2027-01-01')!.invoiceId).not.toBeNull()
    })
  })

  describe('banque', () => {
    it('importe, rapproche par référence QR, refuse les doublons et les autres comptes', async () => {
      const inv = await db.transaction((tx) => createInvoice(tx, actor, invoiceInput()))
      await db.transaction((tx) => issueInvoice(tx, actor, inv.id, '2026-10-01'))
      const camt = (iban: string, ref: string, amount: string, extra = '') => `<?xml version="1.0"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.04"><BkToCstmrStmt><Stmt><Acct><Id><IBAN>${iban}</IBAN></Id></Acct>
<Ntry><Amt Ccy="CHF">${amount}</Amt><CdtDbtInd>CRDT</CdtDbtInd><Sts>BOOK</Sts><BookgDt><Dt>2026-10-10</Dt></BookgDt>
<NtryDtls><TxDtls><RmtInf><Strd><CdtrRefInf><Ref>${ref}</Ref></CdtrRefInf></Strd></RmtInf></TxDtls></NtryDtls></Ntry>
<Ntry><Amt Ccy="CHF">10.7</Amt><CdtDbtInd>DBIT</CdtDbtInd><Sts>BOOK</Sts><BookgDt><Dt>2026-10-12</Dt></BookgDt>
<NtryDtls><TxDtls><RmtInf><Ustrd>Paiement infomaniak.com${extra}</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>
<Ntry><Amt Ccy="CHF">500</Amt><CdtDbtInd>DBIT</CdtDbtInd><Sts>BOOK</Sts><BookgDt><Dt>2026-10-13</Dt></BookgDt>
<NtryDtls><TxDtls><RltdPties><Cdtr><Nm>Test User</Nm></Cdtr></RltdPties></TxDtls></NtryDtls></Ntry>
</Stmt></BkToCstmrStmt></Document>`
      const iban = 'CH7500765001055862405'
      const summary = await importStatement(db, actor, 'releve.xml', Buffer.from(camt(iban, inv.qrReference, '100')))
      expect(summary).toMatchObject({ created: 3, autoMatched: { payments: 1, expenses: 1, withdrawals: 1 } })
      expect((await getInvoiceDetail(db, inv.id, '2026-10-25')).invoice.displayStatus).toBe('PARTIALLY_PAID')

      await expect(importStatement(db, actor, 'releve.xml', Buffer.from(camt(iban, inv.qrReference, '100')))).rejects.toThrow(/déjà été importé/)
      // Même mouvements dans un autre fichier : aucun doublon
      const again = await importStatement(db, actor, 'releve2.xml', Buffer.from(camt(iban, inv.qrReference, '100', ' ')))
      expect(again.created).toBe(0)
      await expect(importStatement(db, actor, 'autre.xml', Buffer.from(camt('CH0000000000000000001', inv.qrReference, '1')))).rejects.toThrow(/compte/)
    })

    it('propose et applique un rapprochement manuel pour un crédit sans référence', async () => {
      const input = { ...invoiceInput(), createExpenses: false, lines: [{ serviceId: null, label: 'Consultation', quantity: 1, unitPriceCents: 77700, unitCostCents: null }] }
      const inv = await db.transaction((tx) => createInvoice(tx, actor, input))
      await db.transaction((tx) => issueInvoice(tx, actor, inv.id, '2026-10-01'))
      const xml = `<?xml version="1.0"?><Document><BkToCstmrStmt><Stmt><Acct><Id><IBAN>CH7500765001055862405</IBAN></Id></Acct>
<Ntry><Amt Ccy="CHF">777</Amt><CdtDbtInd>CRDT</CdtDbtInd><Sts>BOOK</Sts><BookgDt><Dt>2026-10-20</Dt></BookgDt><AddtlNtryInf>Crédit QR-facture</AddtlNtryInf></Ntry>
</Stmt></BkToCstmrStmt></Document>`
      await importStatement(db, actor, 'sans-ref.xml', Buffer.from(xml))
      const pending = await listTransactions(db, { status: 'PENDING', direction: 'CREDIT', page: 1, pageSize: 10 })
      const tx = pending.items.find((t) => t.bookingDate === '2026-10-20')!
      expect(tx.suggestions!.invoices.some((i) => i.id === inv.id)).toBe(true)
      expect(await autoMatchTransaction(db, actor, tx.id)).toBeNull()
      await db.transaction((t) => matchTransactionToInvoice(t, actor, tx.id, inv.id))
      expect((await getInvoiceDetail(db, inv.id, '2026-10-25')).invoice.displayStatus).toBe('PAID')
    })
  })

  describe('sécurité', () => {
    it('bloque après 5 échecs de connexion et invalide les sessions au changement de mot de passe', async () => {
      const base = { email: 'test@mportal.local', ip: '10.0.0.1', userAgent: 'vitest' }
      const ok = await authenticate(db, { ...base, password: 'TestPassword2026' })
      for (let i = 0; i < 5; i++) {
        await expect(authenticate(db, { ...base, password: 'mauvais' })).rejects.toThrow(/incorrect/)
      }
      await expect(authenticate(db, { ...base, password: 'TestPassword2026' })).rejects.toThrow(/Trop de tentatives/)
      // Un email inconnu répond la même chose qu'un mauvais mot de passe
      await expect(authenticate(db, { ...base, email: 'inconnu@example.ch', ip: '10.0.0.2', password: 'x' })).rejects.toThrow(/incorrect/)

      const newVersion = await changePassword(db, ok.user.id, 'TestPassword2026', 'NouveauMotDePasse2026')
      expect(newVersion).toBe(ok.sessionVersion + 1)
      expect(await getSessionVersion(db, ok.user.id)).toBe(newVersion)
    })
  })

  it('agrège le tableau de bord', async () => {
    const dashboard = await getDashboard(db, 2026, '2026-10-25')
    expect(dashboard.totals.invoicedCents).toBeGreaterThan(0)
    expect(dashboard.totals.resultCents).toBe(dashboard.totals.collectedCents - dashboard.totals.expensesCents)
    expect(dashboard.series.invoiced).toHaveLength(12)
    expect(dashboard.drafts.length).toBeGreaterThan(0)
  })
})
