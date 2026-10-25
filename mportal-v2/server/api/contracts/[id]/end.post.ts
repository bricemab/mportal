import { endContract } from '../../../domain/contracts'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  const { endDate } = await parseBody(event, endSchema)
  return useDb().transaction((tx) => endContract(tx, actor, id, endDate))
})
