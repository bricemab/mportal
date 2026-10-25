import { reactivateSubscription } from '../../../domain/subscriptions'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  return useDb().transaction((tx) => reactivateSubscription(tx, actor, id))
})
