import 'dotenv/config'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createDb, type DbHandle } from '../server/db/client'
import { applyMigrations } from '../server/db/migrator'
import { ensureDefaultSettings } from '../server/domain/settings'

export const MIGRATIONS_DIR = resolve(import.meta.dirname, '../server/db/migrations')

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`Variable d'environnement manquante : ${name}`)
    process.exit(1)
  }
  return value
}

export function readMigrationFiles(dir = MIGRATIONS_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8') }))
}

/** Ouvre la base cible, applique les migrations et les réglages par défaut. */
export async function openTargetDb(url = requireEnv('NUXT_DATABASE_URL')): Promise<DbHandle> {
  const handle = createDb(url, 3)
  await applyMigrations(handle.pool, readMigrationFiles())
  await ensureDefaultSettings(handle.db)
  return handle
}
