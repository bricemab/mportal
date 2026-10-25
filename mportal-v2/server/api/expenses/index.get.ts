import { z } from 'zod'
import { listExpenses } from '../../domain/expenses'

const querySchema = z.object({
  q: z.string().trim().max(100).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  category: z.enum(['DOMAIN', 'HOSTING', 'VPS', 'EMAIL', 'SOFTWARE', 'HARDWARE', 'OTHER']).optional(),
  unmatched: z.enum(['0', '1']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})

export default defineEventHandler(async (event) => {
  const q = parseQuery(event, querySchema)
  return listExpenses(useDb(), { ...q, unmatched: q.unmatched === '1' })
})
