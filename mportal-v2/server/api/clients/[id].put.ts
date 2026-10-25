import { updateClient } from '../../domain/clients'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const input = await parseBody(event, clientSchema)
  return updateClient(useDb(), actor, parseId(event), input)
})
