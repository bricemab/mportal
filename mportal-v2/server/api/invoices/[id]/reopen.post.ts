import { reopenInvoice } from '../../../domain/invoices'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  return useDb().transaction((tx) => reopenInvoice(tx, actor, id))
})
