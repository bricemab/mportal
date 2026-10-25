import { eq, sql } from 'drizzle-orm'
import { users } from '../../db/schema'
import { audit } from '../../domain/audit'

/** Invalide toutes les sessions de l'utilisateur (tous les navigateurs). */
export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  await useDb()
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, actor.userId))
  await audit(useDb(), actor, 'logout_all', 'user', actor.userId)
  await clearUserSession(event)
  return { ok: true }
})
