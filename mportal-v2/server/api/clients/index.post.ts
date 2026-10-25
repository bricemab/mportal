import { createClient } from '../../domain/clients'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const input = await parseBody(event, clientSchema)
  return createClient(useDb(), actor, input)
})
