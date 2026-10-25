import { updateTimeEntry } from '../../../../domain/contracts'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  const entryId = parseId(event, 'entryId')
  const input = await parseBody(event, timeEntrySchema)
  await useDb().transaction((tx) => updateTimeEntry(tx, actor, id, entryId, input))
  return { ok: true }
})
