import { updateInvoice } from '../../domain/invoices'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const input = await parseBody(event, invoiceSchema)
  const id = parseId(event)
  return useDb().transaction((tx) => updateInvoice(tx, actor, id, input))
})
