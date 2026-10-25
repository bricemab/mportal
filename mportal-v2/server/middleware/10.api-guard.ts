import { getHeader, getRequestHost } from 'h3'
import { isSessionValid } from '../domain/auth'
import { forbidden, unauthorized } from '../domain/errors'

const PUBLIC_API = new Set(['/api/auth/login', '/api/health', '/api/_auth/session'])
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Protection de toutes les routes /api :
 * 1. requêtes modifiantes : l'origine doit être l'application elle-même (anti-CSRF, en plus du cookie SameSite=Strict) ;
 * 2. session obligatoire, et révocable (version de session comparée à la base).
 */
export default defineEventHandler(async (event) => {
  const path = event.path.split('?')[0] ?? ''
  if (!path.startsWith('/api/')) return

  // La tâche planifiée s'authentifie avec son propre secret (voir /api/cron/*)
  if (path.startsWith('/api/cron/')) return

  if (!SAFE_METHODS.has(event.method)) {
    const expectedHost = getRequestHost(event, { xForwardedHost: true })
    const origin = getHeader(event, 'origin')
    if (origin) {
      let originHost = ''
      try {
        originHost = new URL(origin).host
      } catch {
        throw forbidden('Origine invalide')
      }
      if (originHost !== expectedHost) throw forbidden('Origine refusée')
    } else if (getHeader(event, 'sec-fetch-site') !== 'same-origin') {
      throw forbidden('Origine manquante')
    }
  }

  if (path === '/api/_auth/session' && event.method === 'GET') {
    // Lecture de session par l'application : une session révoquée est effacée avant d'être renvoyée
    const current = await getUserSession(event)
    const v = current.secure?.sessionVersion
    if (current.user && !(typeof v === 'number' && (await isSessionValid(useDb(), { id: current.user.id, email: current.user.email, version: v })))) {
      await clearUserSession(event)
    }
    return
  }
  if (PUBLIC_API.has(path)) return

  const session = await getUserSession(event)
  const user = session.user
  const version = session.secure?.sessionVersion
  if (!user || typeof version !== 'number') throw unauthorized()

  if (!(await isSessionValid(useDb(), { id: user.id, email: user.email, version }))) {
    await clearUserSession(event)
    throw unauthorized('Session expirée, reconnectez-vous')
  }

  event.context.actor = {
    userId: user.id,
    user,
    ip: clientIp(event),
  }
})
