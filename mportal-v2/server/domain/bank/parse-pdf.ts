import { normalizeQrReference } from '../../../shared/utils/qr-reference'
import { parseDateCh } from '../../../shared/utils/dates'
import { badRequest } from '../errors'
import { parseBankAmount, type ParsedStatement, type ParsedTransaction } from './types'

/** Élément de texte positionné, tel qu'extrait du PDF (origine en bas à gauche). */
export interface TextItem {
  page: number
  x: number
  y: number
  str: string
}

const DATE_RE = /^\d{2}\.\d{2}\.\d{4}$/
const AMOUNT_RE = /^-?\d{1,3}('\d{3})*\.\d{2}$|^-?\d+\.\d{2}$/
const HEADINGS = new Set([
  'Mandataire',
  'Versé par',
  'Bénéficiaire',
  'Communication/Référence',
  'Montant comptabilisé',
  'Compte du bénéficiaire (No. BC)',
  'Donneur d’ordre',
  "Donneur d'ordre",
  'Motif du paiement',
])

interface Row {
  page: number
  y: number
  items: TextItem[]
}

function groupRows(items: TextItem[]): Row[] {
  const rows: Row[] = []
  const sorted = [...items].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x)
  for (const item of sorted) {
    const last = rows.at(-1)
    if (last && last.page === item.page && Math.abs(last.y - item.y) <= 2) last.items.push(item)
    else rows.push({ page: item.page, y: item.y, items: [item] })
  }
  for (const row of rows) row.items.sort((a, b) => a.x - b.x)
  return rows
}

function rowText(row: Row, minX = 0, maxX = Number.POSITIVE_INFINITY): string {
  return row.items
    .filter((i) => i.x >= minX && i.x < maxX)
    .map((i) => i.str.trim())
    .filter(Boolean)
    .join(' ')
}

/**
 * Lecture d'un relevé PDF BCVS « Transactions individuelles (avec détails) ».
 * Colonnes repérées par la ligne d'en-tête « Date / Texte / Débit / Crédit / Solde » de chaque page ;
 * le sens (débit/crédit) est vérifié par l'évolution du solde.
 */
