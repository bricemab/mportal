import { writeOffInvoice } from '../../../domain/invoices'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  const { reason } = await parseBody(event, writeOffSchema)
  return useDb().transaction((tx) => writeOffInvoice(tx, actor, id, reason))
})
