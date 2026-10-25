import { deleteDraftInvoice } from '../../domain/invoices'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  await useDb().transaction((tx) => deleteDraftInvoice(tx, actor, id))
  return { ok: true }
})
