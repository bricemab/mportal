import { z } from 'zod'
import { createExpenseFromTransaction } from '../../../../domain/bank/bank'

const schema = z.object({
  category: z.enum(['DOMAIN', 'HOSTING', 'VPS', 'EMAIL', 'SOFTWARE', 'HARDWARE', 'OTHER']),
  label: z.string().trim().min(1).max(255),
  supplier: z.string().trim().max(100).nullish().transform((v) => v || null),
  clientId: idSchema.nullish().transform((v) => v ?? null),
  invoiceId: idSchema.nullish().transform((v) => v ?? null),
})

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  const input = await parseBody(event, schema)
  return useDb().transaction((tx) => createExpenseFromTransaction(tx, actor, id, input))
})
