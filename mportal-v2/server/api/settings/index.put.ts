import { audit } from '../../domain/audit'
import { getSettings, updateSettings } from '../../domain/settings'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const input = await parseBody(event, settingsSchema)
  await updateSettings(useDb(), input)
  await audit(useDb(), actor, 'update', 'settings', null, input)
  return getSettings(useDb())
})
