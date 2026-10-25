import { z } from 'zod'
import { listTransactions } from '../../../domain/bank/bank'

const querySchema = z.object({
  status: z.enum(['PENDING', 'MATCHED', 'IGNORED']).optional(),
  direction: z.enum(['CREDIT', 'DEBIT']).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
})

export default defineEventHandler(async (event) => listTransactions(useDb(), parseQuery(event, querySchema)))
