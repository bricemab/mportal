import { createSubscription } from '../../domain/subscriptions'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const input = await parseBody(event, subscriptionSchema)
  return useDb().transaction((tx) => createSubscription(tx, actor, input))
})
