import { z } from 'zod'
import { linkTransactionToExpense } from '../../../../domain/bank/bank'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  const { expenseId } = await parseBody(event, z.object({ expenseId: idSchema }))
  await useDb().transaction((tx) => linkTransactionToExpense(tx, actor, id, expenseId))
  return { ok: true }
})
