import { setContractFile } from '../../../domain/contracts'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  const previous = await useDb().transaction((tx) => setContractFile(tx, actor, id, null, null))
  if (previous) await useFileStorage().remove('contracts', previous)
  return { ok: true }
})
