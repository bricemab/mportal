import { deleteTimeEntry } from '../../../../domain/contracts'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  const entryId = parseId(event, 'entryId')
  await useDb().transaction((tx) => deleteTimeEntry(tx, actor, id, entryId))
  return { ok: true }
})
