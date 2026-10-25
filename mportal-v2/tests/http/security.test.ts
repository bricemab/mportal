import { describe, expect, it } from 'vitest'

/**
 * Tests de sécurité HTTP contre un serveur démarré (dev ou production).
 * Usage : SMOKE_BASE_URL=http://127.0.0.1:3000 npm test -- tests/http
 */
const BASE = process.env.SMOKE_BASE_URL

describe.skipIf(!BASE)('sécurité HTTP', () => {
  const url = (path: string) => `${BASE}${path}`
  const origin = BASE ?? ''

  it('expose un endpoint de santé public', async () => {
    const res = await fetch(url('/api/health'))
    expect(res.status).toBe(200)
  })

  it('refuse l’accès aux API sans session', async () => {
    for (const path of ['/api/clients', '/api/invoices', '/api/dashboard', '/api/settings', '/api/audit', '/api/bank/transactions']) {
      const res = await fetch(url(path))
      expect(res.status, path).toBe(401)
    }
  })

  it('refuse les requêtes modifiantes sans origine ou d’une autre origine (CSRF)', async () => {
    const body = JSON.stringify({ email: 'x@example.ch', password: 'x' })
    const noOrigin = await fetch(url('/api/auth/login'), { method: 'POST', headers: { 'content-type': 'application/json' }, body })
    expect(noOrigin.status).toBe(403)
    const evil = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://attaquant.example' },
      body,
    })
    expect(evil.status).toBe(403)
  })

  it('protège la tâche planifiée par un secret', async () => {
    expect((await fetch(url('/api/cron/daily'), { method: 'POST' })).status).toBe(401)
    expect((await fetch(url('/api/cron/daily?token=mauvais'))).status).toBe(401)
  })

  it('valide les entrées de connexion', async () => {
    const res = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({ email: 'pas-un-email', password: '' }),
    })
    expect(res.status).toBe(400)
  })

  it('envoie les en-têtes de sécurité sur les pages', async () => {
    const res = await fetch(url('/login'))
    expect(res.status).toBe(200)
    const csp = res.headers.get('content-security-policy') ?? ''
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toMatch(/script-src[^;]*'nonce-/)
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-eval'/)
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('referrer-policy')).toBe('no-referrer')
    expect(res.headers.get('x-powered-by')).toBeNull()
  })

  it('ne divulgue pas de détails sur une route inconnue', async () => {
    const res = await fetch(url('/api/inexistant'))
    expect([401, 404]).toContain(res.status)
  })
})
