import { updateSubscription } from '../../domain/subscriptions'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  const input = await parseBody(event, subscriptionSchema)
  return useDb().transaction((tx) => updateSubscription(tx, actor, id, input))
})
