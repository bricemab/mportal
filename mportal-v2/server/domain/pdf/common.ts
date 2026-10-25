import PDFDocument from 'pdfkit'

export interface PdfAssets {
  logo: Buffer
  fontRegular: Buffer
  fontBold: Buffer
}

export const PAGE = { left: 50, right: 545, width: 495, bottom: 780 } as const

export function createDocument(assets: PdfAssets, title: string): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    autoFirstPage: true,
    info: { Title: title, Author: 'MDevelopment', Producer: 'MPortal' },
  })
  doc.registerFont('Outfit', assets.fontRegular)
  doc.registerFont('Outfit-Bold', assets.fontBold)
  doc.font('Outfit')
  return doc
}

export function renderToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}

export interface CompanyBlock {
  name: string
  holder: string
  street: string
  streetNumber: string
  postalCode: string
  city: string
  email: string
}

/** En-tête commun : logo à gauche, titre et coordonnées de la société à droite. */
export function drawHeader(doc: PDFKit.PDFDocument, assets: PdfAssets, title: string, company: CompanyBlock): void {
  doc.image(assets.logo, PAGE.left - 10, 110, { width: 100 })
  doc.font('Outfit-Bold').fontSize(20).fillColor('black').text(title, 300, 50, { width: PAGE.right - 300, align: 'right' })
  doc
    .fontSize(9)
    .font('Outfit-Bold')
    .text(company.name, 300, 120, { width: PAGE.right - 300, align: 'right' })
    .font('Outfit')
    .text(company.holder, { width: PAGE.right - 300, align: 'right' })
    .text(`${company.street} ${company.streetNumber}`.trim(), { width: PAGE.right - 300, align: 'right' })
    .text(`${company.postalCode} ${company.city}`, { width: PAGE.right - 300, align: 'right' })
  if (company.email) doc.text(company.email, { width: PAGE.right - 300, align: 'right' })
}

export function drawTableHeader(doc: PDFKit.PDFDocument, y: number, columns: ReadonlyArray<{ label: string; x: number; width: number; align?: 'left' | 'right' }>): number {
  const height = 20
  doc.rect(PAGE.left, y, PAGE.width, height).fill('#eeeeee')
  doc.fillColor('black').font('Outfit-Bold').fontSize(9)
  for (const col of columns) {
    doc.text(col.label, col.x, y + 6, { width: col.width, align: col.align ?? 'left' })
  }
  doc.font('Outfit')
  return y + height
}

export function drawSeparator(doc: PDFKit.PDFDocument, y: number, color = '#cccccc', width = 0.5): void {
  doc.moveTo(PAGE.left, y).lineTo(PAGE.right, y).strokeColor(color).lineWidth(width).stroke()
}
