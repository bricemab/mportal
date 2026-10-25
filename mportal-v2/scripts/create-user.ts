import { createInterface } from 'node:readline/promises'
import { eq } from 'drizzle-orm'
import { users } from '../server/db/schema'
import { hashPassword } from '../server/domain/auth'
import { passwordSchema } from '../shared/utils/schemas'
import { openTargetDb } from './lib'

/**
 * Crée un utilisateur ou réinitialise son mot de passe.
 * Usage : npm run user:create -- email@exemple.ch Prénom Nom
 * Le mot de passe est demandé de façon interactive (ou lu dans MPORTAL_PASSWORD), jamais passé en argument.
 */
const [email, firstname, lastname] = process.argv.slice(2)
if (!email || !firstname || !lastname) {
  console.error('Usage : npm run user:create -- email@exemple.ch Prénom Nom')
  process.exit(1)
}

let password = process.env.MPORTAL_PASSWORD
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  password = await rl.question('Mot de passe (12 caractères min., majuscule, minuscule, chiffre) : ')
  rl.close()
}
const check = passwordSchema.safeParse(password)
if (!check.success) {
  console.error(check.error.issues.map((i) => i.message).join(', '))
  process.exit(1)
}

const { db, pool } = await openTargetDb()
try {
  const normalized = email.trim().toLowerCase()
  const passwordHash = await hashPassword(password)
  const [existing] = await db.select().from(users).where(eq(users.email, normalized))
  if (existing) {
    await db
      .update(users)
      .set({ passwordHash, firstname, lastname, sessionVersion: existing.sessionVersion + 1 })
      .where(eq(users.id, existing.id))
    console.log(`Mot de passe réinitialisé pour ${normalized} (sessions existantes invalidées)`)
  } else {
    await db.insert(users).values({ email: normalized, passwordHash, firstname, lastname })
    console.log(`Utilisateur ${normalized} créé`)
  }
} finally {
  await pool.end()
}
