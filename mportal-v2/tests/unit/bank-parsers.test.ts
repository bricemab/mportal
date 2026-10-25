import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCamt053 } from '../../server/domain/bank/parse-camt'
import { parseBcvsPdf, parseBcvsPdfItems, type TextItem } from '../../server/domain/bank/parse-pdf'
import { fingerprintTransactions, parseBankAmount } from '../../server/domain/bank/types'

// Données fictives (aucune donnée réelle de client)
const CAMT = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.04"><BkToCstmrStmt><Stmt>
<FrToDt><FrDtTm>2026-01-01T00:00:00</FrDtTm><ToDtTm>2026-03-31T23:59:59</ToDtTm></FrToDt>
<Acct><Id><IBAN>CH0000000000000000001</IBAN></Id><Ownr><Nm>Titulaire Test</Nm></Ownr></Acct>
<Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="CHF">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd></Bal>
<Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="CHF">989.3</Amt><CdtDbtInd>CRDT</CdtDbtInd></Bal>
<Ntry><Amt Ccy="CHF">165</Amt><CdtDbtInd>CRDT</CdtDbtInd><RvslInd>false</RvslInd><Sts>BOOK</Sts><BookgDt><Dt>2026-01-10</Dt></BookgDt><ValDt><Dt>2026-01-10</Dt></ValDt>
<NtryDtls><TxDtls><Amt Ccy="CHF">165</Amt><RltdPties><Dbtr><Nm>Client &amp; Fils</Nm></Dbtr><DbtrAcct><Id><IBAN>CH1100000000000000002</IBAN></Id></DbtrAcct></RltdPties>
<RmtInf><Strd><CdtrRefInf><Tp><CdOrPrtry><Prtry>QRR</Prtry></CdOrPrtry></Tp><Ref>000000000000032554856742555</Ref></CdtrRefInf></Strd></RmtInf></TxDtls></NtryDtls>
<AddtlNtryInf>Crédit QR-facture</AddtlNtryInf></Ntry>
<Ntry><Amt Ccy="CHF">10.7</Amt><CdtDbtInd>DBIT</CdtDbtInd><RvslInd>false</RvslInd><Sts>BOOK</Sts><BookgDt><Dt>2026-02-01</Dt></BookgDt>
<NtryDtls><TxDtls><Amt Ccy="CHF">10.7</Amt><RltdPties><Cdtr><Nm>Titulaire Test</Nm></Cdtr></RltdPties><RmtInf><Ustrd>Paiement infomaniak.com</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>
<Ntry><Amt Ccy="CHF">165</Amt><CdtDbtInd>DBIT</CdtDbtInd><RvslInd>false</RvslInd><Sts>BOOK</Sts><BookgDt><Dt>2026-03-01</Dt></BookgDt>
<NtryDtls><Btch><NbOfTxs>2</NbOfTxs></Btch>
<TxDtls><Amt Ccy="CHF">100</Amt><RltdPties><Cdtr><Nm>Associé Un</Nm></Cdtr></RltdPties></TxDtls>
<TxDtls><Amt Ccy="CHF">65</Amt><RltdPties><Cdtr><Nm>Associé Deux</Nm></Cdtr></RltdPties></TxDtls></NtryDtls></Ntry>
</Stmt></BkToCstmrStmt></Document>`

describe('camt.053', () => {
  it('lit soldes, crédits avec référence QR et éclate les lots', () => {
    const s = parseCamt053(CAMT)
    expect(s.iban).toBe('CH0000000000000000001')
    expect(s.periodFrom).toBe('2026-01-01')
    expect(s.openingBalanceCents).toBe(100000)
    expect(s.closingBalanceCents).toBe(98930)
    expect(s.transactions).toHaveLength(4)
    const [credit, card, a, b] = s.transactions
    expect(credit).toMatchObject({ direction: 'CREDIT', amountCents: 16500, qrReference: '000000000000032554856742555', counterparty: 'Client & Fils', counterpartyIban: 'CH1100000000000000002' })
    // Le titulaire du compte n'est pas une contrepartie ; le commerçant est reconnu
    expect(card).toMatchObject({ direction: 'DEBIT', amountCents: 1070, counterparty: 'Infomaniak' })
    expect(a).toMatchObject({ amountCents: 10000, counterparty: 'Associé Un' })
    expect(b).toMatchObject({ amountCents: 6500, counterparty: 'Associé Deux' })
  })

  it('refuse les DTD (protection XXE / expansion d’entités)', () => {
    const evil = `<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa">]><Document/>`
    expect(() => parseCamt053(evil)).toThrow(/DTD/)
  })

  it('refuse un XML qui n’est pas un relevé', () => {
    expect(() => parseCamt053('<?xml version="1.0"?><Document><Autre/></Document>')).toThrow()
  })
})

