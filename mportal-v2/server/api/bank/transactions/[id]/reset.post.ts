import { resetTransaction } from '../../../../domain/bank/bank'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  await useDb().transaction((tx) => resetTransaction(tx, actor, id))
  return { ok: true }
})
