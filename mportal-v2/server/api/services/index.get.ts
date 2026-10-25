import { z } from 'zod'
import { listServices } from '../../domain/services'

export default defineEventHandler(async (event) => {
  const { all } = parseQuery(event, z.object({ all: z.enum(['0', '1']).optional() }))
  return listServices(useDb(), all === '1')
})
