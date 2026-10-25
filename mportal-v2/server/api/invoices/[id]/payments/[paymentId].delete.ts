import { deletePayment } from '../../../../domain/invoices'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  const paymentId = parseId(event, 'paymentId')
  return useDb().transaction((tx) => deletePayment(tx, actor, id, paymentId))
})
