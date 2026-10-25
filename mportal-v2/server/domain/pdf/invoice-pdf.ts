import { SwissQRBill } from 'swissqrbill/pdf'
import type { Data } from 'swissqrbill/types'
import { formatDateCh } from '../../../shared/utils/dates'
import { formatAmount, lineTotalCents } from '../../../shared/utils/money'
import type { SettingsMap } from '../settings'
import { createDocument, drawHeader, drawSeparator, drawTableHeader, PAGE, renderToBuffer, type PdfAssets } from './common'

export interface InvoicePdfInput {
  number: number
  qrReference: string
  title: string
  issueDate: string
  dueDate: string
  totalCents: number
  client: {
    name: string
    firstname: string | null
    lastname: string | null
    street: string | null
    streetNumber: string | null
    postalCode: string | null
    city: string | null
    country: string
  }
  lines: ReadonlyArray<{ label: string; quantity: number; unitPriceCents: number }>
}

const COLUMNS = [
  { label: 'Description', x: 60, width: 250 },
  { label: 'Quantité', x: 310, width: 55, align: 'right' as const },
  { label: 'Prix', x: 370, width: 80, align: 'right' as const },
  { label: 'Montant', x: 455, width: 80, align: 'right' as const },
]

function formatQuantity(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toFixed(2)
}

export function buildQrBillData(input: InvoicePdfInput, settings: SettingsMap): Data {
  const c = input.client
  const data: Data = {
    amount: input.totalCents / 100,
    currency: 'CHF',
    reference: input.qrReference,
    creditor: {
      account: settings.QR_IBAN,
      name: settings.COMPANY_HOLDER,
      address: settings.COMPANY_STREET,
      buildingNumber: settings.COMPANY_STREET_NUMBER || undefined,
      zip: settings.COMPANY_POSTAL_CODE,
      city: settings.COMPANY_CITY,
      country: settings.COMPANY_COUNTRY,
    },
  }
  // Le débiteur est facultatif dans le standard : on ne l'ajoute que si l'adresse est complète
  if (c.street && c.postalCode && c.city) {
    data.debtor = {
      name: c.name.slice(0, 70),
      address: c.street.slice(0, 70),
      buildingNumber: c.streetNumber ?? undefined,
      zip: c.postalCode,
      city: c.city.slice(0, 35),
      country: c.country,
    }
  }
  return data
}

export async function renderInvoicePdf(input: InvoicePdfInput, settings: SettingsMap, assets: PdfAssets): Promise<Buffer> {
  const doc = createDocument(assets, `Facture ${input.number}`)
  const company = {
    name: settings.COMPANY_NAME,
    holder: settings.COMPANY_HOLDER,
    street: settings.COMPANY_STREET,
    streetNumber: settings.COMPANY_STREET_NUMBER,
    postalCode: settings.COMPANY_POSTAL_CODE,
    city: settings.COMPANY_CITY,
    email: settings.COMPANY_EMAIL,
  }
  drawHeader(doc, assets, 'FACTURE', company)

  // Client et références
  const infoTop = 220
  const c = input.client
  doc.font('Outfit-Bold').fontSize(9).text('FACTURÉ À', PAGE.left, infoTop)
  doc.font('Outfit')
  const clientLines = [
    c.name,
    [c.firstname, c.lastname].filter(Boolean).join(' ') && c.name !== [c.firstname, c.lastname].filter(Boolean).join(' ')
      ? [c.firstname, c.lastname].filter(Boolean).join(' ')
      : null,
    c.street ? `${c.street} ${c.streetNumber ?? ''}`.trim() : null,
    c.postalCode || c.city ? `${c.postalCode ?? ''} ${c.city ?? ''}`.trim() : null,
  ].filter((l): l is string => Boolean(l))
  clientLines.forEach((line, i) => doc.text(line, PAGE.left, infoTop + 15 + i * 13, { width: 240 }))

  doc
    .text(`Facture N° : ${input.number}`, 300, infoTop, { width: PAGE.right - 300, align: 'right' })
    .text(`Date : ${formatDateCh(input.issueDate)}`, 300, infoTop + 15, { width: PAGE.right - 300, align: 'right' })
    .text(`Échéance : ${formatDateCh(input.dueDate)}`, 300, infoTop + 30, { width: PAGE.right - 300, align: 'right' })

  doc.font('Outfit-Bold').fontSize(11).text(input.title, PAGE.left, 300, { width: PAGE.width })

  // Tableau des lignes, avec saut de page si nécessaire
  let y = drawTableHeader(doc, Math.max(doc.y + 10, 325), COLUMNS)
  doc.font('Outfit').fontSize(9)
  for (const line of input.lines) {
    const labelHeight = doc.heightOfString(line.label, { width: COLUMNS[0]!.width })
    const rowHeight = Math.max(20, labelHeight + 10)
    if (y + rowHeight > PAGE.bottom - 40) {
      doc.addPage()
      y = drawTableHeader(doc, 50, COLUMNS)
      doc.font('Outfit').fontSize(9)
    }
    doc.text(line.label, COLUMNS[0]!.x, y + 5, { width: COLUMNS[0]!.width })
    doc.text(formatQuantity(line.quantity), COLUMNS[1]!.x, y + 5, { width: COLUMNS[1]!.width, align: 'right' })
    doc.text(`${formatAmount(line.unitPriceCents)} CHF`, COLUMNS[2]!.x, y + 5, { width: COLUMNS[2]!.width, align: 'right' })
    doc.text(`${formatAmount(lineTotalCents(line.quantity, line.unitPriceCents))} CHF`, COLUMNS[3]!.x, y + 5, {
      width: COLUMNS[3]!.width,
      align: 'right',
    })
    y += rowHeight
    drawSeparator(doc, y)
  }

  if (y + 40 > PAGE.bottom) {
    doc.addPage()
    y = 50
  }
  const totalY = y + 10
  drawSeparator(doc, totalY - 3, '#000000', 1)
  doc
    .font('Outfit-Bold')
    .fontSize(9)
    .text('TOTAL À PAYER (CHF)', 260, totalY + 2, { width: 190, align: 'right' })
    .text(`${formatAmount(input.totalCents)} CHF`, COLUMNS[3]!.x, totalY + 2, { width: COLUMNS[3]!.width, align: 'right' })
  drawSeparator(doc, totalY + 16, '#000000', 1)

  // Bulletin QR : sur la même page s'il y a la place, sinon sur une nouvelle page
  const qrBill = new SwissQRBill(buildQrBillData(input, settings), { language: 'FR', fontName: 'Helvetica' })
  qrBill.attachTo(doc)

  return renderToBuffer(doc)
}
