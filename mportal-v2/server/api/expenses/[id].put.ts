import { updateExpense } from '../../domain/expenses'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  return updateExpense(useDb(), actor, parseId(event), await parseBody(event, expenseSchema))
})
