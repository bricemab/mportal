import { addPeriodToContract } from '../../../domain/contracts'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  const input = await parseBody(event, periodSchema)
  return useDb().transaction((tx) => addPeriodToContract(tx, actor, id, input))
})
