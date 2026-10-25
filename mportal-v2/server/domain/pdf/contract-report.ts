import type { DbOrTx } from '../../db/client'
import { formatDateCh } from '../../../shared/utils/dates'
import { getContractDetail } from '../contracts'
import { notFound } from '../errors'
import { getSettings } from '../settings'
import { createDocument, drawHeader, drawSeparator, drawTableHeader, PAGE, renderToBuffer, type PdfAssets } from './common'

const COLUMNS = [
  { label: 'Date', x: 60, width: 70 },
  { label: 'Description', x: 135, width: 330 },
  { label: 'Heures', x: 470, width: 65, align: 'right' as const },
]

function hours(value: number): string {
  return `${value.toFixed(2).replace(/\.00$/, '')} h`
}

/** Rapport d'heures d'une période de contrat de maintenance, à remettre au client. */
export async function buildContractReport(db: DbOrTx, contractId: number, periodId: number, assets: PdfAssets) {
  const detail = await getContractDetail(db, contractId)
  const period = detail.periods.find((p) => p.id === periodId)
  if (!period) throw notFound('Période introuvable')
  const settings = await getSettings(db)

  const doc = createDocument(assets, `Rapport ${detail.contract.name}`)
  drawHeader(doc, assets, 'RAPPORT D’HEURES', {
    name: settings.COMPANY_NAME,
    holder: settings.COMPANY_HOLDER,
    street: settings.COMPANY_STREET,
    streetNumber: settings.COMPANY_STREET_NUMBER,
    postalCode: settings.COMPANY_POSTAL_CODE,
    city: settings.COMPANY_CITY,
    email: settings.COMPANY_EMAIL,
  })

  const top = 220
  doc.font('Outfit-Bold').fontSize(9).text('CLIENT', PAGE.left, top)
  doc.font('Outfit').text(detail.client?.name ?? '', PAGE.left, top + 15)
  doc
    .text(`Contrat : ${detail.contract.name}`, 300, top, { width: PAGE.right - 300, align: 'right' })
    .text(`Période : ${formatDateCh(period.startDate)} – ${formatDateCh(period.endDate)}`, 300, top + 15, { width: PAGE.right - 300, align: 'right' })

  const summaryTop = 275
  doc.font('Outfit-Bold').fontSize(10)
  doc.text(`Heures incluses : ${hours(period.hoursQuota)}`, PAGE.left, summaryTop)
  doc.text(`Heures utilisées : ${hours(period.usedHours)}`, PAGE.left + 170, summaryTop)
  doc.text(`Heures restantes : ${hours(period.remainingHours)}`, PAGE.left + 340, summaryTop)

  let y = drawTableHeader(doc, 305, COLUMNS)
  doc.font('Outfit').fontSize(9)
  const entries = [...period.entries].sort((a, b) => a.date.localeCompare(b.date))
  if (entries.length === 0) {
    doc.text('Aucune intervention sur cette période.', COLUMNS[1]!.x, y + 6)
    y += 22
  }
  for (const entry of entries) {
    const height = Math.max(20, doc.heightOfString(entry.description, { width: COLUMNS[1]!.width }) + 10)
    if (y + height > PAGE.bottom) {
      doc.addPage()
      y = drawTableHeader(doc, 50, COLUMNS)
      doc.font('Outfit').fontSize(9)
    }
    doc.text(formatDateCh(entry.date), COLUMNS[0]!.x, y + 5, { width: COLUMNS[0]!.width })
    doc.text(entry.description, COLUMNS[1]!.x, y + 5, { width: COLUMNS[1]!.width })
    doc.text(hours(entry.hours), COLUMNS[2]!.x, y + 5, { width: COLUMNS[2]!.width, align: 'right' })
    y += height
    drawSeparator(doc, y)
  }

  const content = await renderToBuffer(doc)
  const safeName = detail.contract.name.replace(/[^\w-]+/g, '_').slice(0, 60)
  return { content, fileName: `Rapport_${safeName}_${period.startDate}.pdf` }
}
