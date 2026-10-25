import { timingSafeEqual } from 'node:crypto'
import { getHeader, getQuery } from 'h3'
import { runDailyJob } from '../../domain/jobs'
import { unauthorized } from '../../domain/errors'

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

/** Déclenchement externe de la tâche quotidienne, protégé par NUXT_CRON_SECRET (en-tête Authorization: Bearer … ou ?token=…). */
export default defineEventHandler(async (event) => {
  const secret = useRuntimeConfig().cronSecret
  const header = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const query = getQuery(event).token
  const provided = header || (typeof query === 'string' ? query : '')
  if (!secret || !provided || !safeEqual(provided, secret)) throw unauthorized()
  const result = await runDailyJob(useDb())
  return { ok: true, generated: result.generated.length, endedContracts: result.endedContracts }
})
