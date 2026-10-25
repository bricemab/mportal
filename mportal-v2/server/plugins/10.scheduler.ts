import { runDailyJob } from '../domain/jobs'

const HOUR = 60 * 60 * 1000

/**
 * Planificateur intégré : le processus Node tourne en continu chez Infomaniak,
 * la tâche quotidienne est donc lancée au démarrage puis toutes les heures (elle est idempotente).
 * La route /api/cron/daily permet aussi un déclenchement externe (tâche planifiée Infomaniak).
 */
export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig()
  if (!config.schedulerEnabled || import.meta.prerender) return

  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      const result = await runDailyJob(useDb())
      if (result.generated.length > 0) {
        console.info(`[mportal] ${result.generated.length} facture(s) d’abonnement générée(s)`)
      }
    } catch (error) {
      console.error('[mportal] échec de la tâche quotidienne', error)
    } finally {
      running = false
    }
  }

  const first = setTimeout(tick, 15_000)
  const interval = setInterval(tick, HOUR)
  nitroApp.hooks.hook('close', () => {
    clearTimeout(first)
    clearInterval(interval)
  })
})
