import type mysql from 'mysql2/promise'

export interface MigrationFile {
  name: string
  sql: string
}

/**
 * Applique les migrations SQL générées par drizzle-kit, dans l'ordre, une seule fois chacune.
 * Un verrou MariaDB (GET_LOCK) empêche deux processus de migrer en même temps.
 */
export async function applyMigrations(pool: mysql.Pool, files: MigrationFile[]): Promise<string[]> {
  const conn = await pool.getConnection()
  const applied: string[] = []
  try {
    const [lockRows] = await conn.query<mysql.RowDataPacket[]>("SELECT GET_LOCK('mportal_migrations', 60) AS l")
    if (!lockRows[0] || lockRows[0].l !== 1) {
      throw new Error('Impossible d’obtenir le verrou de migration')
    }
    await conn.query(
      'CREATE TABLE IF NOT EXISTS `_migrations` (`name` varchar(190) NOT NULL PRIMARY KEY, `applied_at` datetime NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
    )
    const [rows] = await conn.query<mysql.RowDataPacket[]>('SELECT name FROM `_migrations`')
    const done = new Set(rows.map((r) => String(r.name)))

    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name))
    for (const file of sorted) {
      if (done.has(file.name)) continue
      const statements = file.sql
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
      for (const statement of statements) {
        await conn.query(statement)
      }
      await conn.query('INSERT INTO `_migrations` (name, applied_at) VALUES (?, UTC_TIMESTAMP())', [file.name])
      applied.push(file.name)
    }
    return applied
  } finally {
    await conn.query("SELECT RELEASE_LOCK('mportal_migrations')").catch(() => undefined)
    conn.release()
  }
}
