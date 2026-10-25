import { z } from 'zod'
import { listClients } from '../../domain/clients'

const querySchema = z.object({ q: z.string().trim().max(100).optional(), archived: z.enum(['0', '1']).optional() })

export default defineEventHandler(async (event) => {
  const query = parseQuery(event, querySchema)
  return listClients(useDb(), { q: query.q, archived: query.archived === '1' })
})
