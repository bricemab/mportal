import { z } from 'zod'
import { listInvoices } from '../../domain/invoices'

const querySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['DRAFT', 'ISSUED', 'SENT', 'OVERDUE', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'WRITTEN_OFF', 'OPEN']).optional(),
  clientId: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  sort: z.enum(['number_desc', 'number_asc', 'amount_desc', 'amount_asc', 'due_asc']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})

export default defineEventHandler(async (event) => listInvoices(useDb(), parseQuery(event, querySchema)))
