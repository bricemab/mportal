import { z } from 'zod'
import { listSubscriptions } from '../../domain/subscriptions'

const querySchema = z.object({
  status: z.enum(['ACTIVE', 'ENDED']).optional(),
  clientId: z.coerce.number().int().positive().optional(),
})

export default defineEventHandler(async (event) => listSubscriptions(useDb(), parseQuery(event, querySchema)))
