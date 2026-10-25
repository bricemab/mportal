import { createContract } from '../../domain/contracts'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const input = await parseBody(event, contractSchema)
  return useDb().transaction((tx) => createContract(tx, actor, input))
})
