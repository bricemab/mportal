import { z } from 'zod'
import { setClientArchived } from '../../../domain/clients'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const { archived } = await parseBody(event, z.object({ archived: z.boolean() }))
  return setClientArchived(useDb(), actor, parseId(event), archived)
})
