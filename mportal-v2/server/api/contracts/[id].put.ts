import { updateContract } from '../../domain/contracts'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  const input = await parseBody(event, contractSchema)
  return useDb().transaction((tx) => updateContract(tx, actor, id, input))
})