// Reproduction fictive de la mise en page BCVS (positions mesurées sur un vrai relevé)
function row(page: number, y: number, cells: Array<[number, string]>): TextItem[] {
  return cells.map(([x, str]) => ({ page, x, y, str }))
}
const PDF_ITEMS: TextItem[] = [
  ...row(1, 689, [[71, 'IBAN'], [167, 'CH00 0000 0000 0000 0000 1']]),
  ...row(1, 599, [[71, 'Solde initial au 01.01.2026'], [201, 'CHF'], [250, "1'000.00"]]),
  ...row(1, 590, [[71, 'Solde final au 31.03.2026'], [201, 'CHF'], [250, '989.30']]),
  ...row(1, 557, [[72, 'Date'], [123, 'Texte'], [390, 'Débit'], [470, 'Crédit'], [517, 'Solde CHF']]),
  ...row(1, 540, [[72, '10.01.2026'], [123, 'Client & Fils, Rue 1, 1000 Ville'], [415, 'CHF'], [461, '165.00'], [517, "1'165.00"]]),
  ...row(1, 528, [[123, 'Mandataire']]),
  ...row(1, 516, [[123, '/C/CH1100000000000000002']]),
  ...row(1, 504, [[123, 'Versé par']]),
  ...row(1, 492, [[123, 'Client & Fils']]),
  ...row(1, 480, [[123, 'Communication/Référence']]),
  ...row(1, 468, [[123, '00 00000 00000 03255 48567 42555']]),
  ...row(1, 456, [[123, 'Montant comptabilisé']]),
  ...row(1, 444, [[123, 'CHF 165.00']]),
  ...row(1, 19, [[71, '0000 | 0000 | 0000'], [252, 'Indications sans engagement'], [521, 'Page 1 / 2']]),
  ...row(2, 678, [[72, 'Date'], [123, 'Texte'], [390, 'Débit'], [470, 'Crédit'], [517, 'Solde CHF']]),
  ...row(2, 660, [[72, '01.02.2026'], [123, 'Paiement 30.01.2026 03:06 infomaniak.com'], [333, 'CHF'], [384, '10.70'], [517, "1'154.30"]]),
  ...row(2, 650, [[123, 'Numéro de carte: 000000******0000']]),
  ...row(2, 630, [[72, '01.03.2026'], [123, 'Ordre e-banking'], [333, 'CHF'], [384, '165.00'], [517, '989.30']]),
  ...row(2, 618, [[123, 'Bénéficiaire']]),
  ...row(2, 606, [[123, 'Associé Un']]),
  ...row(2, 594, [[123, 'IBAN: CH2200000000000000003']]),
]

describe('relevé PDF BCVS', () => {
  it('reconstitue les mouvements, le sens et les références', () => {
    const s = parseBcvsPdfItems(PDF_ITEMS)
    expect(s.iban).toBe('CH0000000000000000001')
    expect(s.openingBalanceCents).toBe(100000)
    expect(s.closingBalanceCents).toBe(98930)
    expect(s.transactions).toHaveLength(3)
    expect(s.transactions[0]).toMatchObject({
      bookingDate: '2026-01-10',
      direction: 'CREDIT',
      amountCents: 16500,
      qrReference: '000000000000032554856742555',
      counterparty: 'Client & Fils',
      counterpartyIban: 'CH1100000000000000002',
    })
    expect(s.transactions[1]).toMatchObject({ direction: 'DEBIT', amountCents: 1070, counterparty: 'Infomaniak', qrReference: null })
    expect(s.transactions[2]).toMatchObject({ direction: 'DEBIT', amountCents: 16500, counterparty: 'Associé Un', counterpartyIban: 'CH2200000000000000003' })
  })

  it('refuse un PDF qui n’est pas un relevé BCVS', () => {
    expect(() => parseBcvsPdfItems(row(1, 500, [[50, 'Bonjour']]))).toThrow(/non reconnu/)
  })

  it('produit les mêmes empreintes que le camt.053 pour les mêmes mouvements', () => {
    const fromPdf = fingerprintTransactions(parseBcvsPdfItems(PDF_ITEMS).transactions, 'CH0000000000000000001')
    const fromCamt = fingerprintTransactions(parseCamt053(CAMT).transactions.slice(0, 2), 'CH0000000000000000001')
    expect(fromPdf.slice(0, 2)).toEqual(fromCamt)
  })

  it('lit les montants avec apostrophes', () => {
    expect(parseBankAmount("3'920.00")).toBe(392000)
    expect(parseBankAmount('CHF 1.90')).toBe(190)
    expect(parseBankAmount('1,90')).toBeNull()
  })

  // Test sur un vrai relevé, uniquement en local (fichier non versionné)
  const sample = process.env.BANK_PDF_SAMPLE
  it.skipIf(!sample || !existsSync(sample))('lit un vrai relevé BCVS (BANK_PDF_SAMPLE)', async () => {
    const s = await parseBcvsPdf(new Uint8Array(readFileSync(sample!)))
    expect(s.transactions.length).toBeGreaterThan(0)
    let balance = s.openingBalanceCents!
    for (const t of s.transactions) balance += t.direction === 'CREDIT' ? t.amountCents : -t.amountCents
    expect(balance).toBe(s.closingBalanceCents)
    expect(s.transactions.filter((t) => t.direction === 'CREDIT').every((t) => t.qrReference !== null)).toBe(true)
  })
})
