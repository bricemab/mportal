import { createService } from '../../domain/services'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  return createService(useDb(), actor, await parseBody(event, serviceSchema))
})
