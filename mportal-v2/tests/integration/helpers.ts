import mysql from 'mysql2/promise'
import { createDb, type DbHandle } from '../../server/db/client'
import { applyMigrations } from '../../server/db/migrator'
import { users } from '../../server/db/schema'
import { hashPassword } from '../../server/domain/auth'
import type { Actor } from '../../server/domain/audit'
import { ensureDefaultSettings } from '../../server/domain/settings'
import { readMigrationFiles } from '../../scripts/lib'

export const TEST_DB_URL = process.env.TEST_DATABASE_URL

/** Base de test vierge : toutes les tables supprimées puis migrations rejouées. */
export async function freshDb(): Promise<DbHandle & { actor: Actor }> {
  if (!TEST_DB_URL) throw new Error('TEST_DATABASE_URL manquant')
  const admin = await mysql.createConnection({ uri: TEST_DB_URL, multipleStatements: true })
  const [tables] = await admin.query<mysql.RowDataPacket[]>('SHOW TABLES')
  await admin.query('SET FOREIGN_KEY_CHECKS = 0')
  for (const row of tables) {
    const name = String(Object.values(row)[0])
    await admin.query(`DROP TABLE IF EXISTS \`${name}\``)
  }
  await admin.query('SET FOREIGN_KEY_CHECKS = 1')
  await admin.end()

  const handle = createDb(TEST_DB_URL, 5)
  await applyMigrations(handle.pool, readMigrationFiles())
  await ensureDefaultSettings(handle.db)
  const [res] = await handle.db
    .insert(users)
    .values({ email: 'test@mportal.local', passwordHash: await hashPassword('TestPassword2026'), firstname: 'Test', lastname: 'User' })
    .$returningId()
  return { ...handle, actor: { userId: res!.id, ip: '127.0.0.1' } }
}
