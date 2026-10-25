import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import type { PdfAssets } from '../../server/domain/pdf/common'
import { buildQrBillData, renderInvoicePdf } from '../../server/domain/pdf/invoice-pdf'
import { SETTING_DEFAULTS } from '../../server/domain/settings'
import { FileStorage, isPdf, isXml } from '../../server/domain/storage'
import { qrReferenceFromNumber } from '../../shared/utils/qr-reference'

const assetsDir = resolve(import.meta.dirname, '../../server/assets')
const assets: PdfAssets = {
  logo: readFileSync(join(assetsDir, 'logo.png')),
  fontRegular: readFileSync(join(assetsDir, 'Outfit-Regular.ttf')),
  fontBold: readFileSync(join(assetsDir, 'Outfit-Bold.ttf')),
}

const invoice = {
  number: 3255485674300,
  qrReference: qrReferenceFromNumber(3255485674300),
  title: 'Hébergement & domaine 2026-2027',
  issueDate: '2026-10-25',
  dueDate: '2026-11-24',
  totalCents: 16500,
  client: { name: 'Client Test SA', firstname: 'Jean', lastname: 'Test', street: 'Rue du Test', streetNumber: '12a', postalCode: '1950', city: 'Sion', country: 'CH' },
  lines: [
    { label: 'Hébergement de site web', quantity: 1, unitPriceCents: 15000 },
    { label: 'Nom de domaine – exemple.ch', quantity: 1, unitPriceCents: 1500 },
  ],
}

describe('PDF de facture', () => {
  it('génère un PDF avec bulletin QR', async () => {
    const pdf = await renderInvoicePdf(invoice, { ...SETTING_DEFAULTS }, assets)
    expect(isPdf(pdf)).toBe(true)
    expect(pdf.length).toBeGreaterThan(20_000)
  })

  it('gère beaucoup de lignes (saut de page) et un client sans adresse', async () => {
    const many = {
      ...invoice,
      client: { ...invoice.client, street: null, postalCode: null, city: null },
      lines: Array.from({ length: 60 }, (_, i) => ({ label: `Prestation ${i + 1}`, quantity: 1, unitPriceCents: 100 })),
      totalCents: 6000,
    }
    const pdf = await renderInvoicePdf(many, { ...SETTING_DEFAULTS }, assets)
    expect(isPdf(pdf)).toBe(true)
    expect(buildQrBillData(many, { ...SETTING_DEFAULTS }).debtor).toBeUndefined()
  })

  it('utilise le QR-IBAN et la référence de la facture', () => {
    const data = buildQrBillData(invoice, { ...SETTING_DEFAULTS })
    expect(data.creditor.account).toBe(SETTING_DEFAULTS.QR_IBAN)
    expect(data.reference).toBe(invoice.qrReference)
    expect(data.amount).toBe(165)
  })
})

describe('stockage de fichiers', () => {
  const root = mkdtempSync(join(tmpdir(), 'mportal-test-'))
  const storage = new FileStorage(root)
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it('enregistre sous un nom généré et relit', async () => {
    const name = await storage.save('contracts', '../../etc/passwd', 'pdf', Buffer.from('%PDF-1.4 test'))
    expect(name).toMatch(/^etcpasswd-[a-f0-9]{24}\.pdf$/)
    expect((await storage.read('contracts', name)).toString()).toBe('%PDF-1.4 test')
  })

  it('refuse toute traversée de répertoire', async () => {
    await expect(storage.read('contracts', '../secret.pdf')).rejects.toThrow()
    await expect(storage.read('contracts', '..\\secret.pdf')).rejects.toThrow()
    await expect(storage.read('contracts', 'introuvable.pdf')).rejects.toThrow(/introuvable/)
  })

  it('reconnaît les types de fichiers par leur contenu', () => {
    expect(isPdf(Buffer.from('%PDF-1.7'))).toBe(true)
    expect(isPdf(Buffer.from('<html>'))).toBe(false)
    expect(isXml(Buffer.from('﻿<?xml version="1.0"?>'))).toBe(true)
    expect(isXml(Buffer.from('%PDF'))).toBe(false)
  })
})
