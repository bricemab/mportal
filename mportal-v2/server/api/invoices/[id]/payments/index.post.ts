import { addPayment } from '../../../../domain/invoices'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  const input = await parseBody(event, paymentSchema)
  return useDb().transaction((tx) => addPayment(tx, actor, id, input))
})
