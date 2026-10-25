import { createDb } from '../server/db/client'
import { applyMigrations } from '../server/db/migrator'
import { readMigrationFiles, requireEnv } from './lib'

/** Applique les migrations SQL en attente (aussi fait automatiquement au démarrage du serveur). */
const { pool } = createDb(requireEnv('NUXT_DATABASE_URL'), 1)
try {
  const applied = await applyMigrations(pool, readMigrationFiles())
  console.log(applied.length ? `Migrations appliquées : ${applied.join(', ')}` : 'Base déjà à jour')
} finally {
  await pool.end()
}
