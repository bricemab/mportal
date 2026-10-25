import { z } from 'zod'
import { classifyTransaction } from '../../../../domain/bank/bank'

const schema = z.object({
  kind: z.enum(['PARTNER_WITHDRAWAL', 'OTHER']),
  partnerUserId: idSchema.nullish().transform((v) => v ?? null),
  note: z.string().trim().max(255).nullish().transform((v) => v || null),
})

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  const input = await parseBody(event, schema)
  await useDb().transaction((tx) => classifyTransaction(tx, actor, id, input))
  return { ok: true }
})
