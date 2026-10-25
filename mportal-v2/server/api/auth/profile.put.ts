import { eq } from 'drizzle-orm'
import { users } from '../../db/schema'
import { audit } from '../../domain/audit'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const input = await parseBody(event, profileSchema)
  const bankIban = input.bankIban ? input.bankIban.replace(/\s/g, '').toUpperCase() : null
  await useDb()
    .update(users)
    .set({ firstname: input.firstname, lastname: input.lastname, bankIban })
    .where(eq(users.id, actor.userId))
  const user = { ...actor.user, firstname: input.firstname, lastname: input.lastname }
  await setUserSession(event, { user })
  await audit(useDb(), actor, 'update', 'user', actor.userId, { firstname: input.firstname, lastname: input.lastname })
  return { user }
})
