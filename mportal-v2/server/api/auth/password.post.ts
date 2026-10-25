import { audit } from '../../domain/audit'
import { changePassword } from '../../domain/auth'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const input = await parseBody(event, changePasswordSchema)
  const sessionVersion = await changePassword(useDb(), actor.userId, input.currentPassword, input.newPassword)
  // Les autres sessions sont invalidées ; celle-ci est renouvelée
  await replaceUserSession(event, {
    user: actor.user,
    secure: { sessionVersion },
    loggedInAt: new Date().toISOString(),
  })
  await audit(useDb(), actor, 'password_change', 'user', actor.userId)
  return { ok: true }
})
