import { isSessionValid } from '../domain/auth'

const SKIP = /^\/(api|_nuxt|__nuxt|_ipx|favicon\.ico|logo\.svg)/

/**
 * Au rendu d'une page, une session révoquée (mot de passe changé, déconnexion globale, compte supprimé)
 * est effacée immédiatement : l'application redirige alors vers la connexion au lieu d'afficher une page vide.
 */
export default defineEventHandler(async (event) => {
  if (event.method !== 'GET' || SKIP.test(event.path)) return
  const session = await getUserSession(event)
  const user = session.user
  if (!user) return
  const version = session.secure?.sessionVersion
  const valid = typeof version === 'number' && (await isSessionValid(useDb(), { id: user.id, email: user.email, version }))
  if (!valid) await clearUserSession(event)
})
