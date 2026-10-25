import type { H3Event } from 'h3'
import { getQuery, getRequestIP, getRouterParam, readBody } from 'h3'
import type { ZodType } from 'zod'
import type { Actor } from '../domain/audit'
import type { SessionUser } from '../domain/auth'
import { badRequest, unauthorized } from '../domain/errors'

export interface RequestActor extends Actor {
  userId: number
  user: SessionUser
}

export function clientIp(event: H3Event): string {
  return getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
}

function zodError(error: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }> }) {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_'
    fields[key] ??= issue.message
  }
  const first = Object.entries(fields)[0]
  return badRequest(first ? `${first[1]}${first[0] !== '_' ? ` (${first[0]})` : ''}` : 'Données invalides', { fields })
}

export async function parseBody<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  const body: unknown = await readBody(event)
  const result = schema.safeParse(body)
  if (!result.success) throw zodError(result.error)
  return result.data
}

export function parseQuery<T>(event: H3Event, schema: ZodType<T>): T {
  const result = schema.safeParse(getQuery(event))
  if (!result.success) throw zodError(result.error)
  return result.data
}

export function parseId(event: H3Event, name = 'id'): number {
  const raw = getRouterParam(event, name)
  const id = Number(raw)
  if (!raw || !Number.isSafeInteger(id) || id <= 0) throw badRequest('Identifiant invalide')
  return id
}

/** Utilisateur authentifié de la requête (posé par le middleware serveur). */
export function requireActor(event: H3Event): RequestActor {
  const actor = event.context.actor as RequestActor | undefined
  if (!actor) throw unauthorized()
  return actor
}
