import { buildInvoicePdf } from '../../../domain/invoice-documents'
import { issueInvoice, markInvoiceSent } from '../../../domain/invoices'

/** Marque la facture comme envoyée et archive le PDF exact transmis au client. */
export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  const db = useDb()
  await db.transaction((tx) => issueInvoice(tx, actor, id))
  const { content } = await buildInvoicePdf(db, id, await usePdfAssets())
  const storage = useFileStorage()
  const fileName = await storage.save('invoices', `facture-${id}`, 'pdf', content)
  try {
    return await db.transaction((tx) => markInvoiceSent(tx, actor, id, fileName))
  } catch (error) {
    await storage.remove('invoices', fileName)
    throw error
  }
})
