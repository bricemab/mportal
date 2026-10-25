import { and, eq, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { maintenanceContracts } from '../db/schema'
import { todayIso } from '../../shared/utils/dates'
import { SYSTEM_ACTOR } from './audit'
import { purgeLoginAttempts } from './auth'
import { generateDueInvoices, type GenerationResult } from './subscriptions'

export interface DailyJobResult {
  generated: GenerationResult[]
  endedContracts: number
}

/** Tâche quotidienne idempotente : factures d'abonnements, clôtures, purge. */
export async function runDailyJob(db: Db, today: string = todayIso()): Promise<DailyJobResult> {
  const generated = await generateDueInvoices(db, SYSTEM_ACTOR, today)
  const [res] = await db
    .update(maintenanceContracts)
    .set({ status: 'ENDED' })
    .where(and(eq(maintenanceContracts.status, 'ACTIVE'), sql`${maintenanceContracts.endDate} IS NOT NULL AND ${maintenanceContracts.endDate} < ${today}`))
  await purgeLoginAttempts(db)
  return { generated, endedContracts: res.affectedRows }
}
