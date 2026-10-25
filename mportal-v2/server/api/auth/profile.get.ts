import { eq } from 'drizzle-orm'
import { users } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const [user] = await useDb()
    .select({
      id: users.id,
      email: users.email,
      firstname: users.firstname,
      lastname: users.lastname,
      bankIban: users.bankIban,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(eq(users.id, actor.userId))
  return user
})
