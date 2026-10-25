import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from './schema'

export type Db = MySql2Database<typeof schema>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
/** Base ou transaction : les fonctions métier acceptent les deux. */
export type DbOrTx = Db | Tx

export interface DbHandle {
  db: Db
  pool: mysql.Pool
}

export function createDb(url: string, connectionLimit = 5): DbHandle {
  if (!url) {
    throw new Error('NUXT_DATABASE_URL manquant')
  }
  const pool = mysql.createPool({
    uri: url,
    connectionLimit,
    // Toutes les dates JS sont stockées et relues en UTC
    timezone: 'Z',
    charset: 'utf8mb4_unicode_ci',
    supportBigNumbers: true,
    multipleStatements: false,
  })
  const db = drizzle(pool, { schema, mode: 'default' })
  return { db, pool }
}

export { schema }
