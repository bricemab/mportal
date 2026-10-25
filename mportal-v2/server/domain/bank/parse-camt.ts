import { XMLParser } from 'fast-xml-parser'
import { normalizeQrReference } from '../../../shared/utils/qr-reference'
import { badRequest } from '../errors'
import { parseBankAmount, type ParsedStatement, type ParsedTransaction } from './types'

type XmlNode = Record<string, unknown>

const ARRAY_TAGS = new Set(['Ntry', 'TxDtls', 'Bal', 'Stmt', 'AdrLine', 'Ustrd', 'Strd'])

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function node(value: unknown): XmlNode | undefined {
  return typeof value === 'object' && value !== null ? (value as XmlNode) : undefined
}

function path(root: unknown, ...keys: string[]): unknown {
  let current: unknown = root
  for (const key of keys) {
    const n = node(current)
    if (!n) return undefined
    current = n[key]
  }
  return current
}

function text(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
  const n = node(value)
  if (n && '#text' in n) return text(n['#text'])
  return null
}

function amountOf(value: unknown): number | null {
  const raw = text(value)
  return raw === null ? null : parseBankAmount(raw)
}

function dateOf(value: unknown): string | null {
  const raw = text(path(value, 'Dt')) ?? text(path(value, 'DtTm'))
  return raw ? raw.slice(0, 10) : null
}

function partyName(party: unknown): string | null {
  return text(path(party, 'Nm')) ?? text(path(party, 'Pty', 'Nm'))
}

function partyIban(account: unknown): string | null {
  return text(path(account, 'Id', 'IBAN'))
}

/**
 * Lecture d'un relevé camt.053 (ISO 20022, versions .001.02 à .001.08).
 * Les lots (plusieurs TxDtls dans une écriture) sont éclatés en mouvements individuels.
 * Les DTD / entités sont refusées : pas d'expansion d'entités ni d'accès externe.
 */
export function parseCamt053(xml: string): ParsedStatement {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw badRequest('Fichier XML refusé (DTD non autorisée)')
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: false,
    isArray: (name) => ARRAY_TAGS.has(name),
  })
  const doc = parser.parse(xml) as XmlNode
  const statements = asArray(path(doc, 'Document', 'BkToCstmrStmt', 'Stmt') as XmlNode[] | XmlNode | undefined)
  if (statements.length === 0) throw badRequest('Ce fichier n’est pas un relevé camt.053')

  const result: ParsedStatement = {
    format: 'CAMT053',
    iban: null,
    periodFrom: null,
    periodTo: null,
    openingBalanceCents: null,
    closingBalanceCents: null,
    transactions: [],
  }

  for (const stmt of statements) {
    result.iban ??= text(path(stmt, 'Acct', 'Id', 'IBAN'))
    // La BCVS indique parfois le titulaire du compte comme créancier des paiements par carte
    const ownerName = text(path(stmt, 'Acct', 'Ownr', 'Nm'))
    const from = text(path(stmt, 'FrToDt', 'FrDtTm'))?.slice(0, 10) ?? null
    const to = text(path(stmt, 'FrToDt', 'ToDtTm'))?.slice(0, 10) ?? null
    if (from && (!result.periodFrom || from < result.periodFrom)) result.periodFrom = from
    if (to && (!result.periodTo || to > result.periodTo)) result.periodTo = to

    for (const bal of asArray(path(stmt, 'Bal') as XmlNode[] | undefined)) {
      const code = text(path(bal, 'Tp', 'CdOrPrtry', 'Cd'))
      const amount = amountOf(path(bal, 'Amt'))
      const sign = text(path(bal, 'CdtDbtInd')) === 'DBIT' ? -1 : 1
      if (amount === null) continue
      if (code === 'OPBD' && result.openingBalanceCents === null) result.openingBalanceCents = sign * amount
      if (code === 'CLBD') result.closingBalanceCents = sign * amount
    }

    for (const entry of asArray(path(stmt, 'Ntry') as XmlNode[] | undefined)) {
      if (text(path(entry, 'Sts')) && !['BOOK', 'BOOKED'].includes(text(path(entry, 'Sts', 'Cd')) ?? text(path(entry, 'Sts')) ?? '')) continue
      if (text(path(entry, 'RvslInd')) === 'true') continue
      const direction = text(path(entry, 'CdtDbtInd')) === 'DBIT' ? 'DEBIT' : 'CREDIT'
      const bookingDate = dateOf(path(entry, 'BookgDt'))
      const valueDate = dateOf(path(entry, 'ValDt'))
      const entryAmount = amountOf(path(entry, 'Amt'))
      if (!bookingDate || entryAmount === null) continue
      const entryInfo = text(path(entry, 'AddtlNtryInf')) ?? ''
      const details = asArray(path(entry, 'NtryDtls', 'TxDtls') as XmlNode[] | undefined)

      const build = (tx: XmlNode | null, amountCents: number): ParsedTransaction => {
        const parties = path(tx, 'RltdPties')
        const counterpartyNode = direction === 'CREDIT' ? path(parties, 'Dbtr') : path(parties, 'Cdtr')
        let counterparty = partyName(counterpartyNode)
        if (counterparty === 'NOTPROVIDED' || (ownerName && counterparty === ownerName)) counterparty = null
        const iban = partyIban(direction === 'CREDIT' ? path(parties, 'DbtrAcct') : path(parties, 'CdtrAcct'))
        const structured = asArray(path(tx, 'RmtInf', 'Strd') as XmlNode[] | undefined)
        let qrReference: string | null = null
        for (const s of structured) {
          const ref = text(path(s, 'CdtrRefInf', 'Ref'))
          if (ref) qrReference = normalizeQrReference(ref) ?? qrReference
        }
        const unstructured = asArray(path(tx, 'RmtInf', 'Ustrd') as unknown[] | undefined)
          .map(text)
          .filter((v): v is string => Boolean(v))
        const description = [text(path(tx, 'AddtlTxInf')) ?? entryInfo, ...unstructured]
          .filter((v, i, all) => v && all.indexOf(v) === i)
          .join(' · ')
        // Paiement par carte : le commerçant apparaît dans le texte libre
        if (!counterparty && /infomaniak/i.test(description)) counterparty = 'Infomaniak'
        return {
          bookingDate,
          valueDate,
          amountCents,
          direction,
          counterparty,
          counterpartyIban: iban,
          description: description.slice(0, 2000),
          qrReference,
        }
      }

      if (details.length <= 1) {
        result.transactions.push(build(details[0] ?? null, entryAmount))
      } else {
        for (const tx of details) {
          const amount = amountOf(path(tx, 'Amt')) ?? amountOf(path(tx, 'AmtDtls', 'TxAmt', 'Amt'))
          if (amount !== null) result.transactions.push(build(tx, amount))
        }
      }
    }
  }
  return result
}
