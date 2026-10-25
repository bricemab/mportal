import { updateService } from '../../domain/services'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  return updateService(useDb(), actor, parseId(event), await parseBody(event, serviceSchema))
})
