import { generateNow } from '../../../domain/subscriptions'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  return generateNow(useDb(), actor, parseId(event))
})
