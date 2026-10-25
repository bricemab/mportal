import { createInvoice } from '../../domain/invoices'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const input = await parseBody(event, invoiceSchema)
  return useDb().transaction((tx) => createInvoice(tx, actor, input))
})
