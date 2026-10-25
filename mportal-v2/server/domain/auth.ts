import bcrypt from 'bcryptjs'
import { and, count, eq, gte, sql } from 'drizzle-orm'
import type { DbOrTx } from '../db/client'
import { loginAttempts, users } from '../db/schema'
import { badRequest, tooManyRequests, unauthorized } from './errors'

export const BCRYPT_ROUNDS = 12
const MAX_FAILURES_PER_EMAIL = 5
const MAX_FAILURES_PER_IP = 20
const WINDOW_MINUTES = 30

// Hash factice pour que la durée de réponse soit la même que l'email existe ou non
let dummyHash: string | null = null
function getDummyHash(): string {
  dummyHash ??= bcrypt.hashSync('mportal-dummy-password', BCRYPT_ROUNDS)
  return dummyHash
}

export interface SessionUser {
  id: number
  email: string
  firstname: string
  lastname: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

async function recentFailures(db: DbOrTx, column: 'email' | 'ip', value: string, since: Date): Promise<number> {
  const target = column === 'email' ? loginAttempts.email : loginAttempts.ip
  const [row] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(and(eq(target, value), eq(loginAttempts.success, false), gte(loginAttempts.createdAt, since)))
  return row?.n ?? 0
}

/**
 * Vérifie les identifiants avec limitation des tentatives :
 * 5 échecs par email ou 20 par IP sur 30 minutes bloquent la connexion pendant 30 minutes.
 */
export async function authenticate(
  db: DbOrTx,
  input: { email: string; password: string; ip: string; userAgent: string },
  now: Date = new Date(),
): Promise<{ user: SessionUser; sessionVersion: number }> {
  const since = new Date(now.getTime() - WINDOW_MINUTES * 60_000)
  const email = input.email.trim().toLowerCase()

  const [byEmail, byIp] = await Promise.all([
    recentFailures(db, 'email', email, since),
    recentFailures(db, 'ip', input.ip, since),
  ])
  if (byEmail >= MAX_FAILURES_PER_EMAIL || byIp >= MAX_FAILURES_PER_IP) {
    throw tooManyRequests('Trop de tentatives. Réessayez dans 30 minutes.')
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? getDummyHash())

  await db.insert(loginAttempts).values({
    email,
    ip: input.ip.slice(0, 64),
    userAgent: input.userAgent.slice(0, 255),
    success: Boolean(user && valid),
    createdAt: now,
  })

  if (!user || !valid) {
    throw unauthorized('Email ou mot de passe incorrect')
  }

  // Réhachage transparent des anciens hash (coût plus faible) au coût actuel
  const currentRounds = bcrypt.getRounds(user.passwordHash)
  const set: Partial<typeof users.$inferInsert> = { lastLoginAt: now }
  if (currentRounds < BCRYPT_ROUNDS) set.passwordHash = await hashPassword(input.password)
  await db.update(users).set(set).where(eq(users.id, user.id))

  return {
    user: { id: user.id, email: user.email, firstname: user.firstname, lastname: user.lastname },
    sessionVersion: user.sessionVersion,
  }
}

export async function changePassword(db: DbOrTx, userId: number, currentPassword: string, newPassword: string): Promise<number> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) throw unauthorized()
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw badRequest('Mot de passe actuel incorrect')
  }
  if (currentPassword === newPassword) throw badRequest('Le nouveau mot de passe doit être différent')
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, userId))
  const [updated] = await db.select({ v: users.sessionVersion }).from(users).where(eq(users.id, userId))
  return updated?.v ?? user.sessionVersion + 1
}

/** Retourne la version de session courante de l'utilisateur, ou null s'il n'existe plus. */
export async function getSessionVersion(db: DbOrTx, userId: number): Promise<number | null> {
  const [row] = await db.select({ v: users.sessionVersion }).from(users).where(eq(users.id, userId)).limit(1)
  return row?.v ?? null
}

/**
 * Une session n'est valide que si l'utilisateur existe toujours avec le même email et la même version :
 * un identifiant réattribué (base recréée) ou un mot de passe changé invalide la session.
 */
export async function isSessionValid(db: DbOrTx, session: { id: number; email: string; version: number }): Promise<boolean> {
  const [row] = await db.select({ v: users.sessionVersion, email: users.email }).from(users).where(eq(users.id, session.id)).limit(1)
  return Boolean(row && row.v === session.version && row.email === session.email)
}

/** Purge des tentatives de connexion de plus de 90 jours. */
export async function purgeLoginAttempts(db: DbOrTx, now: Date = new Date()): Promise<void> {
  const limit = new Date(now.getTime() - 90 * 86_400_000)
  await db.delete(loginAttempts).where(sql`${loginAttempts.createdAt} < ${limit}`)
}
