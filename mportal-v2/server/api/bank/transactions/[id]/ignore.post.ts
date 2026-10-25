import { z } from 'zod'
import { ignoreTransaction } from '../../../../domain/bank/bank'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  const { note } = await parseBody(event, z.object({ note: z.string().trim().max(255).nullish().transform((v) => v || null) }))
  await useDb().transaction((tx) => ignoreTransaction(tx, actor, id, note))
  return { ok: true }
})
