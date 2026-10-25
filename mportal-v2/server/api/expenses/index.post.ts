import { createExpense } from '../../domain/expenses'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  return createExpense(useDb(), actor, await parseBody(event, expenseSchema))
})
