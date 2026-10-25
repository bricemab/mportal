import { applyMigrations, type MigrationFile } from '../db/migrator'
import { ensureDefaultSettings } from '../domain/settings'

/**
 * Au démarrage : vérification de la configuration, puis migrations et réglages par défaut.
 * Le serveur refuse de démarrer si un secret obligatoire est absent ou trop faible.
 */
export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig()

  const problems: string[] = []
  if (!config.databaseUrl) problems.push('NUXT_DATABASE_URL')
  if (!config.session.password || config.session.password.length < 32) problems.push('NUXT_SESSION_PASSWORD (32 caractères minimum)')
  if (!config.cronSecret || config.cronSecret.length < 24) problems.push('NUXT_CRON_SECRET (24 caractères minimum)')
  if (problems.length > 0) {
    throw new Error(`Configuration invalide, variables manquantes : ${problems.join(', ')}`)
  }

  if (config.migrateOnStart) {
    const storage = useStorage('assets:migrations')
    const keys = (await storage.getKeys()).filter((k) => k.endsWith('.sql'))
    const files: MigrationFile[] = []
    for (const key of keys) {
      const sql = await storage.getItem<string>(key)
      if (typeof sql === 'string') files.push({ name: key.replace(/^.*:/, ''), sql })
    }
    const applied = await applyMigrations(useDbHandle().pool, files)
    if (applied.length > 0) console.info(`[mportal] migrations appliquées : ${applied.join(', ')}`)
  }

  await ensureDefaultSettings(useDb())
})
