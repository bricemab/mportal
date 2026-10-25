import { badRequest } from '../../../domain/errors'
import { buildInvoicePdf } from '../../../domain/invoice-documents'
import { getInvoice } from '../../../domain/invoices'

/** PDF de la facture : version archivée si elle a été envoyée, sinon générée à la volée. */
export default defineEventHandler(async (event) => {
  const id = parseId(event)
  const invoice = await getInvoice(useDb(), id)
  if (invoice.pdfFile) {
    const content = await useFileStorage().read('invoices', invoice.pdfFile)
    return sendPdf(event, content, `Facture-${invoice.number}.pdf`)
  }
  if (!invoice.issueDate) throw badRequest('Émettez la facture avant de télécharger le PDF')
  const { content, fileName } = await buildInvoicePdf(useDb(), id, await usePdfAssets())
  return sendPdf(event, content, fileName)
})
