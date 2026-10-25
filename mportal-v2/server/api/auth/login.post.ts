import { getHeader } from 'h3'
import { audit } from '../../domain/audit'
import { authenticate } from '../../domain/auth'

export default defineEventHandler(async (event) => {
  const input = await parseBody(event, loginSchema)
  const ip = clientIp(event)
  const { user, sessionVersion } = await authenticate(useDb(), {
    ...input,
    ip,
    userAgent: getHeader(event, 'user-agent') ?? 'unknown',
  })
  // Nouvelle session à chaque connexion (pas de fixation de session)
  await replaceUserSession(event, {
    user,
    secure: { sessionVersion },
    loggedInAt: new Date().toISOString(),
  })
  await audit(useDb(), { userId: user.id, ip }, 'login', 'user', user.id)
  return { user }
})
