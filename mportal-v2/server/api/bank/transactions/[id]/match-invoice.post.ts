import { z } from 'zod'
import { matchTransactionToInvoice } from '../../../../domain/bank/bank'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  const { invoiceId } = await parseBody(event, z.object({ invoiceId: idSchema }))
  await useDb().transaction((tx) => matchTransactionToInvoice(tx, actor, id, invoiceId))
  return { ok: true }
})
