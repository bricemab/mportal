import { deleteExpense } from '../../domain/expenses'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  await useDb().transaction((tx) => deleteExpense(tx, actor, id))
  return { ok: true }
})
