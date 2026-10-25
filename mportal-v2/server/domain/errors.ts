import { createError } from 'h3'

export function badRequest(message: string, data?: Record<string, unknown>) {
  return createError({ statusCode: 400, statusMessage: 'Bad Request', message, data })
}

export function notFound(message = 'Élément introuvable') {
  return createError({ statusCode: 404, statusMessage: 'Not Found', message })
}

export function conflict(message: string) {
  return createError({ statusCode: 409, statusMessage: 'Conflict', message })
}

export function forbidden(message = 'Accès refusé') {
  return createError({ statusCode: 403, statusMessage: 'Forbidden', message })
}

export function unauthorized(message = 'Authentification requise') {
  return createError({ statusCode: 401, statusMessage: 'Unauthorized', message })
}

export function tooManyRequests(message: string) {
  return createError({ statusCode: 429, statusMessage: 'Too Many Requests', message })
}
