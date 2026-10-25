import { endSubscription } from '../../../domain/subscriptions'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  const { endDate } = await parseBody(event, endSchema)
  return useDb().transaction((tx) => endSubscription(tx, actor, id, endDate))
})
