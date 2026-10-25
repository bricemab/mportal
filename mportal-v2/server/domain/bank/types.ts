import { createHash } from 'node:crypto'

export interface ParsedTransaction {
  bookingDate: string
  valueDate: string | null
  amountCents: number
  direction: 'CREDIT' | 'DEBIT'
  counterparty: string | null
  counterpartyIban: string | null
  description: string
  qrReference: string | null
}

export interface ParsedStatement {
  format: 'CAMT053' | 'PDF'
  iban: string | null
  periodFrom: string | null
  periodTo: string | null
  openingBalanceCents: number | null
  closingBalanceCents: number | null
  transactions: ParsedTransaction[]
}

/** « 3'743.10 » / « 3743.1 » → 374310 */
export function parseBankAmount(raw: string): number | null {
  const cleaned = raw.replace(/['’\s]/g, '').replace(/^CHF/i, '')
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null
  return Math.round(Number(cleaned) * 100)
}

/**
 * Empreinte d'un mouvement, identique quel que soit le format importé (camt.053 ou PDF) :
 * compte, date de comptabilisation, sens, montant et rang parmi les mouvements identiques du fichier.
 * La référence QR n'en fait pas partie : le camt.053 BCVS ne la fournit pas, le PDF oui.
 */
export function fingerprintTransactions(transactions: ReadonlyArray<ParsedTransaction>, iban: string | null): string[] {
  const seen = new Map<string, number>()
  return transactions.map((t) => {
    const base = [iban ?? '', t.bookingDate, t.direction, t.amountCents].join('|')
    const rank = seen.get(base) ?? 0
    seen.set(base, rank + 1)
    return createHash('sha256').update(`${base}|${rank}`).digest('hex')
  })
}