export function parseBcvsPdfItems(items: TextItem[]): ParsedStatement {
  const rows = groupRows(items.filter((i) => i.str.trim().length > 0))

  // Repérage des colonnes par page
  const headerByPage = new Map<number, { y: number; debitX: number; creditX: number; balanceX: number; textX: number }>()
  for (const row of rows) {
    const labels = row.items.map((i) => i.str.trim())
    if (labels.includes('Date') && labels.includes('Texte') && labels.includes('Débit') && labels.includes('Crédit')) {
      const find = (label: string) => row.items.find((i) => i.str.trim().startsWith(label))?.x
      const creditX = find('Crédit') ?? 0
      headerByPage.set(row.page, {
        y: row.y,
        textX: find('Texte') ?? 0,
        debitX: find('Débit') ?? 0,
        creditX,
        balanceX: find('Solde') ?? creditX + 45,
      })
    }
  }
  if (headerByPage.size === 0) throw badRequest('Format PDF non reconnu (relevé BCVS « Transactions individuelles » attendu)')

  const statement: ParsedStatement = {
    format: 'PDF',
    iban: null,
    periodFrom: null,
    periodTo: null,
    openingBalanceCents: null,
    closingBalanceCents: null,
    transactions: [],
  }

  // En-tête du relevé (avant le tableau de la 1re page)
  for (const row of rows) {
    const first = row.items[0]?.str.trim() ?? ''
    const rest = row.items.slice(1).map((i) => i.str.trim())
    if (first === 'IBAN' && !statement.iban) statement.iban = rest.join('').replace(/\s/g, '') || null
    const balance = /^Solde (initial|final) au (\d{2}\.\d{2}\.\d{4})$/.exec(first)
    if (balance) {
      const amountItem = rest.find((r) => AMOUNT_RE.test(r))
      const amount = amountItem ? parseBankAmount(amountItem) : null
      const date = parseDateCh(balance[2]!)
      if (balance[1] === 'initial') {
        statement.openingBalanceCents = amount
        statement.periodFrom = date
      } else {
        statement.closingBalanceCents = amount
        statement.periodTo = date
      }
    }
  }

  // Lignes du tableau uniquement (sous l'en-tête, au-dessus du pied de page)
  const tableRows = rows.filter((row) => {
    const header = headerByPage.get(row.page)
    if (!header || row.y >= header.y - 1) return false
    const text = rowText(row)
    return row.y > 30 && !/^Page \d+ \/ \d+$/.test(text) && !text.includes('Indications sans engagement')
  })

  interface Draft {
    start: Row
    rows: Row[]
  }
  const drafts: Draft[] = []
  for (const row of tableRows) {
    const header = headerByPage.get(row.page)!
    const first = row.items[0]
    if (first && first.x < header.textX - 5 && DATE_RE.test(first.str.trim())) drafts.push({ start: row, rows: [] })
    else drafts.at(-1)?.rows.push(row)
  }

  let previousBalance = statement.openingBalanceCents
  for (const draft of drafts) {
    const header = headerByPage.get(draft.start.page)!
    const bookingDate = parseDateCh(draft.start.items[0]!.str.trim())
    if (!bookingDate) continue
    const numbers = draft.start.items.filter((i) => i.x > header.textX + 150 && AMOUNT_RE.test(i.str.trim()))
    const balanceItem = numbers.find((i) => i.x >= header.balanceX - 10)
    const amountItem = numbers.find((i) => i !== balanceItem)
    if (!amountItem) continue
    const amountCents = parseBankAmount(amountItem.str.trim())
    if (amountCents === null) continue
    const balanceCents = balanceItem ? parseBankAmount(balanceItem.str.trim()) : null

    // Sens : par l'évolution du solde si possible, sinon par la colonne
    let direction: 'CREDIT' | 'DEBIT' = Math.abs(amountItem.x - header.creditX) < Math.abs(amountItem.x - header.debitX) ? 'CREDIT' : 'DEBIT'
    if (previousBalance !== null && balanceCents !== null) {
      if (previousBalance + amountCents === balanceCents) direction = 'CREDIT'
      else if (previousBalance - amountCents === balanceCents) direction = 'DEBIT'
    }
    if (balanceCents !== null) previousBalance = balanceCents

    // Texte principal + sections détaillées
    const descriptionParts = [rowText(draft.start, header.textX - 2, header.textX + 205)]
    const sections = new Map<string, string[]>()
    let currentSection: string | null = null
    for (const row of draft.rows) {
      const line = rowText(row, header.textX - 2)
      if (!line) continue
      if (HEADINGS.has(line)) {
        currentSection = line
        sections.set(line, [])
      } else if (currentSection) {
        sections.get(currentSection)!.push(line)
      } else {
        descriptionParts.push(line)
      }
    }

    let qrReference: string | null = null
    const referenceLines = sections.get('Communication/Référence') ?? []
    const freeText: string[] = []
    for (const line of referenceLines) {
      const ref: string | null = qrReference ? null : normalizeQrReference(line)
      if (ref) qrReference = ref
      else freeText.push(line)
    }

    const mandataire = sections.get('Mandataire') ?? []
    const ibanFromMandataire = mandataire.find((l) => /^\/C\/[A-Z]{2}\d{2}/.test(l))?.replace(/^\/C\//, '') ?? null
    const ibanLine = [...sections.values()].flat().find((l) => /^IBAN:\s*/.test(l))
    const counterpartyIban = (ibanLine?.replace(/^IBAN:\s*/, '') ?? ibanFromMandataire)?.replace(/\s/g, '') ?? null

    const mainText = descriptionParts.join(' ').replace(/\s+CHF$/, '')
    let counterparty =
      (direction === 'CREDIT' ? sections.get('Versé par')?.[0] : sections.get('Bénéficiaire')?.[0]) ??
      mandataire.find((l) => !l.startsWith('/C/')) ??
      null
    if (!counterparty) {
      const card = /^Paiement \d{2}\.\d{2}\.\d{4} \d{2}:\d{2} (.+?)(?: Numéro de carte.*)?$/.exec(mainText)
      if (card) counterparty = card[1]!.trim()
    }
    if (counterparty && /infomaniak/i.test(counterparty)) counterparty = 'Infomaniak'

    const transaction: ParsedTransaction = {
      bookingDate,
      valueDate: null,
      amountCents,
      direction,
      counterparty: counterparty?.slice(0, 255) ?? null,
      counterpartyIban: counterpartyIban && /^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(counterpartyIban) ? counterpartyIban : null,
      description: [mainText, ...freeText].filter(Boolean).join(' · ').slice(0, 2000),
      qrReference,
    }
    statement.transactions.push(transaction)
  }

  return statement
}

/** Extraction des éléments de texte positionnés d'un PDF (bibliothèque PDF.js via unpdf). */
export async function extractPdfItems(content: Uint8Array): Promise<TextItem[]> {
  const { getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(content)
  const items: TextItem[] = []
  for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 200); pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()
    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue
      items.push({ page: pageNumber, x: item.transform[4] as number, y: item.transform[5] as number, str: item.str })
    }
  }
  return items
}

export async function parseBcvsPdf(content: Uint8Array): Promise<ParsedStatement> {
  return parseBcvsPdfItems(await extractPdfItems(content))
}
