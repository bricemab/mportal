import { asc, eq } from 'drizzle-orm'
import type { DbOrTx } from '../db/client'
import { clients, invoiceLines } from '../db/schema'
import { badRequest } from './errors'
import { getInvoice } from './invoices'
import type { PdfAssets } from './pdf/common'
import { renderInvoicePdf } from './pdf/invoice-pdf'
import { getSettings } from './settings'

/** Génère le PDF d'une facture émise (date d'émission et échéance déjà figées). */
export async function buildInvoicePdf(db: DbOrTx, invoiceId: number, assets: PdfAssets): Promise<{ content: Buffer; fileName: string }> {
  const invoice = await getInvoice(db, invoiceId)
  if (!invoice.issueDate || !invoice.dueDate) throw badRequest('La facture doit être émise avant de générer le PDF')
  const [client] = await db.select().from(clients).where(eq(clients.id, invoice.clientId))
  if (!client) throw badRequest('Client introuvable')
  const lines = await db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, invoiceId))
    .orderBy(asc(invoiceLines.position), asc(invoiceLines.id))
  const settings = await getSettings(db)
  const content = await renderInvoicePdf(
    {
      number: invoice.number,
      qrReference: invoice.qrReference,
      title: invoice.title,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      totalCents: invoice.totalCents,
      client,
      lines,
    },
    settings,
    assets,
  )
  return { content, fileName: `Facture-${invoice.number}.pdf` }
}
