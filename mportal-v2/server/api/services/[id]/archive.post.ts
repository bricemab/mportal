import { z } from 'zod'
import { setServiceArchived } from '../../../domain/services'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const { archived } = await parseBody(event, z.object({ archived: z.boolean() }))
  return setServiceArchived(useDb(), actor, parseId(event), archived)
})
