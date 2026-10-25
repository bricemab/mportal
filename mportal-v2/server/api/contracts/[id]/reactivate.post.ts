import { reactivateContract } from '../../../domain/contracts'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  return useDb().transaction((tx) => reactivateContract(tx, actor, id))
})
