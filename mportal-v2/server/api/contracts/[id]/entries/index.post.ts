import { addTimeEntry } from '../../../../domain/contracts'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  const input = await parseBody(event, timeEntrySchema)
  await useDb().transaction((tx) => addTimeEntry(tx, actor, id, input))
  return { ok: true }
})
