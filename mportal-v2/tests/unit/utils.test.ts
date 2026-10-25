import { describe, expect, it } from 'vitest'
import { addDays, addMonths, addPeriod, diffDays, formatDateCh, isIsoDate, parseDateCh, todayIso } from '../../shared/utils/dates'
import { displayStatus, isInvoiceEditable, remainingCents } from '../../shared/utils/invoice-status'
import { formatAmount, formatChf, lineTotalCents, parseAmountToCents, sumLinesCents, toCents } from '../../shared/utils/money'
import { formatQrReference, isValidQrReference, normalizeQrReference, qrCheckDigit, qrReferenceFromNumber } from '../../shared/utils/qr-reference'
import { guessExpenseCategory } from '../../server/domain/expense-category'

describe('montants', () => {
  it('convertit sans erreur d’arrondi flottant', () => {
    expect(toCents(10.7)).toBe(1070)
    expect(toCents(0.1 + 0.2)).toBe(30)
    expect(lineTotalCents(1.5, 8000)).toBe(12000)
    expect(lineTotalCents(3, 1070)).toBe(3210)
    expect(sumLinesCents([{ quantity: 1, unitPriceCents: 15000 }, { quantity: 7, unitPriceCents: 871 }])).toBe(21097)
  })

  it('formate au format suisse', () => {
    expect(formatAmount(374310)).toBe("3'743.10")
    expect(formatAmount(5)).toBe('0.05')
    expect(formatAmount(-123456789)).toBe("-1'234'567.89")
    expect(formatChf(16500)).toBe('165.00 CHF')
  })

  it('lit les saisies utilisateur', () => {
    expect(parseAmountToCents("1'234.50")).toBe(123450)
    expect(parseAmountToCents('12,5')).toBe(1250)
    expect(parseAmountToCents('12')).toBe(1200)
    expect(parseAmountToCents('12.345')).toBeNull()
    expect(parseAmountToCents('abc')).toBeNull()
  })
})

describe('référence QR', () => {
  it('reproduit les références déjà émises par l’ancienne application', () => {
    // Références lues sur le relevé bancaire réel
    expect(qrReferenceFromNumber(3255485674255)).toBe('000000000000032554856742555')
    expect(qrReferenceFromNumber(3255485674263)).toBe('000000000000032554856742635')
    expect(qrReferenceFromNumber(3255485674265)).toBe('000000000000032554856742651')
  })

  it('valide et normalise', () => {
    expect(isValidQrReference('000000000000032554856742555')).toBe(true)
    expect(isValidQrReference('000000000000032554856742556')).toBe(false)
    expect(normalizeQrReference('00 00000 00000 03255 48567 42555')).toBe('000000000000032554856742555')
    expect(normalizeQrReference('RF18 5390 0754 7034')).toBeNull()
    expect(formatQrReference('000000000000032554856742555')).toBe('00 00000 00000 03255 48567 42555')
    expect(qrCheckDigit('21000000000313947143000901')).toBe(7)
  })
})

describe('dates', () => {
  it('ajoute des périodes en gérant les fins de mois', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(addPeriod('2024-02-29', 'YEARLY')).toBe('2025-02-28')
    expect(addPeriod('2026-09-19', 'YEARLY')).toBe('2027-09-19')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(diffDays('2026-09-19', '2026-10-25')).toBe(36)
  })

  it('valide et convertit le format suisse', () => {
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('2026-02-28')).toBe(true)
    expect(formatDateCh('2026-10-25')).toBe('25.10.2026')
    expect(parseDateCh('1.2.2026')).toBe('2026-02-01')
    expect(parseDateCh('31.02.2026')).toBeNull()
  })

  it('donne la date du jour en Suisse quel que soit le fuseau du serveur', () => {
    expect(todayIso(new Date('2026-10-24T22:30:00Z'))).toBe('2026-10-25')
    expect(todayIso(new Date('2026-01-01T22:59:00Z'))).toBe('2026-01-01')
  })
})

describe('statut des factures', () => {
  const base = { status: 'SENT' as const, totalCents: 10000, paidCents: 0, dueDate: '2026-10-01' }

  it('calcule le statut affiché', () => {
    expect(displayStatus(base, '2026-09-01')).toBe('SENT')
    expect(displayStatus(base, '2026-10-02')).toBe('OVERDUE')
    expect(displayStatus({ ...base, paidCents: 4000 }, '2026-10-02')).toBe('PARTIALLY_PAID')
    expect(displayStatus({ ...base, paidCents: 10000 }, '2026-10-02')).toBe('PAID')
    expect(displayStatus({ ...base, status: 'WRITTEN_OFF', paidCents: 4000 })).toBe('WRITTEN_OFF')
    expect(displayStatus({ ...base, status: 'DRAFT' })).toBe('DRAFT')
  })

  it('verrouille les factures envoyées ou payées', () => {
    expect(isInvoiceEditable({ ...base, status: 'DRAFT' })).toBe(true)
    expect(isInvoiceEditable({ ...base, status: 'ISSUED' })).toBe(true)
    expect(isInvoiceEditable(base)).toBe(false)
    expect(isInvoiceEditable({ ...base, status: 'ISSUED', paidCents: 100 })).toBe(false)
    expect(remainingCents({ totalCents: 100, paidCents: 150 })).toBe(0)
  })
})

describe('catégories de dépenses', () => {
  it('devine la catégorie depuis le libellé', () => {
    expect(guessExpenseCategory('Nom de domaine – HDNL')).toBe('DOMAIN')
    expect(guessExpenseCategory('Hébergement de serveur VPS')).toBe('VPS')
    expect(guessExpenseCategory('Pack 7 adresses mails')).toBe('EMAIL')
    expect(guessExpenseCategory('Hébergement de site web')).toBe('HOSTING')
    expect(guessExpenseCategory('Café')).toBe('OTHER')
  })
})
